import type { Beat } from "../types/project";

export interface SceneAudioResult {
  blob: Blob;
  duration: number;
  windows: [number, number][];
  source: "tts";
}

export async function generateSceneAudio(options: {
  apiKey: string;
  voice: string;
  ttsModel: string;
  beats: Pick<Beat, "narration">[];
  signal?: AbortSignal;
  onFallback?: (model: string) => void;
}): Promise<SceneAudioResult> {
  const { synthesizeNarration } = await import("./gemini");
  const result = await synthesizeNarration({
    apiKey: options.apiKey,
    text: options.beats.map((beat) => beat.narration).join(" "),
    beats: options.beats,
    voice: options.voice,
    ttsModel: options.ttsModel,
    signal: options.signal,
    onFallback: options.onFallback,
  });
  return {
    blob: result.blob,
    duration: result.duration,
    windows: result.windows,
    source: "tts",
  };
}
