export interface VoiceSchedule {
  /** Context time (seconds) at which playback should begin. */
  when: number;
  /** Buffer offset in seconds. */
  offset?: number;
  /** How many buffer seconds to play. Defaults to the rest of the buffer. */
  duration?: number;
  /** Playback rate. */
  rate?: number;
}

const FADE_IN_SECONDS = 0.02;
const FADE_OUT_SECONDS = 0.04;
const MIN_GAIN = 0.0001;

/**
 * Schedules one scene's voice buffer with short fades at both edges.
 *
 * Scene audio is decoded from WAV and started/stopped at arbitrary sample
 * positions. Without a ramp the sudden jump from 0 to the first sample (and
 * back at the end) produces an audible click/pop that feels like static at
 * every scene change. A short fade-in and fade-out on every voice removes that
 * boundary noise; 20ms is imperceptible even when resuming mid-scene.
 */
export function scheduleVoice(
  context: BaseAudioContext,
  destination: AudioNode,
  buffer: AudioBuffer,
  { when, offset = 0, duration, rate = 1 }: VoiceSchedule,
): { source: AudioBufferSourceNode; gain: GainNode } {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;

  const capture = Math.max(
    0.02,
    duration ?? Math.max(0, buffer.duration - offset),
  );
  const contextDuration = capture / rate;
  const end = when + contextDuration;

  const fadeIn = Math.min(FADE_IN_SECONDS, contextDuration / 2);
  const fadeOut = Math.min(FADE_OUT_SECONDS, contextDuration / 2);

  const gain = context.createGain();
  if (fadeIn > 0) {
    gain.gain.setValueAtTime(MIN_GAIN, when);
    gain.gain.exponentialRampToValueAtTime(1, when + fadeIn);
  } else {
    gain.gain.setValueAtTime(1, when);
  }
  if (fadeOut > 0.0005) {
    gain.gain.setValueAtTime(1, Math.max(when, end - fadeOut));
    gain.gain.linearRampToValueAtTime(MIN_GAIN, end);
  }

  source.connect(gain);
  gain.connect(destination);
  source.start(when, offset, capture);
  return { source, gain };
}

/** Ramps a scheduled voice down and stops it, avoiding a click on pause/seek. */
export function releaseVoice(
  context: BaseAudioContext | null,
  voice: { source: AudioBufferSourceNode; gain: GainNode },
  release = 0.02,
): void {
  const now = context ? context.currentTime : 0;
  try {
    if (context) {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(MIN_GAIN, now + release);
      voice.source.stop(now + release + 0.01);
    } else {
      voice.source.stop();
    }
  } catch {
    /* already stopped */
  }
  globalThis.setTimeout(() => {
    try {
      voice.source.disconnect();
      voice.gain.disconnect();
    } catch {
      /* already disconnected */
    }
  }, (release + 0.05) * 1000);
}
