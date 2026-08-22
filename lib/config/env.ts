import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().trim().min(1),
  CLOUDINARY_API_KEY: z.string().trim().min(1),
  CLOUDINARY_API_SECRET: z.string().trim().min(1),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().trim().min(1),
  GEMINI_API_KEY: z.string().trim().min(1),
  GEMINI_EMBEDDING_MODEL: z.literal("gemini-embedding-2").default("gemini-embedding-2"),
  MAX_VIDEO_BYTES: z.coerce.number().int().positive().default(104_857_600),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Server configuration is incomplete: ${missing}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function getConfigurationStatus() {
  return {
    cloudinary:
      Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) &&
      Boolean(process.env.CLOUDINARY_API_KEY) &&
      Boolean(process.env.CLOUDINARY_API_SECRET),
    database: Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SECRET_KEY),
    embeddings: Boolean(process.env.GEMINI_API_KEY),
  };
}
