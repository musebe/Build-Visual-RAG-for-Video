import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/config/env";
import { embedTexts } from "@/lib/embeddings/openai";
import { toPublicVideo } from "@/lib/videos/public-video";
import {
  claimVideoForEmbedding,
  getScenesForEmbedding,
  getVideo,
  markVideoFailed,
  persistSceneEmbeddings,
} from "@/lib/videos/repository";

export const runtime = "nodejs";
export const maxDuration = 60;

const paramsSchema = z.object({ videoId: z.string().uuid() });

export async function POST(
  _request: Request,
  context: { params: Promise<{ videoId: string }> },
) {
  let claimedVideoId: string | undefined;

  try {
    const { videoId } = paramsSchema.parse(await context.params);
    const current = await getVideo(videoId);
    if (!current) {
      return NextResponse.json({ error: "Video was not found." }, { status: 404 });
    }
    if (current.status === "ready") {
      return NextResponse.json({ video: toPublicVideo(current) });
    }
    if (current.status !== "transcript_ready") {
      return NextResponse.json(
        { error: "The visual transcript is not ready to index." },
        { status: 409 },
      );
    }

    const video = await claimVideoForEmbedding(videoId);
    if (!video) {
      return NextResponse.json(
        { error: "Another request is already indexing this video." },
        { status: 409 },
      );
    }
    claimedVideoId = video.id;

    const scenes = await getScenesForEmbedding(video.id);
    const embeddings = await embedTexts(scenes.map((scene) => scene.retrieval_text));
    const ready = await persistSceneEmbeddings({
      video,
      scenes,
      embeddings,
      model: getServerEnv().OPENAI_EMBEDDING_MODEL,
    });

    return NextResponse.json({
      video: toPublicVideo(ready),
      indexedScenes: scenes.length,
    });
  } catch (error) {
    if (claimedVideoId) {
      await markVideoFailed(claimedVideoId, "embedding_failed").catch(() => undefined);
    }
    console.error("[video-index] Indexing error", {
      name: error instanceof Error ? error.name : "UnknownError",
      claimed: Boolean(claimedVideoId),
    });
    return errorResponse(error, 502);
  }
}

