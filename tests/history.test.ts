import { describe, expect, it } from "vitest";
import { createDemoProject } from "../src/data/demoProject";
import {
  HISTORY_LIMIT,
  emptyHistory,
  pushHistory,
  redoHistory,
  undoHistory,
} from "../src/lib/history";

describe("project history", () => {
  it("pushes snapshots and clears the redo stack", () => {
    const a = createDemoProject();
    const b = { ...a, topic: "B" };
    let history = pushHistory(emptyHistory, a);
    history = pushHistory(history, b);
    expect(history.past).toHaveLength(2);
    expect(history.future).toHaveLength(0);
  });

  it("undoes and redoes a project", () => {
    const a = createDemoProject();
    const b = { ...a, topic: "B" };
    const history = pushHistory(emptyHistory, a);
    const undone = undoHistory(history, b);
    expect(undone?.project.topic).toBe(a.topic);
    const redone = redoHistory(undone!.history, undone!.project);
    expect(redone?.project.topic).toBe("B");
  });

  it("returns null at the edges", () => {
    const a = createDemoProject();
    expect(undoHistory(emptyHistory, a)).toBeNull();
    expect(redoHistory(emptyHistory, a)).toBeNull();
  });

  it("keeps only the configured number of steps", () => {
    let history = emptyHistory;
    for (let index = 0; index < HISTORY_LIMIT + 10; index += 1) {
      history = pushHistory(history, { ...createDemoProject(), topic: `t${index}` });
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    const last = history.past[history.past.length - 1];
    expect(last.topic).toBe(`t${HISTORY_LIMIT + 9}`);
  });
});
