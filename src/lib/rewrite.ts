import type { Beat, Scene } from "../types/project";
import { ICON_KEYS, MODEL_FALLBACKS } from "../data/presets";
import { callGemini } from "./gemini";
import { normalizeBeat, normalizeIcon } from "./storyboard";
import { curriculumPromptBlock, type CurriculumContext } from "../data/curriculum";

export interface RewritePreset {
  id: string;
  label: string;
  prompt: string;
}

export const REWRITE_PRESETS: RewritePreset[] = [
  { id: "easier", label: "더 쉽게", prompt: "중학생도 이해할 수 있도록 쉬운 단어와 친근한 비유를 사용하세요." },
  { id: "shorter", label: "더 짧게", prompt: "군더더기를 덜어내고 문장을 짧고 간결하게 유지하세요." },
  { id: "example", label: "사례 중심", prompt: "일상생활의 구체적인 사례를 하나 이상 포함하세요." },
  { id: "visual", label: "시각자료 중심", prompt: "판서에 그리기 쉬운 시각적 장면과 아이콘을 강조하세요." },
  { id: "misconception", label: "오개념 교정", prompt: "학생들이 흔히 하는 오개념을 짚고 올바른 개념으로 이끄세요." },
];

export interface SceneRewriteContent {
  title: string;
  subtitle: string;
  beats: Omit<Beat, "id">[];
}

export interface RewriteSceneOptions {
  apiKey: string;
  model: string;
  topic: string;
  scene: Scene;
  sceneIndex: number;
  totalScenes: number;
  previousTitle?: string;
  nextTitle?: string;
  instruction: string;
  beatCount: number;
  curriculum?: CurriculumContext;
  onFallback?: (model: string) => void;
}

export function rewritePrompt(options: {
  topic: string;
  scene: Scene;
  sceneIndex: number;
  totalScenes: number;
  previousTitle?: string;
  nextTitle?: string;
  instruction: string;
  beatCount: number;
  curriculum?: CurriculumContext;
}): string {
  const current = {
    type: options.scene.type,
    title: options.scene.title,
    subtitle: options.scene.subtitle,
    beats: options.scene.beats.map((beat) => ({
      label: beat.label,
      desc: beat.desc,
      narration: beat.narration,
      iconType: beat.iconType,
    })),
  };
  return `You are revising ONE scene of a Korean whiteboard lesson about "${options.topic}".
Scene position: ${options.sceneIndex + 1} of ${options.totalScenes}.
${curriculumPromptBlock(options.curriculum)}Previous scene title: ${options.previousTitle ?? "(none)"}
Next scene title: ${options.nextTitle ?? "(none)"}
Current scene JSON:
${JSON.stringify(current)}

Instruction for the revision: ${options.instruction}

Requirements:
- Keep the scene type "${options.scene.type}" and stay on the same learning topic.
- Write Korean only for title, subtitle, label, desc and narration.
- Return strict JSON only, with no markdown or commentary:
{"title":"...","subtitle":"...","beats":[{"label":"...","desc":"...","narration":"...","iconType":"..."}]}
- Return exactly ${options.beatCount} beats.
- label: Korean keyword of 2-4 words.
- desc: Korean description of 4-7 words.
- narration: one natural spoken Korean sentence of 15-25 words.
- iconType must be one of: ${ICON_KEYS.map((key) => `"${key}"`).join(", ")}.
- Do not repeat sentences from the previous or next scene.`;
}

function text(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

export function normalizeSceneRewrite(
  raw: unknown,
  scene: Scene,
  beatCount = 3,
): SceneRewriteContent {
  const record = (raw ?? {}) as Record<string, unknown>;
  const target = Math.min(4, Math.max(2, beatCount));
  const rawBeats = Array.isArray(record.beats) ? record.beats : [];
  const beats: Omit<Beat, "id">[] = [];
  for (let index = 0; index < target; index += 1) {
    const source = rawBeats[index];
    if (source === undefined && scene.beats[index]) {
      const fallbackBeat = scene.beats[index];
      beats.push({
        label: fallbackBeat.label,
        desc: fallbackBeat.desc,
        narration: fallbackBeat.narration,
        iconType: normalizeIcon(fallbackBeat.iconType),
      });
    } else {
      beats.push(normalizeBeat(source, index));
    }
  }
  while (beats.length < 2) {
    const fallbackBeat = scene.beats[beats.length] ?? scene.beats[0];
    beats.push({
      label: fallbackBeat?.label ?? `핵심 포인트 ${beats.length + 1}`,
      desc: fallbackBeat?.desc ?? "핵심 내용 정리",
      narration: fallbackBeat?.narration ?? "이 장면의 핵심 내용을 살펴봅니다.",
      iconType: normalizeIcon(fallbackBeat?.iconType),
    });
  }
  return {
    title: text(record.title, scene.title),
    subtitle: text(record.subtitle, scene.subtitle),
    beats,
  };
}

export async function rewriteScene(
  options: RewriteSceneOptions,
): Promise<{ rewrite: SceneRewriteContent; modelUsed: string }> {
  const { data, modelUsed } = await callGemini({
    apiKey: options.apiKey,
    model: options.model,
    fallbacks: MODEL_FALLBACKS,
    onFallback: options.onFallback,
    body: {
      contents: [
        {
          parts: [
            {
              text: rewritePrompt({
                topic: options.topic,
                scene: options.scene,
                sceneIndex: options.sceneIndex,
                totalScenes: options.totalScenes,
                previousTitle: options.previousTitle,
                nextTitle: options.nextTitle,
                instruction: options.instruction,
                curriculum: options.curriculum,
                beatCount: options.beatCount,
              }),
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    },
  });
  const parts = data?.candidates?.[0]?.content?.parts;
  const raw = Array.isArray(parts)
    ? parts
        .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
        .join("")
        .trim()
    : "";
  if (!raw) throw new Error("rewrite.emptyResult");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());
  } catch {
    throw new Error("rewrite.invalidJson");
  }
  return {
    rewrite: normalizeSceneRewrite(parsed, options.scene, options.beatCount),
    modelUsed,
  };
}
