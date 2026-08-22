import { describe, expect, it } from "vitest";

import {
  normalizeAnalysisStatus,
  parseVisualTranscript,
} from "./visual-transcript";

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
