import type { Beat, Scene, SceneType } from "../types/project";
import { ICON_FALLBACK, ICON_KEYS } from "../data/presets";
import { curriculumPromptBlock, type CurriculumContext } from "../data/curriculum";
import { buildWindows, uid } from "./time";

export interface SceneSeed {
  type: SceneType;
  title: string;
  subtitle: string;
  beats: Omit<Beat, "id">[];
}

export function storyboardPrompt(
  topic: string,
  curriculum?: CurriculumContext,
): string {
  return `You are an instructional designer creating a whiteboard explainer video for students.
Write a complete, pedagogical lesson script as strict JSON for this topic: "${topic}".
${curriculumPromptBlock(curriculum)}
Lesson structure (5 scenes when possible):
1. Scene 1 (intro): a hook question and the learning goal.
2. Scene 2 (body): the foundational concept.
3. Scene 3 (body): the step-by-step core mechanism.
4. Scene 4 (body): a real-world application or extension.
5. Scene 5 (outro): a summary and a warm closing.

Return a JSON array. Each item must have:
- "type": "intro" | "body" | "outro"
- "title": a short Korean title
- "subtitle": one Korean sentence that summarizes the scene
- "beats": exactly 3 items, each with:
  - "label": a Korean keyword of 2-4 words
  - "desc": a Korean description of 4-7 words
  - "narration": one natural spoken Korean sentence of 15-25 words
  - "iconType": one of ${ICON_KEYS.map((key) => `"${key}"`).join(", ")}

Rules:
- Write only Korean for title, subtitle, label, desc and narration.
- Keep the narration friendly and easy to read aloud.
- Do not use markdown, code fences or commentary. Return the JSON array only.`;
}

const ICON_LOOKUP = new Map(ICON_KEYS.map((key) => [key.toLowerCase(), key]));

export function normalizeIcon(value: unknown): string {
  if (typeof value !== "string") return ICON_FALLBACK;
  const cleaned = value.replace(/[\s_-]/g, "").toLowerCase();
  for (const [key, icon] of ICON_LOOKUP) {
    if (key.replace(/[\s_-]/g, "").toLowerCase() === cleaned) return icon;
  }
  return ICON_FALLBACK;
}

function text(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

export function normalizeBeat(raw: unknown, index: number): Omit<Beat, "id"> {
  const record = (raw ?? {}) as Record<string, unknown>;
  return {
    label: text(record.label, `핵심 포인트 ${index + 1}`),
    desc: text(record.desc, "핵심 내용 정리"),
    narration: text(record.narration, "이 장면의 핵심 내용을 차분히 살펴봅니다."),
    iconType: normalizeIcon(record.iconType),
  };
}

function sceneType(raw: unknown, index: number, total: number): SceneType {
  if (raw === "intro" || raw === "body" || raw === "outro") return raw;
  if (index === 0) return "intro";
  if (index === total - 1) return "outro";
  return "body";
}

export function normalizeSceneSeed(
  raw: unknown,
  index: number,
  total: number,
  fallbackType?: SceneType,
): SceneSeed {
  const record = (raw ?? {}) as Record<string, unknown>;
  const rawBeats = Array.isArray(record.beats) ? record.beats.slice(0, 5) : [];
  const target = Math.min(5, Math.max(2, rawBeats.length || 3));
  const beats = Array.from({ length: target }, (_, beatIndex) =>
    normalizeBeat(rawBeats[beatIndex], beatIndex),
  );
  return {
    type: fallbackType ?? sceneType(record.type, index, total),
    title: text(record.title, `${index + 1}단계 학습 내용`),
    subtitle: text(record.subtitle, "이 단계의 핵심 내용을 정리합니다."),
    beats,
  };
}

export function normalizeStoryboard(raw: unknown): SceneSeed[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.scenes)) list = record.scenes;
    else if (Array.isArray(record.storyboard)) list = record.storyboard;
  }
  if (list.length < 3) {
    throw new Error("스토리보드 씬이 너무 적습니다. 다시 생성해 주세요.");
  }
  const trimmed = list.slice(0, 7);
  return trimmed.map((item, index) =>
    normalizeSceneSeed(item, index, trimmed.length),
  );
}

export function estimateSceneDuration(beats: Omit<Beat, "id">[]): number {
  const characters = beats.reduce(
    (sum, beat) => sum + beat.narration.replace(/\s/g, "").length,
    0,
  );
  return Math.min(18, Math.max(7, Number((characters / 4.2).toFixed(1))));
}

export function buildScenesFromSeeds(seeds: SceneSeed[]): Scene[] {
  return seeds.map((seed, sceneIndex) => {
    const beats: Beat[] = seed.beats.map((beat) => ({
      id: uid(`beat_${sceneIndex}`),
      ...beat,
    }));
    const duration = estimateSceneDuration(seed.beats);
    return {
      id: uid(`scene_${sceneIndex}`),
      type: seed.type,
      title: seed.title,
      subtitle: seed.subtitle,
      beats,
      duration,
      windows: buildWindows(beats, duration),
      audioSource: "none",
    };
  });
}
