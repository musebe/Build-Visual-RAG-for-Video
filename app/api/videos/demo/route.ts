import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api/errors";
import {
  DEFAULT_VISUAL_TRANSCRIPTION_PROMPT,
  startVideoAnalysis,
} from "@/lib/cloudinary/ai-video-analysis";
import {
  assertVideoConstraints,
  getVideoByAssetId,
} from "@/lib/cloudinary/video-assets";
import { getServerEnv } from "@/lib/config/env";
import { toPublicVideo } from "@/lib/videos/public-video";
import {
  createVideo,
  findVideoByAssetId,
  markVideoAnalyzing,
  markVideoFailed,
} from "@/lib/videos/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  let databaseVideoId: string | undefined;

  try {
    const assetId = getServerEnv().DEMO_VIDEO_ASSET_ID;
    if (!assetId) {
      return NextResponse.json(
        { error: "The Cloudinary demo video is not configured." },
        { status: 503 },
      );
    }

    const existing = await findVideoByAssetId(assetId);
    if (existing) {
      return NextResponse.json({ video: toPublicVideo(existing) });
    }

    const asset = await getVideoByAssetId(assetId);
    assertVideoConstraints(asset);

    const filename = `${asset.public_id.split("/").at(-1) ?? "demo-video"}.${asset.format}`;
    const video = await createVideo({
      video: asset,
      originalFilename: filename,
      analysisPrompt: DEFAULT_VISUAL_TRANSCRIPTION_PROMPT,
    });
    databaseVideoId = video.id;

    const analysis = await startVideoAnalysis(asset.asset_id, video.analysis_prompt);
    const analyzing = await markVideoAnalyzing(video.id, analysis.job_id);

    return NextResponse.json(
      { video: toPublicVideo(analyzing) },
      { status: 201 },
    );
  } catch (error) {
    if (databaseVideoId) {
      await markVideoFailed(databaseVideoId, "demo_analysis_start_failed").catch(
        () => undefined,
      );
    }

    console.error("[demo-video] Pipeline error", {
      name: error instanceof Error ? error.name : "UnknownError",
      hasDatabaseVideo: Boolean(databaseVideoId),
    });
    return errorResponse(error, 502);
  }
}
