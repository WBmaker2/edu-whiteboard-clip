import { describe, expect, it } from "vitest";
import { clamp, debounce, formatDuration, generateId, isNonEmptyString, round, throttle } from "../src/lib/common";

describe("common utils extended", () => {
  it("clamps values correctly", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-10, 0, 10)).toBe(0);
    expect(clamp(100, 0, 10)).toBe(10);
  });

  it("rounds values correctly", () => {
    expect(round(1.234, 2)).toBe(1.23);
    expect(round(1.235, 2)).toBe(1.24);
    expect(round(5.5, 0)).toBe(6);
  });

  it("checks non-empty strings", () => {
    expect(isNonEmptyString("hello")).toBe(true);
    expect(isNonEmptyString("  hello  ")).toBe(true);
    expect(isNonEmptyString("")).toBe(false);
    expect(isNonEmptyString("   ")).toBe(false);
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
    expect(isNonEmptyString(123)).toBe(false);
  });

  it("formats duration correctly", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(30)).toBe("0:30");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3661)).toBe("61:01");
  });

  it("generates unique ids", () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe("string");
  });

  it("debounce delays execution", async () => {
    let count = 0;
    const fn = debounce(() => count++, 50);
    fn();
    fn();
    fn();
    expect(count).toBe(0);
    await new Promise((r) => setTimeout(r, 100));
    expect(count).toBe(1);
  });

  it("throttle limits execution", async () => {
    let count = 0;
    const fn = throttle(() => count++, 50);
    fn();
    fn();
    fn();
    expect(count).toBe(1);
    await new Promise((r) => setTimeout(r, 100));
    fn();
    expect(count).toBe(2);
  });
});
