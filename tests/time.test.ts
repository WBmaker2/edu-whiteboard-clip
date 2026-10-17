import { describe, expect, it } from "vitest";
import {
  activeBeatIndex,
  buildWindows,
  formatSrtTime,
  locateTime,
  projectDuration,
  sceneStart,
} from "../src/lib/time";
import type { Beat, Scene } from "../src/types/project";

const beat = (label: string, narration = "문장"): Beat => ({
  id: label,
  label,
  desc: "설명",
  narration,
  iconType: "Lightbulb",
});

const scene = (id: string, duration: number): Scene => {
  const beats = [beat("가"), beat("나", "조금 더 긴 문장입니다"), beat("다")];
  return {
    id,
    type: "body",
    title: id,
    subtitle: "요약",
    beats,
    duration,
    windows: buildWindows(beats, duration),
  };
};

describe("time helpers", () => {
  it("builds windows that match the scene duration", () => {
    const beats = [beat("가"), beat("나나나나"), beat("다다")];
    const windows = buildWindows(beats, 12);
    expect(windows).toHaveLength(3);
    expect(windows[0][0]).toBe(0);
    expect(windows[2][1]).toBeCloseTo(12, 1);
  });

  it("locates a scene and local time", () => {
    const scenes = [scene("a", 10), scene("b", 5), scene("c", 7)];
    expect(projectDuration({ scenes })).toBe(22);
    expect(sceneStart(scenes, 2)).toBe(15);
    expect(locateTime(scenes, 12)).toEqual({ index: 1, localTime: 2 });
    expect(locateTime(scenes, 20).index).toBe(2);
  });

  it("finds the active beat from windows", () => {
    const item = scene("a", 9);
    expect(activeBeatIndex(item, 0.1)).toBe(0);
    expect(activeBeatIndex(item, item.windows[1][0] + 0.1)).toBe(1);
    expect(activeBeatIndex(item, 8.9)).toBe(2);
  });

  it("formats SRT timestamps", () => {
    expect(formatSrtTime(0)).toBe("00:00:00,000");
    expect(formatSrtTime(65.432)).toBe("00:01:05,432");
  });
});
