import { describe, expect, it } from "vitest";
import { createDemoProject } from "../src/data/demoProject";
import { useStudioStore } from "../src/store/studioStore";

function resetStore() {
  useStudioStore.setState({
    project: null,
    history: { past: [], future: [] },
  });
}

describe("studio store settings sync", () => {
  it("applies theme changes to the project and undoes both", () => {
    resetStore();
    const project = createDemoProject();
    useStudioStore.getState().setProject(project);
    const themeBefore = useStudioStore.getState().project?.themeId;
    const nextTheme = themeBefore === "midnight" ? "paper" : "midnight";

    useStudioStore.getState().setTheme(nextTheme);
    const after = useStudioStore.getState();
    expect(after.themeId).toBe(nextTheme);
    expect(after.project?.themeId).toBe(nextTheme);
    expect(after.history.past.length).toBe(1);

    useStudioStore.getState().undo();
    const undone = useStudioStore.getState();
    expect(undone.project?.themeId).toBe(themeBefore);
    expect(undone.themeId).toBe(themeBefore);
  });

  it("does not push history when the value is unchanged", () => {
    resetStore();
    const project = createDemoProject();
    useStudioStore.getState().setProject(project);
    const current = useStudioStore.getState().project?.themeId ?? "paper";
    const historyBefore = useStudioStore.getState().history.past.length;

    useStudioStore.getState().setTheme(current);

    const after = useStudioStore.getState();
    expect(after.history.past.length).toBe(historyBefore);
    expect(after.themeId).toBe(current);
  });

  it("only updates settings when no project exists", () => {
    resetStore();
    useStudioStore.getState().setVisualStyle("marker");
    const after = useStudioStore.getState();
    expect(after.visualStyle).toBe("marker");
    expect(after.project).toBeNull();
    expect(after.history.past.length).toBe(0);
    useStudioStore.getState().setVisualStyle("diagram");
  });
});
