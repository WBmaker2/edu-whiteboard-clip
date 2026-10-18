import type { Beat, Project, Scene, SceneType } from "../types/project";
import { SCENE_LIMITS } from "../data/presets";
import { buildWindows, uid } from "./time";
import { blobUrlFor } from "./blobUrls";

export function sceneTextHash(beats: Beat[]): string {
  const text = beats
    .map((beat) => `${beat.label}|${beat.desc}|${beat.narration}`)
    .join("\n");
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export function isAudioStale(scene: Scene): boolean {
  if (!scene.audioSource || scene.audioSource === "none") return false;
  if (!scene.audioTextHash) return false;
  return scene.audioTextHash !== sceneTextHash(scene.beats);
}

export function recomputeScene(scene: Scene, beats: Beat[] = scene.beats): Scene {
  return {
    ...scene,
    beats,
    windows: buildWindows(beats, scene.duration),
    updatedAt: new Date().toISOString(),
  };
}

export function defaultBeat(index: number): Beat {
  return {
    id: uid("beat"),
    label: `핵심 포인트 ${index + 1}`,
    desc: "내용을 입력하세요",
    narration: "이 장면에서 설명할 핵심 내용을 입력하세요.",
    iconType: index === 0 ? "Lightbulb" : index === 1 ? "Zap" : "Check",
  };
}

export function defaultScene(type: SceneType): Scene {
  const beats = [defaultBeat(0), defaultBeat(1), defaultBeat(2)];
  const duration = 8;
  return {
    id: uid("scene"),
    type,
    title: type === "intro" ? "새 도입 장면" : type === "outro" ? "새 정리 장면" : "새 장면",
    subtitle: "이 장면의 핵심 내용을 한 문장으로 정리합니다.",
    beats,
    duration,
    windows: buildWindows(beats, duration),
    audioSource: "none",
    updatedAt: new Date().toISOString(),
  };
}

export function canAddScene(project: Project): boolean {
  return project.scenes.length < SCENE_LIMITS.maxScenes;
}

export function canDeleteScene(project: Project): boolean {
  return project.scenes.length > SCENE_LIMITS.minScenes;
}

export function canAddBeat(scene: Scene): boolean {
  return scene.beats.length < SCENE_LIMITS.maxBeats;
}

export function canDeleteBeat(scene: Scene): boolean {
  return scene.beats.length > SCENE_LIMITS.minBeats;
}

function commit(project: Project, scenes: Scene[]): Project {
  return { ...project, scenes, savedAt: new Date().toISOString() };
}

export function addScene(
  project: Project,
  afterIndex: number,
  seed?: Partial<Pick<Scene, "type" | "title" | "subtitle" | "beats" | "duration">>,
): Project {
  if (!canAddScene(project)) return project;
  const index = Math.max(0, Math.min(project.scenes.length - 1, afterIndex));
  const scene = { ...defaultScene(seed?.type ?? "body"), ...seed };
  scene.windows = buildWindows(scene.beats, scene.duration);
  const scenes = [...project.scenes];
  scenes.splice(index + 1, 0, scene);
  return commit(project, scenes);
}

export function deleteScene(project: Project, index: number): Project {
  if (!canDeleteScene(project)) return project;
  if (index < 0 || index >= project.scenes.length) return project;
  return commit(
    project,
    project.scenes.filter((_, sceneIndex) => sceneIndex !== index),
  );
}

export function duplicateScene(project: Project, index: number): Project {
  if (!canAddScene(project)) return project;
  const source = project.scenes[index];
  if (!source) return project;
  const beats = source.beats.map((beat) => ({ ...beat, id: uid("beat") }));
  const copy: Scene = {
    ...source,
    id: uid("scene"),
    beats,
    windows: buildWindows(beats, source.duration),
    audioBlob: undefined,
    audioUrl: undefined,
    audioSource: "none",
    audioTextHash: undefined,
    updatedAt: new Date().toISOString(),
  };
  const scenes = [...project.scenes];
  scenes.splice(index + 1, 0, copy);
  return commit(project, scenes);
}

export function moveScene(project: Project, from: number, to: number): Project {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= project.scenes.length ||
    to >= project.scenes.length
  ) {
    return project;
  }
  const scenes = [...project.scenes];
  const [scene] = scenes.splice(from, 1);
  scenes.splice(to, 0, scene);
  return commit(project, scenes);
}

