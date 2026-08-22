import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/api/errors";
import { benchmarkSetSchema } from "@/lib/benchmark/contracts";
import { saveBenchmarkQuestions } from "@/lib/benchmark/repository";
import { getScenesForEmbedding, getVideo } from "@/lib/videos/repository";

export const runtime = "nodejs";
const paramsSchema = z.object({ videoId: z.string().uuid() });

export async function PUT(request: Request, context: { params: Promise<{ videoId: string }> }) {
  try {
    const { videoId } = paramsSchema.parse(await context.params);
    const input = benchmarkSetSchema.parse(await request.json());
    const video = await getVideo(videoId);
    if (!video) return NextResponse.json({ error: "Video was not found." }, { status: 404 });
    if (video.status !== "ready") {
      return NextResponse.json({ error: "Index the video before labeling it." }, { status: 409 });
    }
    const scenes = await getScenesForEmbedding(video.id);
    const sceneIndexes = new Set(scenes.map((scene) => scene.scene_index));
    if (
      input.questions.some(
        (question) =>
          !sceneIndexes.has(question.expectedSceneIndex) ||
          question.expectedEndTime > video.duration,
      )
    ) {
      return NextResponse.json(
        { error: "A question references a missing scene or a timestamp beyond the video." },
        { status: 400 },
      );
    }
    const questions = await saveBenchmarkQuestions(video.id, input.version, input.questions);
    return NextResponse.json({ version: input.version, questionCount: questions.length });
  } catch (error) {
    return errorResponse(error);
  }
}
