import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/api/errors";
import {
  fetchVisualTranscript,
  getVideoAnalysis,
  normalizeAnalysisStatus,
} from "@/lib/cloudinary/ai-video-analysis";
import { toPublicVideo } from "@/lib/videos/public-video";
import {
  getVideo,
  markVideoFailed,
  persistVisualTranscript,
} from "@/lib/videos/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const paramsSchema = z.object({ videoId: z.string().uuid() });

export async function GET(
  _request: Request,
  context: { params: Promise<{ videoId: string }> },
) {
  try {
    const { videoId } = paramsSchema.parse(await context.params);
    let video = await getVideo(videoId);

    if (!video) {
      return NextResponse.json({ error: "Video was not found." }, { status: 404 });
    }

    if (video.status !== "analyzing") {
      return NextResponse.json({ video: toPublicVideo(video) });
    }

    if (!video.analysis_job_id) {
      await markVideoFailed(video.id, "missing_analysis_job");
      return NextResponse.json(
        { error: "The video analysis job is unavailable." },
        { status: 409 },
      );
    }

    const analysis = await getVideoAnalysis(video.analysis_job_id);
    const status = normalizeAnalysisStatus(analysis.status);

    if (status === "failed") {
      await markVideoFailed(video.id, "analysis_failed");
      video = (await getVideo(video.id)) ?? video;
      return NextResponse.json({ video: toPublicVideo(video) });
    }

    if (status === "pending") {
      return NextResponse.json({ video: toPublicVideo(video) });
    }

    if (!analysis.visual_transcription) {
      await markVideoFailed(video.id, "missing_visual_transcript");
      throw new Error("Cloudinary completed analysis without a visual transcript.");
    }

    const scenes = await fetchVisualTranscript(analysis.visual_transcription.url);
    video = await persistVisualTranscript({
      video,
      scenes,
      transcript: analysis.visual_transcription,
    });

    return NextResponse.json({
      video: toPublicVideo(video),
      sceneCount: scenes.length,
    });
  } catch (error) {
    console.error("[video-status] Polling error", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return errorResponse(error, 502);
  }
}

