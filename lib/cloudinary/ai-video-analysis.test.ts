import { describe, expect, it } from "vitest";

import {
  normalizeAnalysisStatus,
  parseAnalysisResponse,
  parseVisualTranscript,
} from "./visual-transcript";

describe("parseAnalysisResponse", () => {
  it("unwraps the documented Cloudinary response envelope", () => {
    expect(
      parseAnalysisResponse({
        request_id: "request-123",
        data: { job_id: "job-123", status: "pending" },
      }),
    ).toEqual({ job_id: "job-123", status: "pending" });
  });

  it("accepts the earlier unwrapped response during the Beta", () => {
    expect(parseAnalysisResponse({ job_id: "job-456", status: "completed" })).toEqual({
      job_id: "job-456",
      status: "completed",
    });
  });
});

describe("parseVisualTranscript", () => {
  it("accepts timestamped Cloudinary scene descriptions", () => {
    expect(
      parseVisualTranscript([
        { transcript: "A cyclist enters the frame.", start_time: 2.4, end_time: 7.8 },
        { transcript: "The bicycle stops by a red gate.", start_time: "7.8", end_time: 12 },
      ]),
    ).toEqual([
      { transcript: "A cyclist enters the frame.", start_time: 2.4, end_time: 7.8 },
      { transcript: "The bicycle stops by a red gate.", start_time: 7.8, end_time: 12 },
    ]);
  });

  it("rejects a reversed timestamp range", () => {
    expect(() =>
      parseVisualTranscript([
        { transcript: "Invalid range", start_time: 8, end_time: 4 },
      ]),
    ).toThrow(/end time/i);
  });

  it("rejects an empty transcript", () => {
    expect(() => parseVisualTranscript([])).toThrow();
  });
});

describe("normalizeAnalysisStatus", () => {
  it("normalizes the completed alias", () => {
    expect(normalizeAnalysisStatus("completed")).toBe("complete");
    expect(normalizeAnalysisStatus("pending")).toBe("pending");
  });
});
