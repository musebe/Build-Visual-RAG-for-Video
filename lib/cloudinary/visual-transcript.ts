import { z } from "zod";

export const analysisStatusSchema = z.enum(["pending", "complete", "completed", "failed"]);

const sceneSchema = z
  .object({
    transcript: z.string().trim().min(1).max(5_000),
    start_time: z.coerce.number().finite().nonnegative(),
    end_time: z.coerce.number().finite().nonnegative(),
  })
  .refine((scene) => scene.end_time >= scene.start_time, {
    message: "Scene end time must be at or after its start time.",
  });

const transcriptSchema = z.array(sceneSchema).min(1).max(10_000);

export type VisualScene = z.infer<typeof sceneSchema>;
export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;

export function normalizeAnalysisStatus(status: AnalysisStatus) {
  return status === "completed" ? "complete" : status;
}

export function parseVisualTranscript(input: unknown): VisualScene[] {
  return transcriptSchema.parse(input);
}

