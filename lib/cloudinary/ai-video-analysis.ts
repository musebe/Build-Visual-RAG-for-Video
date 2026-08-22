import "server-only";

import { z } from "zod";

import { getServerEnv } from "@/lib/config/env";
import {
  analysisStatusSchema,
  parseVisualTranscript,
  type VisualScene,
} from "@/lib/cloudinary/visual-transcript";

export { normalizeAnalysisStatus } from "@/lib/cloudinary/visual-transcript";
export type { VisualScene } from "@/lib/cloudinary/visual-transcript";

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

export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;

export const DEFAULT_VISUAL_TRANSCRIPTION_PROMPT =
  "Describe each visually distinct scene with concrete actions, people, objects, settings, visible text, and changes. Do not infer speech or events that are not visible.";

function getAnalysisUrl(jobId?: string) {
  const cloudName = getServerEnv().NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const base = `https://api.cloudinary.com/v2/video/${encodeURIComponent(
    cloudName,
  )}/ai_video_analysis`;
  return jobId ? `${base}/${encodeURIComponent(jobId)}` : base;
}

function getAuthorizationHeader() {
  const env = getServerEnv();
  return `Basic ${Buffer.from(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`).toString(
    "base64",
  )}`;
}

async function requestAnalysis(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: getAuthorizationHeader(),
      "Content-Type": "application/json",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const requestId = response.headers.get("x-cld-request-id");
    throw new Error(
      `Cloudinary AI Video Analysis request failed (${response.status}${
        requestId ? `, request ${requestId}` : ""
      }).`,
    );
  }

  return analysisResponseSchema.parse(await response.json());
}

export async function startVideoAnalysis(
  videoAssetId: string,
  prompt = DEFAULT_VISUAL_TRANSCRIPTION_PROMPT,
) {
  return requestAnalysis(getAnalysisUrl(), {
    method: "POST",
    body: JSON.stringify({
      video_asset_id: videoAssetId,
      visual_transcription_prompt: prompt,
    }),
  });
}

export async function getVideoAnalysis(jobId: string) {
  return requestAnalysis(getAnalysisUrl(jobId));
}

export async function fetchVisualTranscript(url: string): Promise<VisualScene[]> {
  const parsedUrl = new URL(url);
  if (
    !["http:", "https:"].includes(parsedUrl.protocol) ||
    parsedUrl.hostname !== "res.cloudinary.com"
  ) {
    throw new Error("Cloudinary returned an unexpected transcript asset URL.");
  }
  parsedUrl.protocol = "https:";

  const response = await fetch(parsedUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Cloudinary transcript download failed (${response.status}).`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > 10_000_000) {
    throw new Error("Cloudinary transcript exceeds the 10 MB safety limit.");
  }

  return parseVisualTranscript(await response.json());
}
