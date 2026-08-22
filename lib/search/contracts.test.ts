import { describe, expect, it } from "vitest";

import { formatTimestamp, searchRequestSchema, toTimestampCitation } from "./contracts";

describe("search contracts", () => {
  it("applies bounded retrieval defaults", () => {
    expect(searchRequestSchema.parse({ query: "person opens a red umbrella" })).toEqual({
      query: "person opens a red umbrella",
      limit: 5,
      threshold: 0.2,
    });
  });

  it("rejects an excessive result count", () => {
    expect(() => searchRequestSchema.parse({ query: "red umbrella", limit: 100 })).toThrow();
  });
});

describe("timestamp citations", () => {
  it("formats minute and hour positions", () => {
    expect(formatTimestamp(67.4)).toBe("1:07.4");
    expect(formatTimestamp(3_670)).toBe("1:01:10");
    expect(formatTimestamp(59.99)).toBe("1:00");
  });

  it("preserves exact scene boundaries in the citation payload", () => {
    const citation = toTimestampCitation(
      {
        video_id: "ebff0c45-a539-4808-bfd8-23d971b8cd30",
        cloudinary_public_id: "visual-rag/videos/example",
        scene_id: 8,
        scene_index: 2,
        description: "A person opens a red umbrella.",
        start_time: 14.25,
        end_time: 19.75,
        similarity: 0.812345,
      },
      1,
    );

    expect(citation).toMatchObject({
      rank: 1,
      startTime: 14.25,
      endTime: 19.75,
      similarity: 0.8123,
      citation: "0:14.3–0:19.8",
    });
  });
});
