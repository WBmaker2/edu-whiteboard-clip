// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  base64ToBytes,
  computeWindowsFromPcm,
  detectSilentSpans,
  pcmDuration,
  pcmToWav,
  trimLeadingSilence,
} from "../src/lib/tts";

function tonePcm(seconds: number, sampleRate = 24000): Uint8Array {
  const samples = Math.floor(seconds * sampleRate);
  const bytes = new Uint8Array(samples * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < samples; index += 1) {
    view.setInt16(index * 2, Math.round(Math.sin(index / 8) * 1200), true);
  }
  return bytes;
}

function pcmWithGap(first: number, gap: number, second: number, sampleRate = 24000): Uint8Array {
  const total = Math.floor((first + gap + second) * sampleRate);
  const bytes = new Uint8Array(total * 2);
  const view = new DataView(bytes.buffer);
  const gapStart = Math.floor(first * sampleRate);
  const gapEnd = Math.floor((first + gap) * sampleRate);
  for (let index = 0; index < total; index += 1) {
    const inGap = index >= gapStart && index < gapEnd;
    view.setInt16(index * 2, inGap ? 0 : Math.round(Math.sin(index / 6) * 2000), true);
  }
  return bytes;
}

describe("tts helpers", () => {
  it("converts base64 to bytes", () => {
    expect(Array.from(base64ToBytes("AQID"))).toEqual([1, 2, 3]);
  });

  it("wraps PCM into a WAV blob with a valid header", async () => {
    const pcm = tonePcm(0.5);
    const blob = pcmToWav(pcm);
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(44 + pcm.length);
    const header = new Uint8Array(await new Response(blob).arrayBuffer()).slice(0, 4);
    expect(String.fromCharCode(...header)).toBe("RIFF");
  });

  it("computes duration from PCM length", () => {
    expect(pcmDuration(tonePcm(2))).toBeCloseTo(2, 1);
  });

  it("detects a silent gap", () => {
    const spans = detectSilentSpans(pcmWithGap(1, 0.4, 1));
    expect(spans.length).toBeGreaterThan(0);
    expect(spans[0][0]).toBeGreaterThan(0.8);
    expect(spans[0][1]).toBeLessThan(1.6);
  });

  it("trims a quiet noisy lead-in before speech", () => {
    const sampleRate = 24000;
    const lead = Math.floor(0.5 * sampleRate);
    const speech = Math.floor(1 * sampleRate);
    const bytes = new Uint8Array((lead + speech) * 2);
    const view = new DataView(bytes.buffer);
    for (let index = 0; index < lead + speech; index += 1) {
      const value = index < lead ? 40 : Math.round(Math.sin(index / 6) * 2000);
      view.setInt16(index * 2, value, true);
    }
    const trimmed = trimLeadingSilence(bytes, sampleRate, 0);
    const trimmedDuration = pcmDuration(trimmed, sampleRate);
    expect(trimmedDuration).toBeGreaterThan(0.9);
    expect(trimmedDuration).toBeLessThan(1.2);
  });

  it("leaves audio without a lead-in unchanged", () => {
    const pcm = tonePcm(0.5);
    expect(trimLeadingSilence(pcm, 24000, 0).length).toBe(pcm.length);
  });

  it("maps silent gaps to beat windows", () => {
    const beats = [
      { narration: "첫 번째 문장" },
      { narration: "두 번째 문장" },
      { narration: "세 번째 문장" },
    ];
    const windows = computeWindowsFromPcm(pcmWithGap(1.2, 0.4, 1.2), beats);
    expect(windows).not.toBeNull();
    expect(windows).toHaveLength(3);
    expect(windows![2][1]).toBeCloseTo(2.8, 0);
  });
});
