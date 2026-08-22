import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api/errors";
import { createSignedVideoUpload, parseUploadRequest } from "@/lib/cloudinary/video-assets";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 10_000) {
      return NextResponse.json({ error: "The signature request is too large." }, { status: 413 });
    }

    const upload = parseUploadRequest(await request.json());
    return NextResponse.json(createSignedVideoUpload(upload));
  } catch (error) {
    return errorResponse(error);
  }
}

