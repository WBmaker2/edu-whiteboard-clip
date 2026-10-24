import { beforeEach, describe, expect, it } from "vitest";
import { clear, createStore, get, set } from "idb-keyval";
import { createDemoProject } from "../src/data/demoProject";
import { buildBackup, restoreLibrary } from "../src/lib/backup";
import { DB_NAME, DRAFT_KEY } from "../src/data/presets";
import type { DraftSnapshot, Project } from "../src/types/project";
import {
  createSnapshot,
  deleteProject,
  deleteSnapshot,
  duplicateProject,
  getLastProjectId,
  getLastProjectSummary,
  isQuotaError,
  listProjects,
  listSnapshots,
  loadProjectById,
  migrateLibrary,
  newProjectId,
  renameProject,
  restoreSnapshot,
  saveProject,
  setLastProjectId,
} from "../src/lib/storage";

const store = createStore(DB_NAME, "projects");

function project(title: string, id = newProjectId()): Project {
  const demo = createDemoProject();
  return { ...demo, id, title, topic: title };
}

describe("project library", () => {
  beforeEach(async () => {
    await clear(store);
  });

  it("moves a legacy draft and its snapshots into the library", async () => {
    const legacy = project("이전 수업", "legacy-lesson");
    const snapshot: DraftSnapshot = {
      id: "snap_legacy",
      savedAt: "2026-10-20T00:00:00.000Z",
      label: "이전 스냅샷",
      sceneCount: legacy.scenes.length,
      includesAudio: false,
      project: legacy,
    };
    await set(DRAFT_KEY, legacy, store);
    await set("draft:history", [snapshot], store);

    await migrateLibrary();

    const projects = await listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].title).toBe("이전 수업");
    expect(await getLastProjectId()).toBe("legacy-lesson");
    expect(await listSnapshots("legacy-lesson")).toHaveLength(1);
    expect(await get(DRAFT_KEY, store)).toBeTruthy();
  });

  it("saves, lists, loads, renames and deletes projects", async () => {
    const first = project("첫 수업", "lesson-one");
    const second = project("둘째 수업", "lesson-two");
    await saveProject(first);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await saveProject(second);

    const list = await listProjects();
    expect(list.map((item) => item.id)).toEqual(["lesson-two", "lesson-one"]);
    expect(await getLastProjectId()).toBe("lesson-two");

    const loaded = await loadProjectById("lesson-one");
    expect(loaded?.title).toBe("첫 수업");
    expect(loaded?.scenes).toHaveLength(first.scenes.length);

    const renamed = await renameProject("lesson-one", "이름 바꾼 수업");
    expect(renamed?.title).toBe("이름 바꾼 수업");
    expect((await loadProjectById("lesson-one"))?.title).toBe("이름 바꾼 수업");
    expect(await getLastProjectId()).toBe("lesson-two");

    const copy = await duplicateProject("lesson-one", "복사본");
    expect(copy?.id).not.toBe("lesson-one");
    expect(copy?.title).toContain("복사본");
    expect(await loadProjectById(copy!.id)).toBeTruthy();
    expect(await getLastProjectId()).toBe("lesson-two");

    await deleteProject("lesson-one");
    expect(await loadProjectById("lesson-one")).toBeNull();
    expect((await listProjects()).some((item) => item.id === "lesson-one")).toBe(false);
  });

  it("stores snapshots per project and restores them", async () => {
    const first = project("첫 수업", "snapshot-one");
    const second = project("둘째 수업", "snapshot-two");
    await saveProject(first);
    await saveProject(second);

    await createSnapshot(first, "수동 스냅샷", true);
    expect(await listSnapshots("snapshot-one")).toHaveLength(1);
    expect(await listSnapshots("snapshot-two")).toHaveLength(0);

    const snapshotId = (await listSnapshots("snapshot-one"))[0].id;
    const restored = await restoreSnapshot("snapshot-one", snapshotId);
    expect(restored?.title).toBe("첫 수업");

    await deleteSnapshot("snapshot-one", snapshotId);
    expect(await listSnapshots("snapshot-one")).toHaveLength(0);
  });

  it("backs up every project and restores them with new ids", async () => {
    const first = project("백업 수업 하나", "backup-one");
    const second = project("백업 수업 둘", "backup-two");
    await saveProject(first);
    await saveProject(second);
    await createSnapshot(first, "백업 스냅샷", true);

    const backup = await buildBackup(false);
    expect(backup.count).toBe(2);
    expect(backup.text).toContain("panseolab-backup");

    await clear(store);
    const restored = await restoreLibrary(backup.text);
    expect(restored.count).toBe(2);
    const projects = await listProjects();
    expect(projects).toHaveLength(2);
    expect(projects.some((item) => item.id === "backup-one")).toBe(false);
    expect(projects.some((item) => item.id === "backup-two")).toBe(false);
    const withSnapshot = projects.find((item) => item.title === "백업 수업 하나");
    expect(withSnapshot).toBeTruthy();
    expect(await listSnapshots(withSnapshot!.id)).toHaveLength(1);
  });

  it("reports the last summary and quota errors", async () => {
    await saveProject(project("최근 수업", "recent-lesson"));
    await setLastProjectId("recent-lesson");
    const summary = await getLastProjectSummary();
    expect(summary?.id).toBe("recent-lesson");
    expect(summary?.sceneCount).toBeGreaterThan(0);
    expect(summary?.duration).toBeGreaterThan(0);

    const quota = new Error("full");
    quota.name = "QuotaExceededError";
    expect(isQuotaError(quota)).toBe(true);
    expect(isQuotaError(new Error("other"))).toBe(false);
  });
});
