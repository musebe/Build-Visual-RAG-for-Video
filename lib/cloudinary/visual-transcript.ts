import { z } from "zod";

export const analysisStatusSchema = z.enum(["pending", "complete", "completed", "failed"]);

const analysisResponseSchema = z.object({
  job_id: z.string().min(1),
  status: analysisStatusSchema,
  visual_transcription: z
    .object({
      asset_id: z.string().min(1),
      public_id: z.string().min(1),
      resource_type: z.literal("raw"),
      delivery_type: z.string().min(1),
      url: z.url(),
    })
    .optional(),
});

const analysisEnvelopeSchema = z.union([
  analysisResponseSchema,
  z.object({ data: analysisResponseSchema }),
]);

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
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;

export function normalizeAnalysisStatus(status: AnalysisStatus) {
  return status === "completed" ? "complete" : status;
}

export function parseVisualTranscript(input: unknown): VisualScene[] {
  return transcriptSchema.parse(input);
}

export function parseAnalysisResponse(input: unknown): AnalysisResponse {
  const parsed = analysisEnvelopeSchema.parse(input);
  return "data" in parsed ? parsed.data : parsed;
}
