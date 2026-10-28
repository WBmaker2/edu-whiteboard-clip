import { describe, expect, it } from "vitest";
import { clamp, formatDuration, isNonEmptyString, round } from "../src/lib/common";

describe("common utils", () => {
  it("clamps values", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("rounds values", () => {
    expect(round(1.234, 2)).toBe(1.23);
    expect(round(1.235, 2)).toBe(1.24);
  });

  it("checks non-empty strings", () => {
    expect(isNonEmptyString("hello")).toBe(true);
    expect(isNonEmptyString("  ")).toBe(false);
    expect(isNonEmptyString("")).toBe(false);
    expect(isNonEmptyString(null)).toBe(false);
  });

  it("formats duration", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(30)).toBe("0:30");
  });
});
