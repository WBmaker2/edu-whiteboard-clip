import { describe, expect, it } from "vitest";
import { curriculumPromptBlock } from "../src/data/curriculum";
import { storyboardPrompt } from "../src/lib/storyboard";
import { rewritePrompt } from "../src/lib/rewrite";
import { createDemoProject } from "../src/data/demoProject";

describe("curriculum context", () => {
  it("returns an empty block without context", () => {
    expect(curriculumPromptBlock(undefined)).toBe("");
    expect(curriculumPromptBlock({ grade: "", subject: "", standards: "" })).toBe("");
  });

  it("builds a prompt block with level, subject and standards", () => {
    const block = curriculumPromptBlock({
      grade: "중등",
      subject: "과학",
      standards: "[9과12-01] 광합성 과정을 설명할 수 있다.",
    });
    expect(block).toContain("Curriculum alignment");
    expect(block).toContain("중등 과학");
    expect(block).toContain("[9과12-01]");
  });

  it("includes the block in the storyboard prompt only when provided", () => {
    const withOut = storyboardPrompt("광합성");
    expect(withOut).not.toContain("Curriculum alignment");
    const withIn = storyboardPrompt("광합성", {
      grade: "중등",
      subject: "과학",
      standards: "[9과12-01]",
    });
    expect(withIn).toContain("Curriculum alignment");
    expect(withIn).toContain("[9과12-01]");
  });

  it("includes the block in the rewrite prompt", () => {
    const project = createDemoProject();
    const prompt = rewritePrompt({
      topic: "광합성",
      scene: project.scenes[1],
      sceneIndex: 1,
      totalScenes: project.scenes.length,
      instruction: "더 쉽게",
      beatCount: 3,
      curriculum: { grade: "고등", subject: "과학", standards: "[12생과01-02]" },
    });
    expect(prompt).toContain("Curriculum alignment");
    expect(prompt).toContain("[12생과01-02]");
  });
});
