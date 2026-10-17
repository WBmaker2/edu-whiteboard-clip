import type { Project } from "../types/project";
import { buildWorksheet, type EssayQuestion, type MultipleChoiceQuestion } from "./worksheet";

export interface QuizData {
  multipleChoice: MultipleChoiceQuestion[];
  essays: EssayQuestion[];
}

export function buildQuiz(project: Project): QuizData {
  const worksheet = buildWorksheet(project);
  return {
    multipleChoice: worksheet.multipleChoice,
    essays: worksheet.essays,
  };
}

export function heuristicEssayFeedback(
  answer: string,
  question: EssayQuestion,
): { score: number; feedback: string } {
  const trimmed = answer.trim();
  if (!trimmed) {
    return { score: 0, feedback: "답안이 비어 있습니다. 핵심 개념을 한두 문장으로 정리해 보세요." };
  }
  const keywords = question.guidingThoughts
    .join(" ")
    .match(/[가-힣A-Za-z0-9]{2,}/g)
    ?.slice(0, 8) ?? [];
  const hits = keywords.filter((keyword) => trimmed.includes(keyword)).length;
  const lengthScore = Math.min(6, Math.round(trimmed.length / 40));
  const keywordScore = Math.min(4, hits);
  const score = Math.max(1, Math.min(10, lengthScore + keywordScore));
  const feedback =
    score >= 8
      ? "핵심 개념을 충분히 설명했습니다. 구체적인 사례를 한 가지 더 연결하면 더 좋아요."
      : score >= 5
        ? "좋은 출발입니다. 원인과 결과를 구분해 조금 더 구체적으로 서술해 보세요."
        : "핵심 용어를 포함해 두세 문장으로 답안을 보완해 보세요.";
  return { score, feedback };
}
