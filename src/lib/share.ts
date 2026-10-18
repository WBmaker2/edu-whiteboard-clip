import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { Project } from "../types/project";
import { parseProjectJson, serializeProject } from "./export/project";
import type { QuizData } from "./quiz";

export const SHARE_HASH_PREFIX = "#view=";
export const QUIZ_HASH_PREFIX = "#quiz=";
export const MAX_SHARE_URL_LENGTH = 8000;

export interface SharedQuiz {
  kind: "panseolab-quiz";
  topic: string;
  quiz: QuizData;
}

/** Serializes a project for URL sharing: audio and image assets stay out of the link. */
export async function encodeSharedProject(project: Project): Promise<string> {
  const json = await serializeProject(project, false);
  return compressToEncodedURIComponent(json);
}

export function decodeSharedProject(data: string): Project {
  const json = decompressFromEncodedURIComponent(data);
  if (!json) {
    throw new Error("공유 링크를 읽지 못했습니다. 링크가 잘렸는지 확인해 주세요.");
  }
  const project = parseProjectJson(json);
  return {
    ...project,
    assets: {},
    scenes: project.scenes.map((scene) => ({
      ...scene,
      beats: scene.beats.map((beat) => ({ ...beat, visual: undefined })),
    })),
  };
}

export function buildShareUrl(base: string, encoded: string): string {
  return `${base}${SHARE_HASH_PREFIX}${encoded}`;
}

export function readShareData(hash: string): string | null {
  if (!hash.startsWith(SHARE_HASH_PREFIX)) return null;
  const data = hash.slice(SHARE_HASH_PREFIX.length);
  return data ? data : null;
}

export function encodeSharedQuiz(topic: string, quiz: QuizData): string {
  const payload: SharedQuiz = { kind: "panseolab-quiz", topic, quiz };
  return compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodeSharedQuiz(data: string): SharedQuiz {
  const json = decompressFromEncodedURIComponent(data);
  if (!json) {
    throw new Error("퀴즈 링크를 읽지 못했습니다. 링크가 잘렸는지 확인해 주세요.");
  }
  let raw: any;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("퀴즈 데이터를 해석하지 못했습니다.");
  }
  if (
    !raw ||
    raw.kind !== "panseolab-quiz" ||
    !raw.quiz ||
    !Array.isArray(raw.quiz.multipleChoice) ||
    !Array.isArray(raw.quiz.essays)
  ) {
    throw new Error("판서랩 퀴즈 링크 형식이 아닙니다.");
  }
  const multipleChoice = raw.quiz.multipleChoice
    .filter(
      (item: any) =>
        item &&
        typeof item.id === "number" &&
        typeof item.question === "string" &&
        Array.isArray(item.options) &&
        typeof item.answerIndex === "number",
    )
    .map((item: any) => ({
      id: item.id,
      sceneTitle: typeof item.sceneTitle === "string" ? item.sceneTitle : "",
      question: item.question,
      options: item.options.filter((option: unknown) => typeof option === "string"),
      answerIndex: item.answerIndex,
      explanation: typeof item.explanation === "string" ? item.explanation : "",
    }));
  const essays = raw.quiz.essays
    .filter((item: any) => item && typeof item.id === "number" && typeof item.question === "string")
    .map((item: any) => ({
      id: item.id,
      sceneTitle: typeof item.sceneTitle === "string" ? item.sceneTitle : "",
      question: item.question,
      guidingThoughts: Array.isArray(item.guidingThoughts)
        ? item.guidingThoughts.filter((thought: unknown) => typeof thought === "string")
        : [],
      modelAnswer: typeof item.modelAnswer === "string" ? item.modelAnswer : "",
      rubric: typeof item.rubric === "string" ? item.rubric : "",
    }));
  return {
    kind: "panseolab-quiz",
    topic: typeof raw.topic === "string" ? raw.topic : "수업 퀴즈",
    quiz: { multipleChoice, essays },
  };
}

export function readQuizData(hash: string): string | null {
  if (!hash.startsWith(QUIZ_HASH_PREFIX)) return null;
  const data = hash.slice(QUIZ_HASH_PREFIX.length);
  return data ? data : null;
}
