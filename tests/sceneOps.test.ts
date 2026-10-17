import { describe, expect, it } from "vitest";
import { createDemoProject } from "../src/data/demoProject";
import {
  addBeat,
  addScene,
  applySceneRewrite,
  canAddScene,
  canDeleteScene,
  defaultBeat,
  deleteBeat,
  deleteScene,
  duplicateScene,
  isAudioStale,
  moveBeat,
  moveScene,
  recomputeScene,
  sceneTextHash,
  setSceneType,
  withSceneAudio,
} from "../src/lib/sceneOps";

describe("scene operations", () => {
  it("adds, duplicates, moves and deletes scenes", () => {
    const project = createDemoProject();
    const added = addScene(project, 1);
    expect(added.scenes).toHaveLength(6);
    expect(added.scenes[2].title).toContain("새");

    const duplicated = duplicateScene(project, 0);
    expect(duplicated.scenes).toHaveLength(6);
    expect(duplicated.scenes[1].audioSource).toBe("none");

    const moved = moveScene(project, 0, 2);
    expect(moved.scenes[2].id).toBe(project.scenes[0].id);

    const removed = deleteScene(project, 0);
    expect(removed.scenes).toHaveLength(4);
  });

  it("guards scene count limits", () => {
    let project = createDemoProject();
    while (canAddScene(project)) project = addScene(project, project.scenes.length - 1);
    expect(project.scenes).toHaveLength(10);
    expect(addScene(project, 0).scenes).toHaveLength(10);

    let small = project;
    while (canDeleteScene(small)) small = deleteScene(small, 0);
    expect(small.scenes).toHaveLength(2);
    expect(deleteScene(small, 0).scenes).toHaveLength(2);
  });

  it("adds, moves and deletes beats and rebuilds windows", () => {
    const project = createDemoProject();
    const added = addBeat(project, 0);
    const scene = added.scenes[0];
    expect(scene.beats).toHaveLength(4);
    expect(scene.windows).toHaveLength(4);

    const moved = moveBeat(added, 0, 0, 3);
    expect(moved.scenes[0].beats[3].id).toBe(scene.beats[0].id);

    const removed = deleteBeat(added, 0, 0);
    expect(removed.scenes[0].beats).toHaveLength(3);
  });

  it("does not shrink beats below two", () => {
    const project = createDemoProject();
    const beats = project.scenes[0].beats.slice(0, 2);
    const scene = recomputeScene(project.scenes[0], beats);
    const two = { ...project, scenes: [scene, ...project.scenes.slice(1)] };
    expect(deleteBeat(two, 0, 0).scenes[0].beats).toHaveLength(2);
  });

  it("marks audio stale when narration changes", () => {
    const project = createDemoProject();
    const scene = project.scenes[0];
    const audio = new Blob(["fake-audio"], { type: "audio/wav" });
    const withAudio = withSceneAudio(project, 0, {
      blob: audio,
      duration: scene.duration,
      source: "tts",
    });
    expect(isAudioStale(withAudio.scenes[0])).toBe(false);

    const edited = recomputeScene(withAudio.scenes[0], [
      { ...withAudio.scenes[0].beats[0], narration: "완전히 다른 대본입니다." },
      ...withAudio.scenes[0].beats.slice(1),
    ]);
    const editedProject = {
      ...withAudio,
      scenes: [edited, ...withAudio.scenes.slice(1)],
    };
    expect(isAudioStale(editedProject.scenes[0])).toBe(true);
    expect(sceneTextHash(edited.beats)).not.toBe(sceneTextHash(scene.beats));
  });

  it("changes the scene type and applies a rewrite in one commit", () => {
    const project = createDemoProject();
    const typed = setSceneType(project, 1, "outro");
    expect(typed.scenes[1].type).toBe("outro");

    const beats = [
      { ...defaultBeat(0), label: "새 개념" },
      { ...defaultBeat(1), label: "새 원리" },
    ];
    const rewritten = applySceneRewrite(project, 0, {
      title: "새 제목",
      subtitle: "새 요약",
      beats,
    });
    expect(rewritten.scenes[0].title).toBe("새 제목");
    expect(rewritten.scenes[0].beats).toHaveLength(2);
    expect(rewritten.scenes[0].windows).toHaveLength(2);
  });
});