export function setSceneType(project: Project, index: number, type: SceneType): Project {
  const scene = project.scenes[index];
  if (!scene || scene.type === type) return project;
  return replaceSceneContent(project, index, { type });
}

export function addBeat(
  project: Project,
  sceneIndex: number,
  afterBeatIndex?: number,
): Project {
  const scene = project.scenes[sceneIndex];
  if (!scene || !canAddBeat(scene)) return project;
  const beats = [...scene.beats];
  const insertAt =
    afterBeatIndex === undefined
      ? beats.length
      : Math.max(0, Math.min(beats.length, afterBeatIndex + 1));
  beats.splice(insertAt, 0, defaultBeat(insertAt));
  const scenes = project.scenes.map((item, index) =>
    index === sceneIndex ? recomputeScene(item, beats) : item,
  );
  return commit(project, scenes);
}

export function deleteBeat(project: Project, sceneIndex: number, beatIndex: number): Project {
  const scene = project.scenes[sceneIndex];
  if (!scene || !canDeleteBeat(scene)) return project;
  const beats = scene.beats.filter((_, index) => index !== beatIndex);
  const scenes = project.scenes.map((item, index) =>
    index === sceneIndex ? recomputeScene(item, beats) : item,
  );
  return commit(project, scenes);
}

export function moveBeat(
  project: Project,
  sceneIndex: number,
  from: number,
  to: number,
): Project {
  const scene = project.scenes[sceneIndex];
  if (!scene || from === to) return project;
  if (from < 0 || to < 0 || from >= scene.beats.length || to >= scene.beats.length) {
    return project;
  }
  const beats = [...scene.beats];
  const [beat] = beats.splice(from, 1);
  beats.splice(to, 0, beat);
  const scenes = project.scenes.map((item, index) =>
    index === sceneIndex ? recomputeScene(item, beats) : item,
  );
  return commit(project, scenes);
}

export function replaceSceneContent(
  project: Project,
  sceneIndex: number,
  content: Partial<Pick<Scene, "type" | "title" | "subtitle" | "beats" | "duration" | "windows">>,
): Project {
  const scene = project.scenes[sceneIndex];
  if (!scene) return project;
  const beats = content.beats ?? scene.beats;
  const duration = content.duration ?? scene.duration;
  const next: Scene = {
    ...scene,
    ...content,
    beats,
    duration,
    windows: content.windows ?? buildWindows(beats, duration),
    updatedAt: new Date().toISOString(),
  };
  const scenes = project.scenes.map((item, index) => (index === sceneIndex ? next : item));
  return commit(project, scenes);
}

export function withSceneAudio(
  project: Project,
  sceneIndex: number,
  audio: { blob: Blob; duration: number; windows?: [number, number][]; source: "tts" | "recorded" },
): Project {
  const scene = project.scenes[sceneIndex];
  if (!scene) return project;
  const next: Scene = {
    ...scene,
    audioBlob: audio.blob,
    audioUrl: blobUrlFor(audio.blob),
    audioSource: audio.source,
    audioTextHash: sceneTextHash(scene.beats),
    duration: audio.duration,
    windows: audio.windows ?? buildWindows(scene.beats, audio.duration),
    updatedAt: new Date().toISOString(),
  };
  const scenes = project.scenes.map((item, index) => (index === sceneIndex ? next : item));
  return commit(project, scenes);
}

export function applySceneRewrite(
  project: Project,
  sceneIndex: number,
  content: { title: string; subtitle: string; beats: Beat[] },
  audio?: {
    blob: Blob;
    duration: number;
    windows?: [number, number][];
    source: "tts" | "recorded";
  },
): Project {
  const scene = project.scenes[sceneIndex];
  if (!scene) return project;
  const duration = audio?.duration ?? scene.duration;
  const next: Scene = {
    ...scene,
    title: content.title,
    subtitle: content.subtitle,
    beats: content.beats,
    duration,
    windows: audio?.windows ?? buildWindows(content.beats, duration),
    updatedAt: new Date().toISOString(),
    ...(audio
      ? {
          audioBlob: audio.blob,
          audioUrl: blobUrlFor(audio.blob),
          audioSource: audio.source,
          audioTextHash: sceneTextHash(content.beats),
        }
      : {}),
  };
  const scenes = project.scenes.map((item, index) => (index === sceneIndex ? next : item));
  return commit(project, scenes);
}
