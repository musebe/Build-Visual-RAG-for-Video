import type { BenchmarkQuestionInput } from "@/lib/benchmark/contracts";
import type { SceneMatch } from "@/lib/search/contracts";

export type QuestionEvaluation = {
  expectedRank: number | null;
  top1Correct: boolean;
  top3Hit: boolean;
  timestampOverlap: boolean;
  startTimeError: number | null;
  topMatch: SceneMatch | null;
};

export function evaluateQuestion(
  question: BenchmarkQuestionInput,
  matches: SceneMatch[],
): QuestionEvaluation {
  const expectedIndex = matches.findIndex(
    (match) => match.scene_index === question.expectedSceneIndex,
  );
  const topMatch = matches[0] ?? null;

  return {
    expectedRank: expectedIndex >= 0 ? expectedIndex + 1 : null,
    top1Correct: expectedIndex === 0,
    top3Hit: expectedIndex >= 0 && expectedIndex < 3,
    timestampOverlap: Boolean(
      topMatch &&
        topMatch.start_time <= question.expectedEndTime &&
        topMatch.end_time >= question.expectedStartTime,
    ),
    startTimeError: topMatch
      ? Math.abs(topMatch.start_time - question.expectedStartTime)
      : null,
    topMatch,
  };
}

export function summarizeEvaluations(evaluations: QuestionEvaluation[]) {
  if (evaluations.length === 0) throw new Error("Cannot summarize an empty benchmark.");
  const withStartError = evaluations.filter(
    (evaluation): evaluation is QuestionEvaluation & { startTimeError: number } =>
      evaluation.startTimeError !== null,
  );

  return {
    top1Accuracy:
      evaluations.filter((evaluation) => evaluation.top1Correct).length / evaluations.length,
    top3Recall:
      evaluations.filter((evaluation) => evaluation.top3Hit).length / evaluations.length,
    timestampOverlapAccuracy:
      evaluations.filter((evaluation) => evaluation.timestampOverlap).length / evaluations.length,
    meanStartTimeError:
      withStartError.length > 0
        ? withStartError.reduce((total, evaluation) => total + evaluation.startTimeError, 0) /
          withStartError.length
        : null,
  };
}

