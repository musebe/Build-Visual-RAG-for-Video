import { describe, expect, it } from "vitest";

import { benchmarkSetSchema } from "./contracts";

describe("benchmarkSetSchema", () => {
  it("requires exactly 30 non-placeholder questions", () => {
    const questions = Array.from({ length: 30 }, (_, index) => ({
      question: `What happens in labeled scene ${index}?`,
      expectedSceneIndex: index,
      expectedStartTime: index,
      expectedEndTime: index + 1,
    }));
    expect(benchmarkSetSchema.parse({ version: "v1", questions }).questions).toHaveLength(30);
    expect(() =>
      benchmarkSetSchema.parse({
        version: "v1",
        questions: questions.map((question, index) =>
          index === 0 ? { ...question, question: "Replace with labeled question" } : question,
        ),
      }),
    ).toThrow(/replace every template/i);
  });
});

