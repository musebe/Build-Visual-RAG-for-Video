import "server-only";

import { z } from "zod";

import type { CloudinaryVideo } from "@/lib/cloudinary/video-assets";
import type { VisualScene } from "@/lib/cloudinary/ai-video-analysis";
import { sceneMatchesSchema } from "@/lib/search/contracts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const videoStatusSchema = z.enum([
  "uploaded",
  "analyzing",
  "transcript_ready",
  "embedding",
  "ready",
  "failed",
]);

export const videoRowSchema = z.object({
  id: z.string().uuid(),
  cloudinary_asset_id: z.string().min(1),
  cloudinary_public_id: z.string().min(1),
  original_filename: z.string().min(1),
  secure_url: z.url(),
  format: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  duration: z.number().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  status: videoStatusSchema,
  analysis_job_id: z.string().nullable(),
  analysis_prompt: z.string().min(1),
  transcript_asset_id: z.string().nullable(),
  transcript_public_id: z.string().nullable(),
  transcript_url: z.string().nullable(),
  embedding_model: z.string().nullable(),
  error_code: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type VideoRow = z.infer<typeof videoRowSchema>;

const sceneForEmbeddingSchema = z.object({
  id: z.number().int().positive(),
  video_id: z.string().uuid(),
  scene_index: z.number().int().nonnegative(),
  start_time: z.number().nonnegative(),
  end_time: z.number().nonnegative(),
  description: z.string().min(1),
  retrieval_text: z.string().min(1),
});

const scenesForEmbeddingSchema = z.array(sceneForEmbeddingSchema).min(1);

export type SceneForEmbedding = z.infer<typeof sceneForEmbeddingSchema>;

function assertNoDatabaseError(error: { message: string } | null, action: string) {
  if (error) throw new Error(`Database ${action} failed.`);
}

export async function findVideoByAssetId(assetId: string): Promise<VideoRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("videos")
    .select("*")
    .eq("cloudinary_asset_id", assetId)
    .maybeSingle();
  assertNoDatabaseError(error, "read");
  return data ? videoRowSchema.parse(data) : null;
}

export async function getVideo(videoId: string): Promise<VideoRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("videos")
    .select("*")
    .eq("id", videoId)
    .maybeSingle();
  assertNoDatabaseError(error, "read");
  return data ? videoRowSchema.parse(data) : null;
}

export async function createVideo(input: {
  video: CloudinaryVideo;
  originalFilename: string;
  analysisPrompt: string;
}): Promise<VideoRow> {
  const { data, error } = await getSupabaseAdmin()
    .from("videos")
    .insert({
      cloudinary_asset_id: input.video.asset_id,
      cloudinary_public_id: input.video.public_id,
      original_filename: input.originalFilename,
      secure_url: input.video.secure_url,
      format: input.video.format,
      bytes: input.video.bytes,
      duration: input.video.duration,
      width: input.video.width,
      height: input.video.height,
      status: "uploaded",
      analysis_prompt: input.analysisPrompt,
    })
    .select("*")
    .single();
  assertNoDatabaseError(error, "insert");
  return videoRowSchema.parse(data);
}

export async function markVideoAnalyzing(videoId: string, jobId: string): Promise<VideoRow> {
  const { data, error } = await getSupabaseAdmin()
    .from("videos")
    .update({ status: "analyzing", analysis_job_id: jobId, error_code: null })
    .eq("id", videoId)
    .eq("status", "uploaded")
    .select("*")
    .single();
  assertNoDatabaseError(error, "status update");
  return videoRowSchema.parse(data);
}

export async function markVideoFailed(videoId: string, errorCode: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("videos")
    .update({ status: "failed", error_code: errorCode.slice(0, 100) })
    .eq("id", videoId);
  assertNoDatabaseError(error, "failure update");
}

export async function persistVisualTranscript(input: {
  video: VideoRow;
  scenes: VisualScene[];
  transcript: {
    asset_id: string;
    public_id: string;
    url: string;
  };
}): Promise<VideoRow> {
  const sceneRows = input.scenes.map((scene, sceneIndex) => ({
    video_id: input.video.id,
    scene_index: sceneIndex,
    start_time: scene.start_time,
    end_time: scene.end_time,
    description: scene.transcript,
    retrieval_text: scene.transcript,
  }));

  const { error: sceneError } = await getSupabaseAdmin()
    .from("video_scenes")
    .upsert(sceneRows, { onConflict: "video_id,scene_index" });
  assertNoDatabaseError(sceneError, "scene upsert");

  const { data, error } = await getSupabaseAdmin()
    .from("videos")
    .update({
      status: "transcript_ready",
      transcript_asset_id: input.transcript.asset_id,
      transcript_public_id: input.transcript.public_id,
      transcript_url: input.transcript.url,
      error_code: null,
    })
    .eq("id", input.video.id)
    .eq("status", "analyzing")
    .select("*")
    .single();
  assertNoDatabaseError(error, "transcript update");
  return videoRowSchema.parse(data);
}

export async function claimVideoForEmbedding(videoId: string): Promise<VideoRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("videos")
    .update({ status: "embedding", error_code: null })
    .eq("id", videoId)
    .eq("status", "transcript_ready")
    .select("*")
    .maybeSingle();
  assertNoDatabaseError(error, "embedding claim");
  return data ? videoRowSchema.parse(data) : null;
}

export async function getScenesForEmbedding(videoId: string): Promise<SceneForEmbedding[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("video_scenes")
    .select("id,video_id,scene_index,start_time,end_time,description,retrieval_text")
    .eq("video_id", videoId)
    .order("scene_index", { ascending: true });
  assertNoDatabaseError(error, "scene read");
  return scenesForEmbeddingSchema.parse(data);
}

export async function persistSceneEmbeddings(input: {
  video: VideoRow;
  scenes: SceneForEmbedding[];
  embeddings: number[][];
  model: string;
}): Promise<VideoRow> {
  if (input.scenes.length !== input.embeddings.length) {
    throw new Error("Scene and embedding counts do not match.");
  }

  const rows = input.scenes.map((scene, index) => ({
    ...scene,
    embedding: input.embeddings[index],
    embedding_model: input.model,
  }));
  const { error: sceneError } = await getSupabaseAdmin()
    .from("video_scenes")
    .upsert(rows, { onConflict: "id" });
  assertNoDatabaseError(sceneError, "embedding upsert");

  const { data, error } = await getSupabaseAdmin()
    .from("videos")
    .update({ status: "ready", embedding_model: input.model, error_code: null })
    .eq("id", input.video.id)
    .eq("status", "embedding")
    .select("*")
    .single();
  assertNoDatabaseError(error, "ready update");
  return videoRowSchema.parse(data);
}

export async function searchVideoScenes(input: {
  videoId: string;
  embedding: number[];
  model: string;
  threshold: number;
  limit: number;
}) {
  const { data, error } = await getSupabaseAdmin().rpc("match_video_scenes", {
    query_video_id: input.videoId,
    query_embedding: input.embedding,
    query_model: input.model,
    match_threshold: input.threshold,
    match_count: input.limit,
  });
  assertNoDatabaseError(error, "vector search");
  return sceneMatchesSchema.parse(data);
}

