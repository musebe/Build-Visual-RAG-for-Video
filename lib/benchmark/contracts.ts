import { z } from "zod";

export const benchmarkQuestionInputSchema = z
  .object({
    question: z.string().trim().min(2).max(500),
    expectedSceneIndex: z.number().int().nonnegative(),
    expectedStartTime: z.number().nonnegative(),
    expectedEndTime: z.number().nonnegative(),
  })
  .refine((value) => value.expectedEndTime >= value.expectedStartTime, {
    message: "Expected end time must be at or after the start time.",
  });

export const benchmarkSetSchema = z
  .object({
    version: z.string().trim().min(1).max(80),
    questions: z.array(benchmarkQuestionInputSchema).length(30),
  })
  .refine(
    (value) => value.questions.every((item) => !item.question.startsWith("Replace with")),
    { message: "Replace every template question with a human-labeled visual question." },
  );

export const benchmarkRunRequestSchema = z.object({
  version: z.string().trim().min(1).max(80),
});

export type BenchmarkQuestionInput = z.infer<typeof benchmarkQuestionInputSchema>;
