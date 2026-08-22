import { describe, expect, it } from "vitest";

import {
  prepareSearchDocument,
  prepareSearchQuery,
} from "./retrieval-input";

describe("Gemini retrieval inputs", () => {
  it("marks Cloudinary scene descriptions as search documents", () => {
    expect(prepareSearchDocument("  A red bicycle crosses the frame.  ")).toBe(
      "title: video scene | text: A red bicycle crosses the frame.",
    );
  });

  it("marks search and benchmark questions as retrieval queries", () => {
    expect(prepareSearchQuery("  When does the bicycle appear?  ")).toBe(
      "task: search result | query: When does the bicycle appear?",
    );
  });

  it("rejects empty and oversized inputs", () => {
    expect(() => prepareSearchDocument("   ")).toThrow(/between 1 and 8,000/);
    expect(() => prepareSearchQuery("x".repeat(8_001))).toThrow(
      /between 1 and 8,000/,
    );
  });
});
