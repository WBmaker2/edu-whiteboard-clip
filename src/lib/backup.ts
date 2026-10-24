import type { DraftSnapshot, Project } from "../types/project";
import { downloadBlob, sanitizeFileName } from "./download";
import { parseProjectJson, serializeProject } from "./export/project";
import {
  importSnapshots,
  listProjects,
  listSnapshots,
  loadProjectById,
  newProjectId,
  saveProject,
} from "./storage";

interface BackupSnapshot {
  id: string;
  savedAt: string;
  label: string;
  sceneCount: number;
  includesAudio: boolean;
  project: unknown;
}

interface BackupProject {
  project: unknown;
  snapshots: BackupSnapshot[];
}

interface BackupPayload {
  format: "panseolab-backup";
  version: 1;
  exportedAt: string;
  includeMedia: boolean;
  projects: BackupProject[];
}

export interface BackupResult {
  count: number;
  bytes: number;
  filename: string;
}

export interface RestoreResult {
  count: number;
  firstProjectId: string | null;
}

function parsePayload(text: string): BackupPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("backup.invalidJson");
  }
  if (
    !raw ||
    typeof raw !== "object" ||
    (raw as BackupPayload).format !== "panseolab-backup" ||
    (raw as BackupPayload).version !== 1 ||
    !Array.isArray((raw as BackupPayload).projects)
  ) {
    throw new Error("backup.invalidFormat");
  }
  return raw as BackupPayload;
}

export async function buildBackup(
  includeMedia: boolean,
): Promise<{ text: string; count: number; bytes: number }> {
  const summaries = await listProjects();
  const projects: BackupProject[] = [];

  for (const summary of summaries) {
    const project = await loadProjectById(summary.id);
    if (!project) continue;
    const serialized = JSON.parse(await serializeProject(project, includeMedia));
    const snapshots = await listSnapshots(summary.id);
    const serializedSnapshots: BackupSnapshot[] = [];
    for (const snapshot of snapshots) {
      serializedSnapshots.push({
        id: snapshot.id,
        savedAt: snapshot.savedAt,
        label: snapshot.label,
        sceneCount: snapshot.sceneCount,
        includesAudio: includeMedia ? snapshot.includesAudio : false,
        project: JSON.parse(await serializeProject(snapshot.project, includeMedia)),
      });
    }
    projects.push({ project: serialized, snapshots: serializedSnapshots });
  }

  const payload: BackupPayload = {
    format: "panseolab-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    includeMedia,
    projects,
  };
  const text = JSON.stringify(payload);
  return {
    text,
    count: projects.length,
    bytes: new TextEncoder().encode(text).length,
  };
}

export async function backupLibrary(
  includeMedia: boolean,
): Promise<BackupResult> {
  const built = await buildBackup(includeMedia);
  const blob = new Blob([built.text], { type: "application/json;charset=utf-8" });
  const date = new Date().toISOString().slice(0, 10);
  const suffix = includeMedia ? "with-media" : "no-media";
  const filename = `${sanitizeFileName(`panseolab_backup_${date}_${suffix}`)}.json`;
  downloadBlob(blob, filename);
  return { count: built.count, bytes: blob.size, filename };
}

export async function restoreLibrary(text: string): Promise<RestoreResult> {
  const payload = parsePayload(text);
  const prepared: Array<{
    project: Project;
    projectId: string;
    snapshots: DraftSnapshot[];
  }> = [];

  for (const entry of payload.projects) {
    if (!entry || typeof entry !== "object" || !entry.project) {
      throw new Error("backup.invalidProject");
    }
    let parsed: Project;
    try {
      parsed = parseProjectJson(JSON.stringify(entry.project));
    } catch {
      throw new Error("backup.invalidProject");
    }
    const projectId = newProjectId();
    const project: Project = {
      ...parsed,
      id: projectId,
      title: parsed.title ?? parsed.topic,
    };
    const snapshots: DraftSnapshot[] = [];
    for (const rawSnapshot of Array.isArray(entry.snapshots) ? entry.snapshots : []) {
      let snapshotProject: Project;
      try {
        snapshotProject = parseProjectJson(JSON.stringify(rawSnapshot.project));
      } catch {
        throw new Error("backup.invalidSnapshot");
      }
      snapshots.push({
        id: rawSnapshot.id || `snap_${projectId}_${snapshots.length}`,
        savedAt: rawSnapshot.savedAt || new Date().toISOString(),
        label: rawSnapshot.label || "",
        sceneCount: snapshotProject.scenes.length,
        includesAudio: Boolean(rawSnapshot.includesAudio),
        project: {
          ...snapshotProject,
          id: projectId,
          title: snapshotProject.title ?? project.title,
        },
      });
    }
    prepared.push({ project, projectId, snapshots });
  }

  for (const item of prepared) {
    await saveProject(item.project, false);
    if (item.snapshots.length > 0) {
      await importSnapshots(item.projectId, item.snapshots);
    }
  }
  const firstProjectId = prepared[0]?.projectId ?? null;
  return { count: prepared.length, firstProjectId };
}
