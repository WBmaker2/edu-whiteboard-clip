type OscType = "sine" | "triangle" | "sawtooth" | "square";

interface BgmPreset {
  type: OscType;
  notes: number[][];
  step: number;
  gain: number;
  filter: number;
}

const PRESETS: Record<string, BgmPreset> = {
  lofi: {
    type: "triangle",
    notes: [
      [57, 60, 64],
      [53, 57, 60],
      [55, 59, 62],
      [52, 55, 59],
    ],
    step: 4,
    gain: 0.09,
    filter: 900,
  },
  piano: {
    type: "triangle",
    notes: [
      [60, 64, 67, 72],
      [57, 60, 64, 69],
      [62, 65, 69, 74],
      [55, 59, 62, 67],
    ],
    step: 4,
    gain: 0.075,
    filter: 2600,
  },
  ambient: {
    type: "sine",
    notes: [
      [45, 52, 57],
      [43, 50, 55],
      [41, 48, 53],
      [43, 50, 57],
    ],
    step: 8,
    gain: 0.07,
    filter: 1200,
  },
};

export interface BgmSpan {
  start: number;
  end: number;
}

export interface BgmHandle {
  stop: () => void;
  setVolume: (volume: number) => void;
}

export interface ScheduleBgmOptions {
  context: BaseAudioContext;
  destination: AudioNode;
  presetId: string;
  volume: number;
  startTime: number;
  duration: number;
  duckSpans?: BgmSpan[];
}

function midiToFrequency(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/**
 * Schedules an entire BGM segment up front. Works for both a live
 * AudioContext and an OfflineAudioContext used by the MP4 renderer.
 */
export function scheduleBgm({
  context,
  destination,
  presetId,
  volume,
  startTime,
  duration,
  duckSpans = [],
}: ScheduleBgmOptions): BgmHandle | null {
  const preset = PRESETS[presetId];
  if (!preset || volume <= 0 || duration <= 0) return null;

  const baseGain = context.createGain();
  baseGain.gain.value = volume;
  const duckGain = context.createGain();
  duckGain.gain.value = 1;
  baseGain.connect(duckGain);
  duckGain.connect(destination);

  const spans = duckSpans
    .map((span) => ({
      start: Math.max(0, span.start),
      end: Math.min(duration, span.end),
    }))
    .filter((span) => span.end - span.start > 0.05)
    .sort((a, b) => a.start - b.start);

  for (const span of spans) {
    const duckAt = startTime + span.start;
    const releaseAt = startTime + span.end;
    duckGain.gain.setValueAtTime(1, Math.max(startTime, duckAt - 0.05));
    duckGain.gain.linearRampToValueAtTime(0.38, duckAt + 0.18);
    duckGain.gain.setValueAtTime(0.38, Math.max(duckAt + 0.18, releaseAt - 0.05));
    duckGain.gain.linearRampToValueAtTime(1, releaseAt + 0.35);
  }

  const nodes: OscillatorNode[] = [];
  let chordIndex = 0;
  let cursor = 0;
  const scheduleNote = (
    frequency: number,
    when: number,
    noteDuration: number,
    noteGain: number,
  ) => {
    if (when >= startTime + duration) return;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = preset.type;
    oscillator.frequency.value = frequency;
    filter.type = "lowpass";
    filter.frequency.value = preset.filter;
    const attack = Math.min(0.8, noteDuration * 0.25);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, noteGain),
      when + attack,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, when + noteDuration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(baseGain);
    oscillator.start(when);
    oscillator.stop(when + noteDuration + 0.1);
    nodes.push(oscillator);
  };

  while (cursor < duration) {
    const notes = preset.notes[chordIndex % preset.notes.length];
    const chordStart = startTime + cursor;
    if (presetId === "piano") {
      notes.forEach((note, index) => {
        scheduleNote(
          midiToFrequency(note),
          chordStart + index * 0.32,
          1.6,
          (preset.gain * (index === 0 ? 1 : 0.7)) / 2,
        );
      });
      cursor += 2.4;
    } else {
      notes.forEach((note) => {
        scheduleNote(
          midiToFrequency(note),
          chordStart,
          Math.min(preset.step, duration - cursor) * 0.95,
          preset.gain / notes.length,
        );
      });
      cursor += preset.step;
    }
    chordIndex += 1;
  }

  return {
    stop: () => {
      for (const node of nodes) {
        try {
          node.stop();
        } catch {
          /* already stopped */
        }
        node.disconnect();
      }
      baseGain.disconnect();
      duckGain.disconnect();
    },
    setVolume: (next) => {
      baseGain.gain.value = next;
    },
  };
}
