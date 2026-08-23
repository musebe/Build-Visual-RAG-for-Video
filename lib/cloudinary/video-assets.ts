import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { getCloudinary } from "@/lib/cloudinary/client";
import { getServerEnv } from "@/lib/config/env";

export const VIDEO_PUBLIC_ID_PREFIX = "visual-rag/videos/";
export const SUPPORTED_VIDEO_FORMATS = ["mp4", "mov", "webm"] as const;
export const SUPPORTED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

const uploadRequestSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.enum(SUPPORTED_VIDEO_MIME_TYPES),
  bytes: z.number().int().positive(),
});

const cloudinaryVideoSchema = z.object({
  asset_id: z.string().min(1),
  public_id: z.string().min(1),
  resource_type: z.literal("video"),
  type: z.string().default("upload"),
  format: z.string().toLowerCase(),
  bytes: z.number().int().nonnegative(),
  duration: z.number().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  secure_url: z.url(),
  context: z
    .object({
      custom: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

const cloudinaryVideoLocatorSchema = cloudinaryVideoSchema.pick({
  asset_id: true,
  public_id: true,
  resource_type: true,
  type: true,
});

const resourcesResponseSchema = z.object({
  resources: z.array(cloudinaryVideoLocatorSchema).length(1),
});

export type CloudinaryVideo = z.infer<typeof cloudinaryVideoSchema>;
export type UploadRequest = z.infer<typeof uploadRequestSchema>;

export function parseUploadRequest(input: unknown): UploadRequest {
  const request = uploadRequestSchema.parse(input);
  const { MAX_VIDEO_BYTES } = getServerEnv();

  if (request.bytes > MAX_VIDEO_BYTES) {
    throw new Error(`Video exceeds the ${Math.floor(MAX_VIDEO_BYTES / 1_048_576)} MB limit.`);
  }

  return request;
}

export function createSignedVideoUpload(input: UploadRequest) {
  const env = getServerEnv();
  const ingestId = randomUUID();
  const publicId = `${VIDEO_PUBLIC_ID_PREFIX}${ingestId}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const signedParams = {
    allowed_formats: [...SUPPORTED_VIDEO_FORMATS],
    context: `ingest_id=${ingestId}`,
    overwrite: false,
    public_id: publicId,
    tags: "visual-rag,silent-video-search",
    timestamp,
    type: "upload" as const,
  };

  return {
    apiKey: env.CLOUDINARY_API_KEY,
    cloudName: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(
      env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    )}/video/upload`,
    signature: getCloudinary().utils.api_sign_request(
      signedParams,
      env.CLOUDINARY_API_SECRET,
    ),
    signedParams,
    expected: {
      bytes: input.bytes,
      filename: input.filename,
      mimeType: input.mimeType,
      publicId,
    },
  };
}

export async function getVideoByAssetId(assetId: string): Promise<CloudinaryVideo> {
  const located = resourcesResponseSchema.parse(
    await getCloudinary().api.resources_by_asset_ids(assetId, {
      resource_type: "video",
      type: "upload",
    }),
  ).resources[0];

  if (!located || located.asset_id !== assetId) {
    throw new Error("Cloudinary video was not found.");
  }

  const result = await getCloudinary().api.resource(located.public_id, {
    context: true,
    media_metadata: true,
    resource_type: "video",
    type: located.type,
  });
  const video = cloudinaryVideoSchema.parse(result);

  if (video.asset_id !== assetId) {
    throw new Error("Cloudinary video was not found.");
  }

  return video;
}

export function assertIngestionOwnership(video: CloudinaryVideo, expectedPublicId: string) {
  const ingestId = expectedPublicId.slice(VIDEO_PUBLIC_ID_PREFIX.length);

  if (
    video.public_id !== expectedPublicId ||
    !video.public_id.startsWith(VIDEO_PUBLIC_ID_PREFIX) ||
    video.context?.custom?.ingest_id !== ingestId
  ) {
    throw new Error("The uploaded asset does not belong to this ingestion request.");
  }
}

export function assertVideoConstraints(video: CloudinaryVideo) {
  const { MAX_VIDEO_BYTES } = getServerEnv();

  if (!SUPPORTED_VIDEO_FORMATS.includes(video.format as (typeof SUPPORTED_VIDEO_FORMATS)[number])) {
    throw new Error("Cloudinary decoded an unsupported video format.");
  }

  if (video.bytes > MAX_VIDEO_BYTES) {
    throw new Error("Cloudinary decoded a video that exceeds the configured size limit.");
  }
}

export async function deleteVideo(assetId: string) {
  await getCloudinary().api.delete_resources_by_asset_ids([assetId], {
    invalidate: true,
    resource_type: "video",
    type: "upload",
  });
}
