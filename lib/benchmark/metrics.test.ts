import { describe, expect, it } from "vitest";

import { evaluateQuestion, summarizeEvaluations } from "./metrics";

const question = {
  question: "When does the cyclist stop?",
  expectedSceneIndex: 2,
  expectedStartTime: 10,
  expectedEndTime: 15,
};

function match(sceneIndex: number, startTime: number, endTime: number) {
  return {
    video_id: "ebff0c45-a539-4808-bfd8-23d971b8cd30",
    cloudinary_public_id: "visual-rag/videos/example",
    scene_id: sceneIndex + 1,
    scene_index: sceneIndex,
    description: "Visible scene",
    start_time: startTime,
    end_time: endTime,
    similarity: 0.8,
  };
}

describe("benchmark metrics", () => {
  it("scores scene rank and an overlapping top timestamp", () => {
    expect(evaluateQuestion(question, [match(2, 11, 14), match(1, 4, 8)])).toMatchObject({
      expectedRank: 1,
      top1Correct: true,
      top3Hit: true,
      timestampOverlap: true,
      startTimeError: 1,
    });
  });

  it("keeps scene recall separate from top-result timestamp correctness", () => {
    expect(
      evaluateQuestion(question, [match(7, 30, 35), match(2, 10, 15)]),
    ).toMatchObject({
      expectedRank: 2,
      top1Correct: false,
      top3Hit: true,
      timestampOverlap: false,
      startTimeError: 20,
    });
  });

  it("summarizes the full question set", () => {
    expect(
      summarizeEvaluations([
        evaluateQuestion(question, [match(2, 10, 15)]),
        evaluateQuestion(question, [match(7, 20, 25)]),
      ]),
    ).toEqual({
      top1Accuracy: 0.5,
      top3Recall: 0.5,
      timestampOverlapAccuracy: 0.5,
      meanStartTimeError: 5,
    });
  });
});

