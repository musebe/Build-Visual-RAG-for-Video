import "server-only";

import { z } from "zod";

import type { BenchmarkQuestionInput } from "@/lib/benchmark/contracts";
import type { QuestionEvaluation } from "@/lib/benchmark/metrics";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { VideoRow } from "@/lib/videos/repository";

const questionRowSchema = z.object({
  id: z.number().int().positive(),
  video_id: z.string().uuid(),
  benchmark_version: z.string(),
  position: z.number().int(),
  question: z.string(),
  expected_scene_index: z.number().int(),
  expected_start_time: z.number(),
  expected_end_time: z.number(),
  created_at: z.string(),
});

const runRowSchema = z.object({
  id: z.string().uuid(),
  video_id: z.string().uuid(),
  benchmark_version: z.string(),
  embedding_model: z.string(),
  analysis_prompt: z.string(),
  match_count: z.number().int(),
  match_threshold: z.number(),
  question_count: z.number().int(),
  status: z.enum(["running", "complete", "failed"]),
  top1_accuracy: z.number().nullable(),
  top3_recall: z.number().nullable(),
  timestamp_overlap_accuracy: z.number().nullable(),
  mean_start_time_error: z.number().nullable(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
});

const resultRowSchema = z.object({
  id: z.number().int().positive(),
  run_id: z.string().uuid(),
  question_id: z.number().int().positive(),
  question: z.string(),
  expected_scene_index: z.number().int(),
  expected_start_time: z.number(),
  expected_end_time: z.number(),
  retrieved_scene_index: z.number().int().nullable(),
  retrieved_start_time: z.number().nullable(),
  retrieved_end_time: z.number().nullable(),
  similarity: z.number().nullable(),
  expected_rank: z.number().int().nullable(),
  top1_correct: z.boolean(),
  top3_hit: z.boolean(),
  timestamp_overlap: z.boolean(),
  start_time_error: z.number().nullable(),
  created_at: z.string(),
});

export type BenchmarkQuestionRow = z.infer<typeof questionRowSchema>;

function assertDatabase(error: { message: string } | null, action: string) {
  if (error) throw new Error(`Database benchmark ${action} failed.`);
}

export async function saveBenchmarkQuestions(
  videoId: string,
  version: string,
  questions: BenchmarkQuestionInput[],
) {
  const rows = questions.map((question, index) => ({
    video_id: videoId,
    benchmark_version: version,
    position: index + 1,
    question: question.question,
    expected_scene_index: question.expectedSceneIndex,
    expected_start_time: question.expectedStartTime,
    expected_end_time: question.expectedEndTime,
  }));
  const { data, error } = await getSupabaseAdmin()
    .from("benchmark_questions")
    .upsert(rows, { onConflict: "video_id,benchmark_version,position" })
    .select("*");
  assertDatabase(error, "question save");
  return z.array(questionRowSchema).length(30).parse(data);
}

export async function getBenchmarkQuestions(videoId: string, version: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("benchmark_questions")
    .select("*")
    .eq("video_id", videoId)
    .eq("benchmark_version", version)
    .order("position", { ascending: true });
  assertDatabase(error, "question read");
  return z.array(questionRowSchema).length(30).parse(data);
}

export async function createBenchmarkRun(video: VideoRow, version: string) {
  if (!video.embedding_model) throw new Error("Video embedding model is missing.");
  const { data, error } = await getSupabaseAdmin()
    .from("benchmark_runs")
    .insert({
      video_id: video.id,
      benchmark_version: version,
      embedding_model: video.embedding_model,
      analysis_prompt: video.analysis_prompt,
      match_count: 3,
      match_threshold: -1,
      question_count: 30,
      status: "running",
    })
    .select("*")
    .single();
  assertDatabase(error, "run create");
  return runRowSchema.parse(data);
}

export async function completeBenchmarkRun(input: {
  runId: string;
  questions: BenchmarkQuestionRow[];
  evaluations: QuestionEvaluation[];
  summary: {
    top1Accuracy: number;
    top3Recall: number;
    timestampOverlapAccuracy: number;
    meanStartTimeError: number | null;
  };
}) {
  const resultRows = input.questions.map((question, index) => {
    const evaluation = input.evaluations[index];
    if (!evaluation) throw new Error("Benchmark result count mismatch.");
    return {
      run_id: input.runId,
      question_id: question.id,
      question: question.question,
      expected_scene_index: question.expected_scene_index,
      expected_start_time: question.expected_start_time,
      expected_end_time: question.expected_end_time,
      retrieved_scene_index: evaluation.topMatch?.scene_index ?? null,
      retrieved_start_time: evaluation.topMatch?.start_time ?? null,
      retrieved_end_time: evaluation.topMatch?.end_time ?? null,
      similarity: evaluation.topMatch?.similarity ?? null,
      expected_rank: evaluation.expectedRank,
      top1_correct: evaluation.top1Correct,
      top3_hit: evaluation.top3Hit,
      timestamp_overlap: evaluation.timestampOverlap,
      start_time_error: evaluation.startTimeError,
    };
  });
  const { error: resultError } = await getSupabaseAdmin()
    .from("benchmark_results")
    .insert(resultRows);
  assertDatabase(resultError, "result save");

  const { data, error } = await getSupabaseAdmin()
    .from("benchmark_runs")
    .update({
      status: "complete",
      top1_accuracy: input.summary.top1Accuracy,
      top3_recall: input.summary.top3Recall,
      timestamp_overlap_accuracy: input.summary.timestampOverlapAccuracy,
      mean_start_time_error: input.summary.meanStartTimeError,
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.runId)
    .select("*")
    .single();
  assertDatabase(error, "run complete");
  return runRowSchema.parse(data);
}

export async function failBenchmarkRun(runId: string) {
  const { error } = await getSupabaseAdmin()
    .from("benchmark_runs")
    .update({ status: "failed", completed_at: new Date().toISOString() })
    .eq("id", runId);
  assertDatabase(error, "run failure update");
}

export async function getLatestBenchmark(videoId: string) {
  const { data: runData, error: runError } = await getSupabaseAdmin()
    .from("benchmark_runs")
    .select("*")
    .eq("video_id", videoId)
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  assertDatabase(runError, "latest run read");
  if (!runData) return null;
  const run = runRowSchema.parse(runData);

  const { data: resultsData, error: resultsError } = await getSupabaseAdmin()
    .from("benchmark_results")
    .select("*")
    .eq("run_id", run.id)
    .order("question_id", { ascending: true });
  assertDatabase(resultsError, "result read");
  return { run, results: z.array(resultRowSchema).parse(resultsData) };
}

