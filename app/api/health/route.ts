import { NextResponse } from "next/server";

import { getConfigurationStatus } from "@/lib/config/env";

export const runtime = "nodejs";

export function GET() {
  const services = getConfigurationStatus();
  return NextResponse.json({
    ok: Object.values(services).every(Boolean),
    services,
    analysis: "cloudinary-ai-video-analysis-beta",
  });
}

