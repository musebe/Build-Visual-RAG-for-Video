import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/config/env";
import { embedQuery } from "@/lib/embeddings/openai";
import { searchRequestSchema, toTimestampCitation } from "@/lib/search/contracts";
import { getVideo, searchVideoScenes } from "@/lib/videos/repository";

export const runtime = "nodejs";

const paramsSchema = z.object({ videoId: z.string().uuid() });

export async function POST(
  request: Request,
  context: { params: Promise<{ videoId: string }> },
) {
  try {
    const { videoId } = paramsSchema.parse(await context.params);
    const input = searchRequestSchema.parse(await request.json());
    const video = await getVideo(videoId);

    if (!video) {
      return NextResponse.json({ error: "Video was not found." }, { status: 404 });
    }
    if (video.status !== "ready" || !video.embedding_model) {
      return NextResponse.json(
        { error: "The video is not ready for semantic search." },
        { status: 409 },
      );
    }

    const model = getServerEnv().OPENAI_EMBEDDING_MODEL;
    if (video.embedding_model !== model) {
      return NextResponse.json(
        { error: "The stored scenes use a different embedding model." },
        { status: 409 },
      );
    }

    const embedding = await embedQuery(input.query);
    const matches = await searchVideoScenes({
      videoId,
      embedding,
      model,
      threshold: input.threshold,
      limit: input.limit,
    });

    return NextResponse.json({
      query: input.query,
      video: {
        id: video.id,
        publicId: video.cloudinary_public_id,
      },
      results: matches.map((match, index) => toTimestampCitation(match, index + 1)),
    });
  } catch (error) {
    console.error("[video-search] Search error", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return errorResponse(error, 502);
  }
}

