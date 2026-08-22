import { z } from "zod";

export const searchRequestSchema = z.object({
  query: z.string().trim().min(2).max(500),
  limit: z.number().int().min(1).max(10).default(5),
  threshold: z.number().min(-1).max(1).default(0.2),
});

export const sceneMatchSchema = z.object({
  video_id: z.string().uuid(),
  cloudinary_public_id: z.string().min(1),
  scene_id: z.number().int().positive(),
  scene_index: z.number().int().nonnegative(),
  description: z.string().min(1),
  start_time: z.number().nonnegative(),
  end_time: z.number().nonnegative(),
  similarity: z.number().min(-1).max(1),
});

export const sceneMatchesSchema = z.array(sceneMatchSchema);

export type SceneMatch = z.infer<typeof sceneMatchSchema>;

export function formatTimestamp(totalSeconds: number) {
  const roundedTenths = Math.round(Math.max(0, totalSeconds) * 10);
  const wholeSeconds = Math.floor(roundedTenths / 10);
  const hours = Math.floor(wholeSeconds / 3_600);
  const minutes = Math.floor((wholeSeconds % 3_600) / 60);
  const seconds = wholeSeconds % 60;
  const fraction = roundedTenths % 10;
  const base = hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;

  return fraction ? `${base}.${fraction}` : base;
}

export function toTimestampCitation(match: SceneMatch, rank: number) {
  return {
    rank,
    sceneId: match.scene_id,
    sceneIndex: match.scene_index,
    description: match.description,
    startTime: match.start_time,
    endTime: match.end_time,
    similarity: Number(match.similarity.toFixed(4)),
    citation: `${formatTimestamp(match.start_time)}–${formatTimestamp(match.end_time)}`,
  };
}
