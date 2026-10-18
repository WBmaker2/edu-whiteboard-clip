import type { AssetMeta, AssetSource, Beat, Project, Scene } from "../../types/project";
import { sceneTextHash } from "../sceneOps";
import { blobUrlFor } from "../blobUrls";
import { downloadBlob, sanitizeFileName } from "../download";

interface SerializedScene extends Omit<Scene, "audioBlob" | "audioUrl"> {
  audioBase64?: string;
  audioMime?: string;
}

interface SerializedAsset extends Omit<AssetMeta, "blob" | "url"> {
  blobBase64?: string;
}

interface SerializedProject extends Omit<Project, "scenes" | "assets"> {
  scenes: SerializedScene[];
  assets: Record<string, SerializedAsset>;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mime = "audio/wav"): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

export async function serializeProject(
  project: Project,
  includeAudio = true,
): Promise<string> {
  const scenes: SerializedScene[] = await Promise.all(
    project.scenes.map(async (scene) => {
      const base: SerializedScene = {
        id: scene.id,
        type: scene.type,
        title: scene.title,
        subtitle: scene.subtitle,
        beats: scene.beats,
        duration: scene.duration,
        windows: scene.windows,
        audioSource: scene.audioSource,
      };
      if (includeAudio && scene.audioBlob) {
        base.audioBase64 = await blobToBase64(scene.audioBlob);
        base.audioMime = scene.audioBlob.type || "audio/wav";
      }
      return base;
    }),
  );
  const assets: Record<string, SerializedAsset> = {};
  for (const [id, asset] of Object.entries(project.assets ?? {})) {
    const serialized: SerializedAsset = {
      id: asset.id,
      kind: asset.kind,
      source: asset.source,
      mime: asset.mime,
      width: asset.width,
      height: asset.height,
      latex: asset.latex,
      name: asset.name,
    };
    if (includeAudio && asset.blob) {
      serialized.blobBase64 = await blobToBase64(asset.blob);
    }
    assets[id] = serialized;
  }
  const payload: SerializedProject = {
    ...project,
    savedAt: new Date().toISOString(),
    scenes,
    assets,
  };
  return JSON.stringify(payload, null, 2);
}

const ASSET_KINDS = ["image", "formula", "ai"];
const ASSET_SOURCES = ["upload", "formula", "ai"];

function parseAssets(raw: unknown): Record<string, AssetMeta> {
  if (!raw || typeof raw !== "object") return {};
  const assets: Record<string, AssetMeta> = {};
  for (const [id, value] of Object.entries(raw as Record<string, any>)) {
    if (!value || typeof value !== "object") continue;
    const kind = ASSET_KINDS.includes(value.kind) ? value.kind : "image";
    const source: AssetSource = ASSET_SOURCES.includes(value.source)
      ? value.source
      : kind === "formula"
        ? "formula"
        : "upload";
    const blob =
      typeof value.blobBase64 === "string" && value.blobBase64
        ? base64ToBlob(value.blobBase64, typeof value.mime === "string" ? value.mime : "image/png")
        : undefined;
    assets[id] = {
      id,
      kind,
      source,
      mime: typeof value.mime === "string" ? value.mime : "image/png",
      blob,
      url: blob ? blobUrlFor(blob) : undefined,
      width: Number(value.width) > 0 ? Number(value.width) : undefined,
      height: Number(value.height) > 0 ? Number(value.height) : undefined,
      latex: typeof value.latex === "string" ? value.latex : undefined,
      name: typeof value.name === "string" ? value.name : undefined,
    };
  }
  return assets;
}

export function parseProjectJson(text: string): Project {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("프로젝트 파일을 읽지 못했습니다. JSON 형식을 확인해 주세요.");
  }
  if (
    !raw ||
    (raw.version !== 1 && raw.version !== 2) ||
    !Array.isArray(raw.scenes) ||
    raw.scenes.length === 0
  ) {
    throw new Error("판서랩 프로젝트 파일 형식이 아닙니다.");
  }
  const assets = parseAssets(raw.assets);
  const parseVisual = (value: any): Beat["visual"] => {
    if (!value || typeof value !== "object") return undefined;
    if (value.kind !== "image" && value.kind !== "formula" && value.kind !== "ai") {
      return undefined;
    }
    if (typeof value.assetId !== "string" || !assets[value.assetId]) return undefined;
    return {
      kind: value.kind,
      assetId: value.assetId,
      caption: typeof value.caption === "string" ? value.caption : undefined,
    };
  };
  const scenes: Scene[] = raw.scenes.map((scene: any, index: number) => {
    if (
      !scene ||
      typeof scene.title !== "string" ||
      !Array.isArray(scene.beats) ||
      scene.beats.length === 0
    ) {
      throw new Error(`${index + 1}번째 씬의 데이터가 올바르지 않습니다.`);
    }
    const audioBlob =
      typeof scene.audioBase64 === "string" && scene.audioBase64
        ? base64ToBlob(scene.audioBase64, scene.audioMime || "audio/wav")
        : undefined;
    const beats = scene.beats.map((beat: any, beatIndex: number) => ({
      id: typeof beat.id === "string" ? beat.id : `beat_${index}_${beatIndex}`,
      label: typeof beat.label === "string" ? beat.label : `핵심 포인트 ${beatIndex + 1}`,
      desc: typeof beat.desc === "string" ? beat.desc : "",
      narration: typeof beat.narration === "string" ? beat.narration : "",
      iconType: typeof beat.iconType === "string" ? beat.iconType : "Lightbulb",
      visual: parseVisual(beat.visual),
    }));
    return {
      id: typeof scene.id === "string" ? scene.id : `scene_${index}`,
      type:
        scene.type === "intro" || scene.type === "body" || scene.type === "outro"
          ? scene.type
          : index === 0
            ? "intro"
            : index === raw.scenes.length - 1
              ? "outro"
              : "body",
      title: scene.title,
      subtitle: typeof scene.subtitle === "string" ? scene.subtitle : "",
      beats,
      duration: Number(scene.duration) > 0 ? Number(scene.duration) : 10,
      windows: Array.isArray(scene.windows) ? scene.windows : [],
      audioBlob,
      audioUrl: audioBlob ? blobUrlFor(audioBlob) : undefined,
      audioTextHash:
        audioBlob
          ? typeof scene.audioTextHash === "string"
            ? scene.audioTextHash
            : sceneTextHash(beats)
          : undefined,
      audioSource: audioBlob ? scene.audioSource ?? "tts" : "none",
    };
  });
  return {
    version: 2,
    aspect: raw.aspect === "9:16" ? "9:16" : "16:9",
    assets,
    topic: typeof raw.topic === "string" ? raw.topic : "불러온 프로젝트",
    themeId: raw.themeId ?? "paper",
    visualStyle: raw.visualStyle ?? "diagram",
    layoutStyle: raw.layoutStyle ?? "adaptive",
    voice: raw.voice ?? "Kore",
    model: raw.model ?? "gemini-3.8-flash",
    ttsModel: raw.ttsModel ?? "gemini-3.8-flash-tts",
    bgmId: raw.bgmId ?? "none",
    scenes,
    savedAt: new Date().toISOString(),
  };
}

export async function downloadProject(project: Project): Promise<number> {
  const json = await serializeProject(project, true);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  downloadBlob(blob, `${sanitizeFileName(project.topic)}_${Date.now()}.panseolab.json`);
  return blob.size;
}
