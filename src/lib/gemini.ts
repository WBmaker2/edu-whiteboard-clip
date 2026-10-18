import type { Beat, Scene } from "../types/project";
import {
  MODEL_FALLBACKS,
  TTS_FALLBACKS,
} from "../data/presets";
import {
  buildScenesFromSeeds,
  normalizeStoryboard,
  storyboardPrompt,
  type SceneSeed,
} from "./storyboard";
import type { CurriculumContext } from "../data/curriculum";
import {
  base64ToBytes,
  computeWindowsFromPcm,
  fallbackWindows,
  pcmDuration,
  pcmToWav,
} from "./tts";
import { backoffMs, geminiQueue, retryAfterMs } from "./geminiQueue";
import { recordCall } from "./requestBudget";

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta";

export function redactKey(message: string, apiKey?: string): string {
  let result = String(message ?? "");
  if (apiKey && apiKey.trim().length > 5) {
    result = result.split(apiKey.trim()).join("[PROTECTED_API_KEY]");
  }
  result = result.replace(/AIzaSy[A-Za-z0-9_-]{33}/g, "[PROTECTED_API_KEY]");
  result = result.replace(/key=[A-Za-z0-9_-]+/g, "key=[PROTECTED_API_KEY]");
  return result;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

function candidateText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function errorMessage(payload: any): string {
  return payload?.error?.message ?? "";
}

export interface GeminiCallOptions {
  apiKey: string;
  model: string;
  fallbacks: string[];
  body: unknown;
  onFallback?: (model: string) => void;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 120_000;

export async function callGemini({
  apiKey,
  model,
  fallbacks,
  body,
  onFallback,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal,
}: GeminiCallOptions): Promise<{ data: any; modelUsed: string }> {
  const key = apiKey.trim();
  if (!key) throw new Error("Gemini API 키를 입력해 주세요.");
  const chain = [model, ...fallbacks].filter(
    (item, index, list) => item && list.indexOf(item) === index,
  );
  let lastError: Error | null = null;

  for (const current of chain) {
    const isPrimary = current === model;
    const attempts = isPrimary ? 3 : 2;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await geminiQueue.run(
          (queueSignal) => {
            recordCall();
            return fetch(
              `${API_ROOT}/models/${encodeURIComponent(current)}:generateContent`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-goog-api-key": key,
                },
                body: JSON.stringify(body),
                signal: queueSignal,
              },
            );
          },
          { timeoutMs, signal },
        );
        if (response.ok) {
          const data = await response.json();
          if (!isPrimary) onFallback?.(current);
          return { data, modelUsed: current };
        }
        const payload = await response.json().catch(() => ({}));
        const message = redactKey(
          errorMessage(payload) || `상태 코드 ${response.status}`,
          key,
        );
        if (response.status === 400 || response.status === 403) {
          throw new Error(
            `API 키 인증 실패 또는 요청 오류 (${response.status}): 올바른 Gemini API 키인지 확인해 주세요.`,
          );
        }
        if (
          response.status === 404 ||
          /not found|no longer available|not supported|unsupported/i.test(message)
        ) {
          lastError = new Error(`[${current}] ${message}`);
          break;
        }
        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(`[${current}] 일시적 사용량 초과 또는 서버 지연: ${message}`);
          if (attempt < attempts) {
            const wait = response.status === 429 ? retryAfterMs(response) : null;
            await sleep(wait ?? backoffMs(attempt));
            continue;
          }
          break;
        }
        throw new Error(`Gemini API 오류 (${current}): ${message}`);
      } catch (error) {
        if (
          error instanceof DOMException &&
          (error.name === "AbortError" || error.name === "TimeoutError")
        ) {
          throw error;
        }
        const message = redactKey(
          error instanceof Error ? error.message : String(error),
          key,
        );
        if (message.includes("API 키 인증 실패") || message.includes("Gemini API 오류")) {
          throw new Error(message);
        }
        lastError = new Error(message);
        if (attempt < attempts) {
          await sleep(backoffMs(attempt, 700));
        }
      }
    }
  }
  throw new Error(
    redactKey(
      lastError?.message ||
        `Gemini API 호출에 실패했습니다. 시도 모델: ${chain.join(", ")}`,
      key,
    ),
  );
}

export async function checkApiKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  const key = apiKey.trim();
  if (!key) return { ok: false, message: "API 키를 입력해 주세요." };
  const timeoutSignal =
    typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(15_000)
      : undefined;
  try {
    const response = await fetch(`${API_ROOT}/models?pageSize=1`, {
      headers: { "x-goog-api-key": key },
      signal: timeoutSignal,
    });
    if (response.ok) {
      return { ok: true, message: "API 키가 유효합니다. 영상 생성을 시작할 수 있어요." };
    }
    if (response.status === 400 || response.status === 403) {
      return { ok: false, message: "API 키 인증에 실패했습니다. 키를 다시 확인해 주세요." };
    }
    const payload = await response.json().catch(() => ({}));
    return {
      ok: false,
      message: `키 확인 중 오류가 발생했습니다 (${response.status}): ${redactKey(
        errorMessage(payload),
        key,
      )}`,
    };
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      return {
        ok: false,
        message: "키 확인 요청이 시간 안에 끝나지 않았습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
      };
    }
    return {
      ok: false,
      message: `네트워크 오류로 키를 확인하지 못했습니다: ${redactKey(
        error instanceof Error ? error.message : String(error),
        key,
      )}`,
    };
  }
}

