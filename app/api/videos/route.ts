import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/api/errors";
import {
  DEFAULT_VISUAL_TRANSCRIPTION_PROMPT,
  startVideoAnalysis,
} from "@/lib/cloudinary/ai-video-analysis";
import {
  assertOwnedVideo,
  deleteVideo,
  getVideoByAssetId,
  VIDEO_PUBLIC_ID_PREFIX,
} from "@/lib/cloudinary/video-assets";
import { toPublicVideo } from "@/lib/videos/public-video";
import {
  createVideo,
  findVideoByAssetId,
  markVideoAnalyzing,
  markVideoFailed,
} from "@/lib/videos/repository";

export const runtime = "nodejs";

const finalizeUploadSchema = z.object({
  assetId: z.string().trim().min(1).max(255),
  publicId: z.string().startsWith(VIDEO_PUBLIC_ID_PREFIX).max(255),
  originalFilename: z.string().trim().min(1).max(255),
});

export async function POST(request: Request) {
  let databaseVideoId: string | undefined;
  let assetId: string | undefined;
  let assetVerified = false;

  try {
    const input = finalizeUploadSchema.parse(await request.json());
    assetId = input.assetId;

    const existing = await findVideoByAssetId(input.assetId);
    if (existing) {
      return NextResponse.json({ video: toPublicVideo(existing) });
    }

    const asset = await getVideoByAssetId(input.assetId);
    assertOwnedVideo(asset, input.publicId);
    assetVerified = true;

    const video = await createVideo({
      video: asset,
      originalFilename: input.originalFilename,
      analysisPrompt: DEFAULT_VISUAL_TRANSCRIPTION_PROMPT,
    });
    databaseVideoId = video.id;

    const analysis = await startVideoAnalysis(asset.asset_id, video.analysis_prompt);
    const analyzing = await markVideoAnalyzing(video.id, analysis.job_id);

    return NextResponse.json({ video: toPublicVideo(analyzing) }, { status: 201 });
  } catch (error) {
    console.error("[video-ingest] Pipeline error", {
      name: error instanceof Error ? error.name : "UnknownError",
      hasDatabaseVideo: Boolean(databaseVideoId),
      hasAsset: Boolean(assetId),
    });

    if (databaseVideoId) {
      await markVideoFailed(databaseVideoId, "analysis_start_failed").catch(() => undefined);
    } else if (assetId && assetVerified) {
      const wasRegistered = await findVideoByAssetId(assetId).catch(() => undefined);
      if (wasRegistered === null) {
        await deleteVideo(assetId).catch(() => undefined);
      }
    }

    return errorResponse(error, 502);
  }
}
