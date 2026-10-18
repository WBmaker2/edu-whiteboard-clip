import { describe, expect, it } from "vitest";
import { sanitizeFileName } from "../src/lib/download";

describe("sanitizeFileName", () => {
  it("keeps korean letters, digits and hyphens", () => {
    expect(sanitizeFileName("광합성 5단계")).toBe("광합성_5단계");
    expect(sanitizeFileName("lesson-01")).toBe("lesson-01");
  });

  it("strips special characters and collapses whitespace", () => {
    expect(sanitizeFileName("a/b:c*d?e")).toBe("abcde");
    expect(sanitizeFileName("  여러   공백  ")).toBe("여러_공백");
  });

  it("falls back when the name is empty after sanitizing", () => {
    expect(sanitizeFileName("!!!")).toBe("whiteboard_lesson");
    expect(sanitizeFileName("", "fallback")).toBe("fallback");
  });

  it("limits the length to 40 characters", () => {
    const long = "가".repeat(80);
    expect(sanitizeFileName(long).length).toBe(40);
  });
});
