import { describe, expect, it } from "vitest";
import {
  buildScenesFromSeeds,
  estimateSceneDuration,
  normalizeSceneLayout,
  normalizeStoryboard,
  normalizeStoryboardResult,
  storyboardPrompt,
} from "../src/lib/storyboard";

const seedBeat = (index: number) => ({
  label: `핵심 ${index}`,
  desc: "짧은 설명",
  narration: "학생들에게 설명하는 자연스러운 문장입니다.",
  iconType: "Sun",
});

describe("storyboard normalization", () => {
  it("accepts a valid JSON array and keeps the scene type", () => {
    const scenes = normalizeStoryboard([
      { type: "intro", title: "도입", subtitle: "요약", beats: [seedBeat(1), seedBeat(2), seedBeat(3)] },
      { type: "body", title: "전개", subtitle: "요약", beats: [seedBeat(1), seedBeat(2), seedBeat(3)] },
      { type: "outro", title: "정리", subtitle: "요약", beats: [seedBeat(1), seedBeat(2), seedBeat(3)] },
    ]);
    expect(scenes).toHaveLength(3);
    expect(scenes[0].type).toBe("intro");
    expect(scenes[2].type).toBe("outro");
    expect(scenes[0].beats[0].label).toBe("핵심 1");
  });

  it("falls back to a lightbulb icon for unknown icon types", () => {
    const scenes = normalizeStoryboard([
      {
        type: "intro",
        title: "도입",
        subtitle: "요약",
        beats: [{ ...seedBeat(1), iconType: "rocket-launcher" }],
      },
      { type: "body", title: "전개", subtitle: "요약", beats: [seedBeat(1)] },
      { type: "outro", title: "정리", subtitle: "요약", beats: [seedBeat(1)] },
    ]);
    expect(scenes[0].beats[0].iconType).toBe("Lightbulb");
  });

  it("pads missing beats to three", () => {
    const scenes = normalizeStoryboard([
      { type: "intro", title: "도입", beats: [seedBeat(1)] },
      { type: "body", title: "전개" },
      { type: "outro", title: "정리" },
    ]);
    expect(scenes[1].beats).toHaveLength(3);
    expect(scenes[1].beats[1].label).toContain("핵심 포인트");
  });

  it("rejects a storyboard with fewer than three scenes", () => {
    expect(() => normalizeStoryboard([{ title: "하나" }])).toThrow();
  });

  it("estimates a duration from narration length", () => {
    const short = estimateSceneDuration([{ ...seedBeat(1), narration: "짧은 문장" }]);
    const long = estimateSceneDuration([
      { ...seedBeat(1), narration: "아주 긴 문장입니다. ".repeat(12) },
    ]);
    expect(short).toBeGreaterThanOrEqual(7);
    expect(long).toBeGreaterThan(short);
    expect(long).toBeLessThanOrEqual(18);
  });

  it("builds playable scenes with windows", () => {
    const scenes = buildScenesFromSeeds(
      normalizeStoryboard([
        { type: "intro", title: "도입", subtitle: "요약", beats: [seedBeat(1), seedBeat(2), seedBeat(3)] },
        { type: "body", title: "전개", subtitle: "요약", beats: [seedBeat(1), seedBeat(2), seedBeat(3)] },
        { type: "outro", title: "정리", subtitle: "요약", beats: [seedBeat(1), seedBeat(2), seedBeat(3)] },
      ]),
    );
    expect(scenes[0].windows).toHaveLength(3);
    expect(scenes[0].audioSource).toBe("none");
    expect(scenes).toHaveLength(3);
  });

  it("writes its own bilingual-agnostic prompt", () => {
    const prompt = storyboardPrompt("광합성");
    expect(prompt).toContain("광합성");
    expect(prompt).toContain("JSON");
    expect(prompt).not.toContain("```");
  });

  it("asks the model to choose a layout per scene", () => {
    const prompt = storyboardPrompt("광합성");
    expect(prompt).toContain('"layout"');
    expect(prompt).toContain("cycle");
    expect(prompt).toContain("timeline");
  });

  it("keeps a valid scene layout and drops unknown ones", () => {
    const scenes = normalizeStoryboard([
      { type: "intro", title: "도입", beats: [seedBeat(1)], layout: "timeline" },
      { type: "body", title: "전개", beats: [seedBeat(1)], layout: "sparkles" },
      { type: "outro", title: "정리", beats: [seedBeat(1)], layout: "cycle" },
    ]);
    expect(scenes[0].layout).toBe("timeline");
    expect(scenes[1].layout).toBeUndefined();
    expect(scenes[2].layout).toBe("cycle");
  });

  it("normalizes layout ids written with different casing or spacing", () => {
    expect(normalizeSceneLayout("Mind-Map")).toBe("mindmap");
    expect(normalizeSceneLayout("Venn")).toBe("venn");
    expect(normalizeSceneLayout(" timeline ")).toBe("timeline");
    expect(normalizeSceneLayout("nope")).toBeUndefined();
  });

  it("carries the scene layout into built scenes", () => {
    const scenes = buildScenesFromSeeds(
      normalizeStoryboard([
        { type: "intro", title: "도입", beats: [seedBeat(1), seedBeat(2)], layout: "hierarchy" },
        { type: "body", title: "전개", beats: [seedBeat(1), seedBeat(2)] },
        { type: "outro", title: "정리", beats: [seedBeat(1), seedBeat(2)], layout: "chart" },
      ]),
    );
    expect(scenes[0].layout).toBe("hierarchy");
    expect(scenes[1].layout).toBeUndefined();
    expect(scenes[2].layout).toBe("chart");
  });

  it("reads an optional style hint from a JSON object", () => {
    const result = normalizeStoryboardResult({
      style: { theme: "blueprint", visual: "diagram" },
      scenes: [
        { type: "intro", title: "도입", beats: [seedBeat(1)] },
        { type: "body", title: "전개", beats: [seedBeat(1)] },
        { type: "outro", title: "정리", beats: [seedBeat(1)] },
      ],
    });
    expect(result.styleHint).toEqual({ themeId: "blueprint", visualStyle: "diagram" });
  });

  it("ignores an invalid style hint but still returns scenes", () => {
    const result = normalizeStoryboardResult({
      style: { theme: "neon", visual: "hologram" },
      scenes: [
        { type: "intro", title: "도입", beats: [seedBeat(1)] },
        { type: "body", title: "전개", beats: [seedBeat(1)] },
        { type: "outro", title: "정리", beats: [seedBeat(1)] },
      ],
    });
    expect(result.styleHint).toBeUndefined();
    expect(result.seeds).toHaveLength(3);
  });
});
