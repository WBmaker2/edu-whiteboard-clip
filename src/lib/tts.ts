import type { Beat } from "../types/project";
import { buildWindows } from "./time";

export const TTS_SAMPLE_RATE = 24000;

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function pcmToWav(pcm: Uint8Array, sampleRate = TTS_SAMPLE_RATE): Blob {
  const channels = 1;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + pcm.length);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeText(36, "data");
  view.setUint32(40, pcm.length, true);
  new Uint8Array(buffer, 44).set(pcm);
  return new Blob([buffer], { type: "audio/wav" });
}

export function pcmDuration(pcm: Uint8Array, sampleRate = TTS_SAMPLE_RATE): number {
  return pcm.length / (sampleRate * 2);
}

function toInt16(pcm: Uint8Array): Int16Array {
  const aligned = new Int16Array(Math.floor(pcm.length / 2));
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.length);
  for (let index = 0; index < aligned.length; index += 1) {
    aligned[index] = view.getInt16(index * 2, true);
  }
  return aligned;
}

export function detectSilentSpans(
  pcm: Uint8Array,
  sampleRate = TTS_SAMPLE_RATE,
): [number, number][] {
  const samples = toInt16(pcm);
  if (samples.length === 0) return [];
  const bucket = Math.max(1, Math.floor(sampleRate / 100));
  const buckets = Math.floor(samples.length / bucket);
  if (buckets === 0) return [];
  const rms = new Float32Array(buckets);
  let peak = 0;
  for (let index = 0; index < buckets; index += 1) {
    let sum = 0;
    const start = index * bucket;
    for (let offset = 0; offset < bucket; offset += 1) {
      const value = samples[start + offset] / 32768;
      sum += value * value;
    }
    rms[index] = Math.sqrt(sum / bucket);
    if (rms[index] > peak) peak = rms[index];
  }
  const threshold = Math.max(peak * 0.03, 1 / 32768);
  const spans: [number, number][] = [];
  let silentStart: number | null = null;
  for (let index = 0; index <= buckets; index += 1) {
    const isSilent = index < buckets && rms[index] < threshold;
    if (isSilent && silentStart === null) silentStart = index;
    if (!isSilent && silentStart !== null) {
      const start = silentStart / 100;
      const end = index / 100;
      if (end - start >= 0.15) spans.push([start, end]);
      silentStart = null;
    }
  }
  const duration = samples.length / sampleRate;
  return spans.filter(([start, end]) => start > 0 && end < duration - 0.01);
}

const BUCKET_MS = 5;
const SPEECH_LEVEL_RATIO = 0.15;
const SUSTAIN_TOLERANCE_RATIO = 0.35;
const SUSTAIN_MS = 150;
const MAX_LEAD_SCAN_MS = 1500;

function bucketRms(samples: Int16Array, sampleRate: number): {
  rms: Float32Array;
  bucket: number;
  peak: number;
} {
  const bucket = Math.max(1, Math.floor((sampleRate * BUCKET_MS) / 1000));
  const buckets = Math.floor(samples.length / bucket);
  const rms = new Float32Array(Math.max(0, buckets));
  let peak = 0;
  for (let index = 0; index < buckets; index += 1) {
    let sum = 0;
    const start = index * bucket;
    for (let offset = 0; offset < bucket; offset += 1) {
      const value = samples[start + offset] / 32768;
      sum += value * value;
    }
    rms[index] = Math.sqrt(sum / bucket);
    if (rms[index] > peak) peak = rms[index];
  }
  return { rms, bucket, peak };
}

/**
 * Drops the noisy lead-in some TTS models emit before speech. A short burst of
 * static at the start stays above a simple "quiet" threshold, so we look for
 * the first *sustained* speech onset instead and cut everything before it,
 * keeping a short pre-roll so the first consonant is not clipped.
 */
