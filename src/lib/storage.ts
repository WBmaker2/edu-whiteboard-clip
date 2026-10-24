import {
  createStore,
  del,
  delMany,
  get,
  getMany,
  keys,
  set,
} from "idb-keyval";
import type {
  AssetMeta,
  DraftSnapshot,
  Project,
  ProjectSummary,
} from "../types/project";
import { DB_NAME, DRAFT_KEY } from "../data/presets";
import { blobUrlFor } from "./blobUrls";
import { migrateStoredProject } from "./migrations";
import { projectDuration, uid } from "./time";

const store = createStore(DB_NAME, "projects");
const HISTORY_KEY = "draft:history";
const SNAPSHOT_LIMIT = 10;
const PROJECT_PREFIX = "project:";
const META_SUFFIX = ":meta";
const HISTORY_SUFFIX = ":history";
const LAST_PROJECT_KEY = "app:lastProject";
const MIGRATION_KEY = "library:migrated:v1";

export function newProjectId(): string {
  return uid("lesson");
}

export function projectTitle(project: Pick<Project, "title" | "topic">): string {
  return project.title?.trim() || project.topic.trim() || "Untitled";
}

function projectKey(id: string): string {
  return `${PROJECT_PREFIX}${id}`;
}

function metaKey(id: string): string {
  return `${projectKey(id)}${META_SUFFIX}`;
}

function historyKey(id: string): string {
  return `${projectKey(id)}${HISTORY_SUFFIX}`;
}

function withIdentity(project: Project): Project & { id: string; title: string } {
  return {
    ...project,
    id: project.id?.trim() || newProjectId(),
    title: projectTitle(project),
  };
}

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

function normalize(project: Project): Project {
  const migrated = migrateStoredProject(project);
  return {
    ...migrated,
    id: migrated.id?.trim() || newProjectId(),
    title: projectTitle(migrated),
  };
}

function projectBytes(project: Project): number {
  const jsonBytes = JSON.stringify(stripUrls(project)).length * 2;
  let blobBytes = 0;
  for (const scene of project.scenes) blobBytes += scene.audioBlob?.size ?? 0;
  for (const asset of Object.values(project.assets ?? {})) {
    blobBytes += asset.blob?.size ?? 0;
  }
  return jsonBytes + blobBytes;
}

function buildSummary(project: Project, createdAt?: string): ProjectSummary {
  const identity = withIdentity(project);
  return {
    id: identity.id,
    title: identity.title,
    topic: project.topic,
    createdAt: createdAt ?? project.savedAt ?? new Date().toISOString(),
    updatedAt: project.savedAt ?? new Date().toISOString(),
    sceneCount: project.scenes.length,
    duration: projectDuration(project),
    aspect: project.aspect ?? "16:9",
    themeId: project.themeId,
    hasAudio: project.scenes.some(
      (scene) => Boolean(scene.audioBlob) || (scene.audioSource ?? "none") !== "none",
    ),
    bytes: projectBytes(project),
  };
}

export function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "QuotaExceededError" ||
    (error as Error & { code?: number }).code === 22 ||
    (error as Error & { code?: number }).code === 1014
  );
}

export async function saveProject(
  project: Project,
  setAsLast = true,
): Promise<Project> {
  const identity = withIdentity(project);
  const saved: Project = {
    ...identity,
    savedAt: new Date().toISOString(),
  };
  const existing = await get<ProjectSummary>(metaKey(identity.id), store);
  await set(projectKey(identity.id), stripUrls(saved), store);
  await set(
    metaKey(identity.id),
    buildSummary(saved, existing?.createdAt),
    store,
  );
  if (setAsLast) await setLastProjectId(identity.id);
  return saved;
}

export async function loadProjectById(id: string): Promise<Project | null> {
  const stored = await get<Project>(projectKey(id), store);
  if (!stored) return null;
  return hydrateUrls(normalize(stored));
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const allKeys = await keys<string>(store);
  const metaKeys = allKeys.filter(
    (key) =>
      typeof key === "string" &&
      key.startsWith(PROJECT_PREFIX) &&
      key.endsWith(META_SUFFIX),
  );
  if (metaKeys.length === 0) return [];
  const metas = await getMany<ProjectSummary>(metaKeys, store);
  return metas
    .filter((item): item is ProjectSummary => Boolean(item?.id))
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime(),
    );
}

export async function deleteProject(id: string): Promise<void> {
  await delMany([projectKey(id), metaKey(id), historyKey(id)], store);
  const last = await getLastProjectId();
  if (last === id) await del(LAST_PROJECT_KEY, store);
}

export async function renameProject(
  id: string,
  title: string,
): Promise<ProjectSummary | null> {
  const project = await loadProjectById(id);
  if (!project) return null;
  const saved = await saveProject(
    { ...project, title: title.trim() || project.title },
    false,
  );
  const meta = await get<ProjectSummary>(metaKey(id), store);
  return meta ?? buildSummary(saved);
}

