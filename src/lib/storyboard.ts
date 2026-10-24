import type { Beat, Scene, SceneLayout, SceneType, ThemeId, VisualStyle } from "../types/project";
import { ICON_FALLBACK, ICON_KEYS, SCENE_LAYOUT_KEYS } from "../data/presets";
import { curriculumPromptBlock, type CurriculumContext } from "../data/curriculum";
import { buildWindows, uid } from "./time";

export interface SceneSeed {
  type: SceneType;
  title: string;
  subtitle: string;
  beats: Omit<Beat, "id">[];
  layout?: SceneLayout;
}

export interface StoryboardStyleHint {
  themeId?: ThemeId;
  visualStyle?: VisualStyle;
}

export interface StoryboardResult {
  seeds: SceneSeed[];
  styleHint?: StoryboardStyleHint;
}

const THEME_IDS: ThemeId[] = ["paper", "blueprint", "editorial", "midnight"];
const VISUAL_IDS: VisualStyle[] = ["diagram", "illustration", "marker"];

export function storyboardPrompt(
  topic: string,
  curriculum?: CurriculumContext,
): string {
  return `You are an instructional designer creating a whiteboard explainer video for students.
Write a complete, pedagogical lesson script as strict JSON for this topic: "${topic}".
${curriculumPromptBlock(curriculum)}
Plan 3 to 7 scenes that fit the topic. A typical lesson uses 4-6:
- The first scene is the intro: a hook question and the learning goal.
- Middle scenes are the body: break the topic into however many ideas it truly needs.
- The last scene is the outro: a summary and a warm closing.
Choose the number of scenes and the number of beats per scene (2 to 5) to match how much the topic actually needs. Do not force a fixed count.

Return a JSON object with:
- "style": an optional object suggesting the overall look, with
  - "theme": one of "paper" | "blueprint" | "editorial" | "midnight"
  - "visual": one of "diagram" | "illustration" | "marker"
  Pick the theme and visual that best suit the subject (e.g. engineering/physics/math → blueprint+diagram, history/literature/social → editorial+illustration, computer science/AI → midnight+marker, biology/earth science → paper+illustration). Omit it if unsure.
- "scenes": an array. Each item must have:
  - "type": "intro" | "body" | "outro"
  - "title": a short Korean title
  - "subtitle": one Korean sentence that summarizes the scene
  - "layout": the best visual layout for THIS scene's content, one of ${SCENE_LAYOUT_KEYS.map((key) => `"${key}"`).join(", ")}
  - "beats": 2 to 5 items, each with:
    - "label": a Korean keyword of 2-4 words
    - "desc": a Korean description of 4-7 words
    - "narration": one natural spoken Korean sentence of 15-25 words
    - "iconType": one of ${ICON_KEYS.map((key) => `"${key}"`).join(", ")}

Choosing the scene "layout" (very important - vary it by content, do not repeat the same one every scene):
- sequential steps / how-to → "flow"
- one central idea with branches → "mindmap"
- before vs after, two sides or pros/cons → "comparison"
- one hero concept with supporting facts → "infographic"
- chronological history / a process over time → "timeline"
- a repeating loop (cycles, feedback) → "cycle"
- classification / levels / parts of a whole → "hierarchy"
- numbers, ratios or statistics → "chart"
- two overlapping concepts sharing features → "venn"

Rules:
- Write only Korean for title, subtitle, label, desc and narration.
- Keep the narration friendly and easy to read aloud.
- Do not use markdown, code fences or commentary. Return the JSON object only.`;
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

const LAYOUT_LOOKUP = new Map(
  SCENE_LAYOUT_KEYS.map((key) => [key.toLowerCase(), key]),
);

/** Returns a valid concrete scene layout, or undefined when the value is absent or unknown. */
export function normalizeSceneLayout(value: unknown): SceneLayout | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[\s_-]/g, "").toLowerCase();
  for (const [key, layout] of LAYOUT_LOOKUP) {
    if (key.replace(/[\s_-]/g, "").toLowerCase() === cleaned) return layout;
  }
  return undefined;
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
    layout: normalizeSceneLayout(record.layout),
  };
}

function normalizeStyleHint(raw: unknown): StoryboardStyleHint | undefined {
  const source = Array.isArray(raw)
    ? undefined
    : (raw as Record<string, unknown> | null)?.["style"];
  if (!source || typeof source !== "object") return undefined;
  const record = source as Record<string, unknown>;
  const themeId =
    typeof record.theme === "string" &&
    THEME_IDS.includes(record.theme as ThemeId)
      ? (record.theme as ThemeId)
      : undefined;
  const visualStyle =
    typeof record.visual === "string" &&
    VISUAL_IDS.includes(record.visual as VisualStyle)
      ? (record.visual as VisualStyle)
      : undefined;
  if (!themeId && !visualStyle) return undefined;
  return { themeId, visualStyle };
}

function rawSceneList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.scenes)) return record.scenes;
    if (Array.isArray(record.storyboard)) return record.storyboard;
  }
  return [];
}

export function normalizeStoryboardResult(raw: unknown): StoryboardResult {
  const list = rawSceneList(raw);
  if (list.length < 3) {
    throw new Error("storyboard.tooFew");
  }
  const trimmed = list.slice(0, 7);
  const seeds = trimmed.map((item, index) =>
    normalizeSceneSeed(item, index, trimmed.length),
  );
  const styleHint = normalizeStyleHint(raw);
  return styleHint ? { seeds, styleHint } : { seeds };
}

export function normalizeStoryboard(raw: unknown): SceneSeed[] {
  return normalizeStoryboardResult(raw).seeds;
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
      ...(seed.layout ? { layout: seed.layout } : {}),
    };
  });
}
