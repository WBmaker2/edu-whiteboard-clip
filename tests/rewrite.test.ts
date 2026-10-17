import { describe, expect, it } from "vitest";
import { createDemoProject } from "../src/data/demoProject";
import { normalizeSceneRewrite, rewritePrompt, REWRITE_PRESETS } from "../src/lib/rewrite";

describe("scene rewrite", () => {
  const scene = createDemoProject().scenes[0];

  it("normalizes a valid response and keeps the requested beat count", () => {
    const result = normalizeSceneRewrite(
      {
        title: "새 제목",
        subtitle: "새 요약",
        beats: [
          { label: "가", desc: "설명", narration: "첫 문장입니다.", iconType: "Sun" },
          { label: "나", desc: "설명", narration: "둘째 문장입니다.", iconType: "Leaf" },
        ],
      },
      scene,
      2,
    );
    expect(result.title).toBe("새 제목");
    expect(result.beats).toHaveLength(2);
    expect(result.beats[0].iconType).toBe("Sun");
  });

  it("pads missing beats and clamps unknown icons", () => {
    const result = normalizeSceneRewrite(
      {
        title: "제목",
        subtitle: "요약",
        beats: [{ label: "가", desc: "설명", narration: "문장", iconType: "spaceship" }],
      },
      scene,
      4,
    );
    expect(result.beats).toHaveLength(4);
    expect(result.beats[1].label).toBe(scene.beats[1].label);
    expect(result.beats[0].iconType).toBe("Lightbulb");
  });

  it("falls back to the current scene when the response is empty", () => {
    const result = normalizeSceneRewrite({}, scene, 3);
    expect(result.title).toBe(scene.title);
    expect(result.beats).toHaveLength(3);
  });

  it("writes a strict JSON prompt with scene context", () => {
    const prompt = rewritePrompt({
      topic: "광합성",
      scene,
      sceneIndex: 0,
      totalScenes: 5,
      previousTitle: undefined,
      nextTitle: "다음 장면",
      instruction: "더 쉽게",
      beatCount: 3,
    });
    expect(prompt).toContain("광합성");
    expect(prompt).toContain(scene.title);
    expect(prompt).toContain('"beats"');
    expect(prompt).toContain("exactly 3 beats");
    expect(prompt).not.toContain("```");
  });

  it("ships rewrite presets", () => {
    expect(REWRITE_PRESETS.length).toBeGreaterThanOrEqual(4);
  });
});