export async function duplicateProject(
  id: string,
  copySuffix: string,
): Promise<ProjectSummary | null> {
  const project = await loadProjectById(id);
  if (!project) return null;
  const saved = await saveProject(
    {
      ...project,
      id: newProjectId(),
      title: `${projectTitle(project)} ${copySuffix}`.trim(),
      savedAt: new Date().toISOString(),
    },
    false,
  );
  return buildSummary(saved);
}

export async function setLastProjectId(id: string): Promise<void> {
  await set(LAST_PROJECT_KEY, id, store);
}

export async function getLastProjectId(): Promise<string | null> {
  const id = await get<string>(LAST_PROJECT_KEY, store);
  return typeof id === "string" && id ? id : null;
}

export async function getLastProjectSummary(): Promise<ProjectSummary | null> {
  const id = await getLastProjectId();
  if (!id) return null;
  return (await get<ProjectSummary>(metaKey(id), store)) ?? null;
}

export async function loadLastProject(): Promise<Project | null> {
  const id = await getLastProjectId();
  if (!id) return null;
  return loadProjectById(id);
}

export async function saveDraft(project: Project): Promise<void> {
  await saveProject(project);
}

export async function loadDraft(): Promise<Project | null> {
  await migrateLibrary();
  const recent = await loadLastProject();
  if (recent) return recent;
  const stored = await get<Project>(DRAFT_KEY, store);
  if (!stored) return null;
  return hydrateUrls(normalize(stored));
}

export async function hasDraft(): Promise<boolean> {
  await migrateLibrary();
  if ((await getLastProjectId()) !== null) return true;
  const stored = await get<Project>(DRAFT_KEY, store);
  return Boolean(stored);
}

export async function deleteDraft(): Promise<void> {
  await delMany([DRAFT_KEY, HISTORY_KEY], store);
}

export async function listSnapshots(projectId?: string): Promise<DraftSnapshot[]> {
  const stored = await get<DraftSnapshot[]>(
    projectId ? historyKey(projectId) : HISTORY_KEY,
    store,
  );
  return Array.isArray(stored) ? stored : [];
}

export async function createSnapshot(
  project: Project,
  label: string,
  includeAudio = false,
): Promise<DraftSnapshot[]> {
  const projectId = project.id?.trim() || newProjectId();
  const snapshot: DraftSnapshot = {
    id: `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    savedAt: new Date().toISOString(),
    label,
    sceneCount: project.scenes.length,
    includesAudio: includeAudio,
    project: stripUrls(includeAudio ? project : stripAudio(project)),
  };
  const existing = await listSnapshots(projectId);
  const next = [snapshot, ...existing].slice(0, SNAPSHOT_LIMIT);
  try {
    await set(historyKey(projectId), next, store);
    return next;
  } catch (error) {
    if (next.length <= 2) throw error;
    const trimmed = next.slice(0, Math.max(2, Math.floor(next.length / 2)));
    await set(historyKey(projectId), trimmed, store);
    return trimmed;
  }
}

export async function restoreSnapshot(
  projectId: string | undefined,
  id: string,
): Promise<Project | null> {
  const snapshots = await listSnapshots(projectId);
  const snapshot = snapshots.find((item) => item.id === id);
  if (!snapshot) return null;
  return hydrateUrls(normalize(snapshot.project));
}

export async function deleteSnapshot(
  projectId: string | undefined,
  id: string,
): Promise<DraftSnapshot[]> {
  const snapshots = await listSnapshots(projectId);
  const next = snapshots.filter((item) => item.id !== id);
  if (projectId) await set(historyKey(projectId), next, store);
  else await set(HISTORY_KEY, next, store);
  return next;
}

export async function importSnapshots(
  projectId: string,
  snapshots: DraftSnapshot[],
): Promise<void> {
  await set(historyKey(projectId), snapshots.slice(0, SNAPSHOT_LIMIT), store);
}

let migrationPromise: Promise<void> | null = null;

async function runMigration(): Promise<void> {
  const marker = await get<{ at: string }>(MIGRATION_KEY, store);
  if (marker) return;

  const legacy = await get<Project>(DRAFT_KEY, store);
  if (legacy) {
    const migrated = normalize(legacy);
    const saved = await saveProject({
      ...migrated,
      savedAt: migrated.savedAt ?? new Date().toISOString(),
    });
    const legacySnapshots = await listSnapshots();
    if (legacySnapshots.length > 0 && saved.id) {
      await set(historyKey(saved.id), legacySnapshots, store);
    }
    if (saved.id) await setLastProjectId(saved.id);
  }

  await set(MIGRATION_KEY, { at: new Date().toISOString() }, store);
}

export function migrateLibrary(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = runMigration().catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }
  return migrationPromise;
}

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const estimate = await navigator.storage.estimate();
  return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
}
