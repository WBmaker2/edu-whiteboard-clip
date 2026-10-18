// @vitest-environment node
import { describe, expect, it } from "vitest";
import { scheduleVoice } from "../src/lib/voiceTrack";

function fakeContext() {
  const automation: string[] = [];
  const starts: number[][] = [];
  const param = () => ({
    value: 1,
    setValueAtTime: (value: number, time: number) => automation.push(`set:${value}@${time}`),
    exponentialRampToValueAtTime: (value: number, time: number) =>
      automation.push(`exp:${value}@${time}`),
    linearRampToValueAtTime: (value: number, time: number) =>
      automation.push(`lin:${value}@${time}`),
  });
  const source = {
    buffer: null as unknown,
    playbackRate: { value: 1 },
    connect: () => undefined,
    start: (...args: number[]) => {
      starts.push(args);
    },
  };
  const gain = { gain: param(), connect: () => undefined };
  const context = {
    createBufferSource: () => source,
    createGain: () => gain,
  } as unknown as BaseAudioContext;
  return { source, gain, context, starts, automation };
}

const buffer = { duration: 5 } as unknown as AudioBuffer;
const destination = { connect: () => undefined } as unknown as AudioNode;

describe("scheduleVoice", () => {
  it("fades in at a scene start and fades out at the end", () => {
    const { context, starts, automation } = fakeContext();
    scheduleVoice(context, destination, buffer, { when: 1, offset: 0, duration: 3 });
    expect(starts).toEqual([[1, 0, 3]]);
    expect(automation.join(" ")).toContain("exp:1@1.02");
    expect(automation.join(" ")).toContain("lin:0.0001@4");
  });

  it("also fades in when resuming mid-scene", () => {
    const { context, starts, automation } = fakeContext();
    scheduleVoice(context, destination, buffer, { when: 0, offset: 2, duration: 3 });
    expect(starts).toEqual([[0, 2, 3]]);
    expect(automation.join(" ")).toContain("exp:1@0.02");
  });

  it("scales the end fade by the playback rate", () => {
    const { source, context, starts, automation } = fakeContext();
    scheduleVoice(context, destination, buffer, { when: 0, offset: 0, duration: 4, rate: 2 });
    expect(source.playbackRate.value).toBe(2);
    expect(starts).toEqual([[0, 0, 4]]);
    expect(automation.join(" ")).toContain("lin:0.0001@2");
  });
});
