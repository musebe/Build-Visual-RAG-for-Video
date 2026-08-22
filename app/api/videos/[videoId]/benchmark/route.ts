import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/api/errors";
import { benchmarkRunRequestSchema } from "@/lib/benchmark/contracts";
import { evaluateQuestion, summarizeEvaluations } from "@/lib/benchmark/metrics";
import {
  completeBenchmarkRun,
  createBenchmarkRun,
  failBenchmarkRun,
  getBenchmarkQuestions,
  getLatestBenchmark,
} from "@/lib/benchmark/repository";
import { embedQueries } from "@/lib/embeddings/gemini";
import { getVideo, searchVideoScenes } from "@/lib/videos/repository";

export const runtime = "nodejs";
export const maxDuration = 60;
const paramsSchema = z.object({ videoId: z.string().uuid() });

export async function GET(_request: Request, context: { params: Promise<{ videoId: string }> }) {
  try {
    const { videoId } = paramsSchema.parse(await context.params);
    return NextResponse.json({ benchmark: await getLatestBenchmark(videoId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ videoId: string }> }) {
  let runId: string | undefined;
  try {
    const { videoId } = paramsSchema.parse(await context.params);
    const { version } = benchmarkRunRequestSchema.parse(await request.json());
    const video = await getVideo(videoId);
    if (!video) return NextResponse.json({ error: "Video was not found." }, { status: 404 });
    if (video.status !== "ready" || !video.embedding_model) {
      return NextResponse.json({ error: "The video is not ready for evaluation." }, { status: 409 });
    }
    const embeddingModel = video.embedding_model;

    const questions = await getBenchmarkQuestions(video.id, version);
    const run = await createBenchmarkRun(video, version);
    runId = run.id;
    const embeddings = await embedQueries(questions.map((question) => question.question));

    const evaluations = [];
    for (let offset = 0; offset < questions.length; offset += 5) {
      const batch = questions.slice(offset, offset + 5);
      const batchEvaluations = await Promise.all(
        batch.map(async (question, batchIndex) => {
          const embedding = embeddings[offset + batchIndex];
          if (!embedding) throw new Error("Benchmark embedding count mismatch.");
          const matches = await searchVideoScenes({
            videoId: video.id,
            embedding,
            model: embeddingModel,
            threshold: -1,
            limit: 3,
          });
          return evaluateQuestion(
            {
              question: question.question,
              expectedSceneIndex: question.expected_scene_index,
              expectedStartTime: question.expected_start_time,
              expectedEndTime: question.expected_end_time,
            },
            matches,
          );
        }),
      );
      evaluations.push(...batchEvaluations);
    }

    const summary = summarizeEvaluations(evaluations);
    const completed = await completeBenchmarkRun({
      runId: run.id,
      questions,
      evaluations,
      summary,
    });
    return NextResponse.json({ benchmark: { run: completed, summary } });
  } catch (error) {
    if (runId) await failBenchmarkRun(runId).catch(() => undefined);
    console.error("[benchmark] Run error", {
      name: error instanceof Error ? error.name : "UnknownError",
      started: Boolean(runId),
    });
    return errorResponse(error, 502);
  }
}