export function trimLeadingSilence(
  pcm: Uint8Array,
  sampleRate = TTS_SAMPLE_RATE,
  prerollMs = 60,
): Uint8Array {
  const samples = toInt16(pcm);
  if (samples.length === 0) return pcm;
  const { rms, bucket, peak } = bucketRms(samples, sampleRate);
  if (rms.length === 0 || peak <= 0) return pcm;

  const speechLevel = peak * SPEECH_LEVEL_RATIO;
  const tolerance = speechLevel * SUSTAIN_TOLERANCE_RATIO;
  const sustain = Math.max(1, Math.round(SUSTAIN_MS / BUCKET_MS));
  const maxScan = Math.min(rms.length, Math.round(MAX_LEAD_SCAN_MS / BUCKET_MS));

  let onset: number | null = null;
  for (let index = 0; index < maxScan; index += 1) {
    if (rms[index] < speechLevel) continue;
    let sustained = true;
    const limit = Math.min(rms.length, index + sustain);
    for (let probe = index; probe < limit; probe += 1) {
      if (rms[probe] < tolerance) {
        sustained = false;
        break;
      }
    }
    if (sustained) {
      onset = index;
      break;
    }
  }
  if (onset === null) return pcm;

  const prerollSamples = Math.floor((prerollMs / 1000) * sampleRate);
  const cutSamples = Math.max(0, onset * bucket - prerollSamples);
  if (cutSamples <= 0) return pcm;
  return pcm.subarray(cutSamples * 2);
}

/**
 * Applies short linear fades to the first and last samples so that starting or
 * ending a scene never produces a click/pop.
 */
export function applyEdgeFades(
  pcm: Uint8Array,
  sampleRate = TTS_SAMPLE_RATE,
  fadeInMs = 15,
  fadeOutMs = 30,
): Uint8Array {
  const samples = toInt16(pcm);
  const count = samples.length;
  if (count === 0) return pcm;
  const output = new Int16Array(count);
  output.set(samples);
  const fadeIn = Math.min(
    Math.floor((fadeInMs / 1000) * sampleRate),
    Math.floor(count / 2),
  );
  for (let index = 0; index < fadeIn; index += 1) {
    output[index] = Math.round(output[index] * (index / fadeIn));
  }
  const fadeOut = Math.min(
    Math.floor((fadeOutMs / 1000) * sampleRate),
    Math.floor(count / 2),
  );
  for (let index = 0; index < fadeOut; index += 1) {
    const target = count - 1 - index;
    output[target] = Math.round(output[target] * (index / fadeOut));
  }
  const bytes = new Uint8Array(count * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < count; index += 1) {
    view.setInt16(index * 2, output[index], true);
  }
  return bytes;
}

export function computeWindowsFromPcm(
  pcm: Uint8Array,
  beats: Pick<Beat, "narration">[],
  sampleRate = TTS_SAMPLE_RATE,
): [number, number][] | null {
  const duration = pcmDuration(pcm, sampleRate);
  if (duration <= 0 || beats.length === 0) return null;
  const spans = detectSilentSpans(pcm, sampleRate);
  if (spans.length === 0) return null;
  const weights = beats.map((beat) => Math.max(1, beat.narration.length));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const tolerance = (0.35 * duration) / beats.length;
  const windows: [number, number][] = [];
  let cursor = 0;
  let consumed = 0;
  for (let index = 0; index < beats.length - 1; index += 1) {
    consumed += weights[index];
    const expected = (duration * consumed) / totalWeight;
    let chosen: [number, number] | null = null;
    for (const span of spans) {
      if (span[0] <= cursor) continue;
      const middle = (span[0] + span[1]) / 2;
      if (Math.abs(middle - expected) > tolerance) continue;
      if (!chosen || span[1] - span[0] > chosen[1] - chosen[0]) chosen = span;
    }
    const end = chosen ? chosen[0] : expected;
    windows.push([Number(cursor.toFixed(2)), Number(end.toFixed(2))]);
    cursor = end;
  }
  windows.push([Number(cursor.toFixed(2)), Number(duration.toFixed(2))]);
  return windows;
}

export function fallbackWindows(beats: Pick<Beat, "narration">[], duration: number) {
  return buildWindows(beats as Beat[], duration);
}
