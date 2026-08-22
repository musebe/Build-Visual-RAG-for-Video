import "server-only";

import { v2 as cloudinary } from "cloudinary";

import { getServerEnv } from "@/lib/config/env";

let configured = false;

export function getCloudinary() {
  if (!configured) {
    const env = getServerEnv();
    cloudinary.config({
      cloud_name: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }

  return cloudinary;
}

