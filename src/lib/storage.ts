import { createStore, del, get, set } from "idb-keyval";
import type { AssetMeta, DraftSnapshot, Project } from "../types/project";
import { DB_NAME, DRAFT_KEY } from "../data/presets";
import { blobUrlFor } from "./blobUrls";
import { migrateStoredProject } from "./migrations";

const store = createStore(DB_NAME, "projects");
const HISTORY_KEY = "draft:history";
const SNAPSHOT_LIMIT = 10;

function stripAssetUrls(
  assets: Record<string, AssetMeta>,
): Record<string, AssetMeta> {
  const next: Record<string, AssetMeta> = {};
  for (const [id, asset] of Object.entries(assets ?? {})) {
    next[id] = { ...asset, url: undefined };
  }
  return next;
}

function stripUrls(project: Project): Project {
  return {
    ...project,
    assets: stripAssetUrls(project.assets ?? {}),
    scenes: project.scenes.map((scene) => ({
      ...scene,
      audioUrl: undefined,
    })),
  };
}

function stripAudio(project: Project): Project {
  return {
    ...stripUrls(project),
    scenes: project.scenes.map((scene) => ({
      ...scene,
      audioBlob: undefined,
      audioUrl: undefined,
      audioSource: "none" as const,
      audioTextHash: scene.audioTextHash,
    })),
  };
}

function hydrateUrls(project: Project): Project {
  const assets: Record<string, AssetMeta> = {};
  for (const [id, asset] of Object.entries(project.assets ?? {})) {
    assets[id] = {
      ...asset,
      url: asset.blob ? blobUrlFor(asset.blob) : undefined,
    };
  }
  return {
    ...project,
    assets,
    scenes: project.scenes.map((scene) => ({
      ...scene,
      audioUrl:
        scene.audioBlob && scene.audioSource !== "none"
          ? blobUrlFor(scene.audioBlob)
          : undefined,
    })),
  };
}

export async function saveDraft(project: Project): Promise<void> {
  await set(DRAFT_KEY, stripUrls({ ...project, savedAt: new Date().toISOString() }), store);
}

export async function loadDraft(): Promise<Project | null> {
  const stored = await get<Project>(DRAFT_KEY, store);
  if (!stored) return null;
  return hydrateUrls(migrateStoredProject(stored));
}

export async function hasDraft(): Promise<boolean> {
  const stored = await get<Project>(DRAFT_KEY, store);
  return Boolean(stored);
}

export async function deleteDraft(): Promise<void> {
  await del(DRAFT_KEY, store);
}

export async function listSnapshots(): Promise<DraftSnapshot[]> {
  const stored = await get<DraftSnapshot[]>(HISTORY_KEY, store);
  if (!Array.isArray(stored)) return [];
  return stored;
}

export async function createSnapshot(
  project: Project,
  label: string,
  includeAudio = false,
): Promise<DraftSnapshot[]> {
  const snapshot: DraftSnapshot = {
    id: `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    savedAt: new Date().toISOString(),
    label,
    sceneCount: project.scenes.length,
    includesAudio: includeAudio,
    project: stripUrls(includeAudio ? project : stripAudio(project)),
  };
  const existing = await listSnapshots();
  const next = [snapshot, ...existing].slice(0, SNAPSHOT_LIMIT);
  try {
    await set(HISTORY_KEY, next, store);
    return next;
  } catch (error) {
    if (next.length <= 2) throw error;
    const trimmed = next.slice(0, Math.max(2, Math.floor(next.length / 2)));
    await set(HISTORY_KEY, trimmed, store);
    return trimmed;
  }
}

export async function restoreSnapshot(id: string): Promise<Project | null> {
  const snapshots = await listSnapshots();
  const snapshot = snapshots.find((item) => item.id === id);
  if (!snapshot) return null;
  return hydrateUrls(migrateStoredProject(snapshot.project));
}

export async function deleteSnapshot(id: string): Promise<DraftSnapshot[]> {
  const snapshots = await listSnapshots();
  const next = snapshots.filter((item) => item.id !== id);
  await set(HISTORY_KEY, next, store);
  return next;
}

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const estimate = await navigator.storage.estimate();
  return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
}
