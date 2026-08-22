import type { VideoRow } from "@/lib/videos/repository";

export function toPublicVideo(video: VideoRow) {
  return {
    id: video.id,
    publicId: video.cloudinary_public_id,
    filename: video.original_filename,
    format: video.format,
    duration: video.duration,
    width: video.width,
    height: video.height,
    status: video.status,
    errorCode: video.error_code,
    createdAt: video.created_at,
    updatedAt: video.updated_at,
  };
}