export async function generateStoryboard(options: {
  apiKey: string;
  topic: string;
  model: string;
  curriculum?: CurriculumContext;
  onFallback?: (model: string) => void;
  signal?: AbortSignal;
}): Promise<{ scenes: Scene[]; modelUsed: string }> {
  const { data, modelUsed } = await callGemini({
    apiKey: options.apiKey,
    model: options.model,
    fallbacks: MODEL_FALLBACKS,
    onFallback: options.onFallback,
    signal: options.signal,
    body: {
      contents: [{ parts: [{ text: storyboardPrompt(options.topic, options.curriculum) }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.75,
      },
    },
  });
  const raw = candidateText(data);
  if (!raw) throw new Error("스토리보드 응답이 비어 있습니다. 다시 시도해 주세요.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());
  } catch {
    throw new Error("스토리보드 JSON을 해석하지 못했습니다. 다시 생성해 주세요.");
  }
  const seeds: SceneSeed[] = normalizeStoryboard(parsed);
  return { scenes: buildScenesFromSeeds(seeds), modelUsed };
}

export interface TtsResult {
  blob: Blob;
  duration: number;
  windows: [number, number][];
  modelUsed: string;
}

export async function synthesizeNarration(options: {
  apiKey: string;
  text: string;
  beats: Pick<Beat, "narration">[];
  voice: string;
  ttsModel: string;
  onFallback?: (model: string) => void;
  signal?: AbortSignal;
}): Promise<TtsResult> {
  const { data, modelUsed } = await callGemini({
    apiKey: options.apiKey,
    model: options.ttsModel,
    fallbacks: TTS_FALLBACKS,
    onFallback: options.onFallback,
    timeoutMs: 180_000,
    signal: options.signal,
    body: {
      contents: [
        {
          parts: [
            {
              text: `Read the following Korean lesson narration in a warm, clear teacher voice. Keep natural pauses between sentences.\n\n${options.text}`,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: options.voice },
          },
        },
      },
    },
  });
  const parts = data?.candidates?.[0]?.content?.parts;
  const inline = Array.isArray(parts)
    ? parts.find((part: any) => part?.inlineData?.data)?.inlineData?.data
    : null;
  if (!inline) throw new Error("음성 데이터를 받지 못했습니다. 잠시 후 다시 시도해 주세요.");
  const pcm = base64ToBytes(inline);
  const blob = pcmToWav(pcm);
  const duration = pcmDuration(pcm);
  const windows =
    computeWindowsFromPcm(pcm, options.beats) ?? fallbackWindows(options.beats, duration);
  return { blob, duration, windows, modelUsed };
}

export async function translateNarrations(options: {
  apiKey: string;
  model: string;
  scenes: Scene[];
  lang: string;
  onFallback?: (model: string) => void;
  signal?: AbortSignal;
}): Promise<string[][]> {
  const payload = options.scenes.map((scene, index) => ({
    sceneIndex: index,
    narrations: scene.beats.map((beat) => beat.narration),
  }));
  const { data } = await callGemini({
    apiKey: options.apiKey,
    model: options.model,
    fallbacks: MODEL_FALLBACKS,
    onFallback: options.onFallback,
    signal: options.signal,
    body: {
      contents: [
        {
          parts: [
            {
              text: `Translate the following Korean lesson narrations into the language code "${options.lang}".
Keep the meaning, tone and sentence count exactly. Return strict JSON only:
{"scenes":[{"sceneIndex":0,"narrations":["...","...","..."]}]}

${JSON.stringify(payload)}`,
            },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    },
  });
  const raw = candidateText(data);
  if (!raw) throw new Error("번역 결과가 비어 있습니다.");
  const parsed = JSON.parse(
    raw.replace(/```json/gi, "").replace(/```/g, "").trim(),
  );
  const rows = Array.isArray(parsed?.scenes) ? parsed.scenes : [];
  return options.scenes.map((scene, index) => {
    const row = rows.find((item: any) => item?.sceneIndex === index);
    const narrations = Array.isArray(row?.narrations) ? row.narrations : [];
    return scene.beats.map(
      (beat, beatIndex) =>
        (typeof narrations[beatIndex] === "string" && narrations[beatIndex]) ||
        beat.narration,
    );
  });
}

export async function gradeEssay(options: {
  apiKey: string;
  model: string;
  question: string;
  rubric: string;
  modelAnswer: string;
  answer: string;
}): Promise<{ score: number; feedback: string }> {
  if (!options.answer.trim()) {
    return { score: 0, feedback: "답안이 비어 있습니다. 핵심 원리를 한두 문장으로 정리해 보세요." };
  }
  const { data } = await callGemini({
    apiKey: options.apiKey,
    model: options.model,
    fallbacks: MODEL_FALLBACKS,
    body: {
      contents: [
        {
          parts: [
            {
              text: `You are a Korean teacher grading a short essay.
Question: ${options.question}
Rubric: ${options.rubric}
Model answer: ${options.modelAnswer}
Student answer: ${options.answer}

Return strict JSON only: {"score": number (0-10), "feedback": "2-3 sentences of warm Korean feedback"}`,
            },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
    },
  });
  const raw = candidateText(data);
  if (!raw) throw new Error("채점 결과가 비어 있습니다.");
  const parsed = JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());
  const score = Math.max(0, Math.min(10, Number(parsed?.score) || 0));
  return {
    score,
    feedback:
      typeof parsed?.feedback === "string" && parsed.feedback.trim()
        ? parsed.feedback.trim()
        : "답안을 바탕으로 기본 점수를 반영했습니다.",
  };
}
