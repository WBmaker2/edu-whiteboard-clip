import type { Project, Scene } from "../../types/project";
import { sceneTextHash } from "../sceneOps";
import { audioUrlFor } from "../audioUrls";

interface SerializedScene extends Omit<Scene, "audioBlob" | "audioUrl"> {
  audioBase64?: string;
  audioMime?: string;
}

interface SerializedProject extends Omit<Project, "scenes"> {
  scenes: SerializedScene[];
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
  const payload: SerializedProject = {
    ...project,
    savedAt: new Date().toISOString(),
    scenes,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseProjectJson(text: string): Project {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("프로젝트 파일을 읽지 못했습니다. JSON 형식을 확인해 주세요.");
  }
  if (!raw || raw.version !== 1 || !Array.isArray(raw.scenes) || raw.scenes.length === 0) {
    throw new Error("판서랩 프로젝트 파일 형식이 아닙니다.");
  }
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
      audioUrl: audioBlob ? audioUrlFor(audioBlob) : undefined,
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
    version: 1,
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

export async function downloadProject(project: Project): Promise<void> {
  const json = await serializeProject(project, true);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeTopic = (project.topic || "whiteboard_lesson")
    .replace(/[^\w\s가-힣-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);
  anchor.href = url;
  anchor.download = `${safeTopic || "whiteboard_lesson"}_${Date.now()}.panseolab.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
