import type { Beat, Project, Scene } from "../types/project";

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function easeOutCubic(t: number): number {
  const x = clamp(t);
  return 1 - Math.pow(1 - x, 3);
}

export function projectDuration(project: Pick<Project, "scenes">): number {
  return project.scenes.reduce((sum, scene) => sum + Math.max(0.1, scene.duration), 0);
}

export function sceneStart(scenes: Scene[], index: number): number {
  let start = 0;
  for (let i = 0; i < index; i += 1) start += Math.max(0.1, scenes[i].duration);
  return start;
}

export function locateTime(
  scenes: Scene[],
  time: number,
): { index: number; localTime: number } {
  if (scenes.length === 0) return { index: 0, localTime: 0 };
  let cursor = 0;
  for (let i = 0; i < scenes.length; i += 1) {
    const duration = Math.max(0.1, scenes[i].duration);
    if (time < cursor + duration || i === scenes.length - 1) {
      return { index: i, localTime: Math.max(0, time - cursor) };
    }
    cursor += duration;
  }
  return { index: scenes.length - 1, localTime: 0 };
}

export function buildWindows(beats: Beat[], duration: number): [number, number][] {
  const weights = beats.map((beat) => Math.max(1, beat.narration.length));
  const total = weights.reduce((sum, value) => sum + value, 0);
  const windows: [number, number][] = [];
  let cursor = 0;
  for (let i = 0; i < beats.length; i += 1) {
    const slice = (duration * weights[i]) / total;
    const start = Number(cursor.toFixed(2));
    cursor += slice;
    windows.push([start, Number(cursor.toFixed(2))]);
  }
  return windows;
}

export function activeBeatIndex(scene: Scene, localTime: number): number {
  for (let i = 0; i < scene.windows.length; i += 1) {
    const [start, end] = scene.windows[i];
    if (localTime >= start && localTime <= end) return i;
  }
  return Math.max(0, scene.windows.length - 1);
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = Math.floor(safe % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function formatSrtTime(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
    secs,
  ).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
