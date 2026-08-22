import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/api/errors";
import { getScenesForEmbedding, getVideo } from "@/lib/videos/repository";

export const runtime = "nodejs";
const paramsSchema = z.object({ videoId: z.string().uuid() });

export async function GET(_request: Request, context: { params: Promise<{ videoId: string }> }) {
  try {
    const { videoId } = paramsSchema.parse(await context.params);
    const video = await getVideo(videoId);
    if (!video) return NextResponse.json({ error: "Video was not found." }, { status: 404 });
    if (video.status !== "ready") {
      return NextResponse.json({ error: "The scene catalog is not ready." }, { status: 409 });
    }
    const scenes = await getScenesForEmbedding(video.id);
    return NextResponse.json({
      video: { id: video.id, publicId: video.cloudinary_public_id, duration: video.duration },
      scenes: scenes.map((scene) => ({
        sceneIndex: scene.scene_index,
        startTime: scene.start_time,
        endTime: scene.end_time,
        description: scene.description,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

