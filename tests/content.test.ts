import { describe, expect, it } from "vitest";
import { createDemoProject } from "../src/data/demoProject";
import { buildSrt } from "../src/lib/export/srt";
import { parseProjectJson, serializeProject } from "../src/lib/export/project";
import { buildQuiz, heuristicEssayFeedback } from "../src/lib/quiz";
import { buildWorksheet } from "../src/lib/worksheet";

describe("demo project", () => {
  it("contains five scenes with three beats each", () => {
    const project = createDemoProject();
    expect(project.scenes).toHaveLength(5);
    expect(project.scenes.every((scene) => scene.beats.length === 3)).toBe(true);
    expect(project.scenes.every((scene) => scene.windows.length === 3)).toBe(true);
  });
});

describe("srt export", () => {
  it("writes timecoded narration lines", () => {
    const project = createDemoProject();
    const srt = buildSrt(project);
    expect(srt).toContain("-->");
    expect(srt.match(/-->/g)?.length).toBe(15);
    expect(srt).toContain("식물은 햇빛을");
  });

  it("uses translated narrations when provided", () => {
    const project = createDemoProject();
    const translations = project.scenes.map((scene) =>
      scene.beats.map(() => "Translated line"),
    );
    const srt = buildSrt(project, translations, "en");
    expect(srt).toContain("Translated line");
    expect(srt).not.toContain("식물은 햇빛을");
  });
});

describe("project json", () => {
  it("round-trips a project without audio", async () => {
    const project = createDemoProject();
    const json = await serializeProject(project, false);
    const parsed = parseProjectJson(json);
    expect(parsed.topic).toBe(project.topic);
    expect(parsed.scenes).toHaveLength(project.scenes.length);
    expect(parsed.scenes[0].beats[0].label).toBe(project.scenes[0].beats[0].label);
  });

  it("rejects an invalid payload", () => {
    expect(() => parseProjectJson("{\"version\":2}")).toThrow();
    expect(() => parseProjectJson("not json")).toThrow();
  });
});

describe("worksheet and quiz", () => {
  it("builds five fill-in, five multiple choice and three essay questions", () => {
    const worksheet = buildWorksheet(createDemoProject());
    expect(worksheet.fillIn).toHaveLength(5);
    expect(worksheet.multipleChoice).toHaveLength(5);
    expect(worksheet.essays).toHaveLength(3);
  });

  it("always includes the correct answer among the options", () => {
    const quiz = buildQuiz(createDemoProject());
    for (const item of quiz.multipleChoice) {
      expect(item.options[item.answerIndex]).toBeTruthy();
      expect(new Set(item.options).size).toBe(item.options.length);
    }
  });

  it("gives heuristic feedback for an empty or written answer", () => {
    const quiz = buildQuiz(createDemoProject());
    expect(heuristicEssayFeedback("", quiz.essays[0]).score).toBe(0);
    expect(heuristicEssayFeedback("식물은 빛을 이용해 양분을 만듭니다.", quiz.essays[0]).score).toBeGreaterThan(0);
  });
});
