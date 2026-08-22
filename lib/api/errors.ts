import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function errorResponse(error: unknown, fallbackStatus = 500) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "The request contains invalid or unsupported values." },
      { status: 400 },
    );
  }

  const message = error instanceof Error ? error.message : "The request could not be completed.";
  const clientError =
    message.includes("exceeds") ||
    message.includes("unsupported") ||
    message.includes("does not belong") ||
    message.includes("not found");

  return NextResponse.json(
    { error: clientError ? message : "The request could not be completed." },
    { status: clientError ? 400 : fallbackStatus },
  );
}

