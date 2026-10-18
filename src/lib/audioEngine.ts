import type { Project } from "../types/project";
import { sceneStart } from "./time";
import { scheduleBgm, type BgmHandle } from "./bgm";
import { releaseVoice, scheduleVoice } from "./voiceTrack";

interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private monitor: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private recording: MediaStreamAudioDestinationNode | null = null;
  private buffers: (AudioBuffer | null)[] = [];
  private scenes: Project["scenes"] = [];
  private totalDuration = 0;
  private voices: Voice[] = [];
  private bgmHandle: BgmHandle | null = null;
  private bgmId = "none";
  private bgmVolume = 0.4;
  private sfxEnabled = true;
  private anchorContextTime = 0;
  private anchorProjectTime = 0;
  private rate = 1;
  private playing = false;

  async ensure(): Promise<AudioContext> {
    if (this.context) {
      if (this.context.state === "suspended") await this.context.resume();
      return this.context;
    }
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    const context: AudioContext = new Ctor();
    this.context = context;
    this.master = context.createGain();
    this.monitor = context.createGain();
    this.voiceGain = context.createGain();
    this.musicGain = context.createGain();
    this.recording = context.createMediaStreamDestination();
    this.voiceGain.connect(this.master);
    this.musicGain.connect(this.master);
    this.master.connect(this.monitor);
    this.monitor.connect(context.destination);
    this.master.connect(this.recording);
    return context;
  }

  get hasContext(): boolean {
    return Boolean(this.context);
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  async loadProject(project: Project): Promise<void> {
    const context = await this.ensure();
    this.stop();
    this.scenes = project.scenes;
    this.totalDuration = project.scenes.reduce(
      (sum, scene) => sum + Math.max(0.1, scene.duration),
      0,
    );
    this.buffers = await Promise.all(
      project.scenes.map(async (scene) => {
        if (!scene.audioBlob || scene.audioSource === "none") return null;
        try {
          const data = await scene.audioBlob.arrayBuffer();
          return await context.decodeAudioData(data.slice(0));
        } catch {
          return null;
        }
      }),
    );
  }

  getSceneBuffer(index: number): AudioBuffer | null {
    return this.buffers[index] ?? null;
  }

  async play(projectTime: number, rate: number): Promise<void> {
    const context = await this.ensure();
    this.stopSources();
    this.stopBgm();
    this.anchorContextTime = context.currentTime;
    this.anchorProjectTime = projectTime;
    this.rate = rate;
    this.playing = true;
    this.scenes.forEach((scene, index) => {
      const buffer = this.buffers[index];
      if (!buffer) return;
      const start = sceneStart(this.scenes, index);
      const end = start + Math.max(0.1, scene.duration);
      if (end <= projectTime) return;
      const offset = Math.max(0, projectTime - start);
      if (offset >= buffer.duration) return;
      const when = context.currentTime + Math.max(0, start - projectTime) / rate;
      const capture = Math.max(
        0.05,
        Math.min(buffer.duration - offset, Math.max(0.1, scene.duration)),
      );
      const voice = scheduleVoice(context, this.voiceGain as AudioNode, buffer, {
        when,
        offset,
        duration: capture,
        rate,
      });
      this.voices.push(voice);
    });
    this.startBgm(projectTime);
  }

  pause(): number {
    const total = this.totalDuration || Number.POSITIVE_INFINITY;
    const time = this.getTime(total);
    this.stopSources();
    this.stopBgm();
    this.playing = false;
    return Math.max(0, time);
  }

  stop(): number {
    if (!this.playing && this.voices.length === 0 && !this.bgmHandle) return 0;
    const total = this.totalDuration || Number.POSITIVE_INFINITY;
    const time = this.playing ? this.getTime(total) : 0;
    this.stopSources();
    this.stopBgm();
    this.playing = false;
    return Math.max(0, time);
  }

  private stopSources(): void {
    for (const voice of this.voices) {
      releaseVoice(this.context, voice);
    }
    this.voices = [];
  }

  getTime(total: number): number {
    if (!this.context || !this.playing) return this.anchorProjectTime;
    const elapsed = this.context.currentTime - this.anchorContextTime;
    const time = this.anchorProjectTime + elapsed * this.rate;
    if (!Number.isFinite(total)) return Math.max(0, time);
    return Math.min(total, Math.max(0, time));
  }

  setBgm(id: string, volume: number): void {
    const idChanged = this.bgmId !== id;
    this.bgmId = id;
    this.bgmVolume = volume;
    if (!idChanged && this.bgmHandle) {
      this.bgmHandle.setVolume(volume);
      return;
    }
    if (this.playing) {
      const time = this.getTime(this.totalDuration || Number.POSITIVE_INFINITY);
      this.stopBgm();
      this.startBgm(time);
    }
  }

  setSfx(enabled: boolean): void {
    this.sfxEnabled = enabled;
  }

  setMonitor(enabled: boolean): void {
    if (this.monitor && this.context) {
      this.monitor.gain.setTargetAtTime(
        enabled ? 1 : 0,
        this.context.currentTime,
        0.05,
      );
    }
  }

  tick(): void {
    if (!this.sfxEnabled || !this.context || !this.voiceGain) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(1180, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    oscillator.connect(gain);
    gain.connect(this.voiceGain);
    oscillator.start(now);
    oscillator.stop(now + 0.18);
  }

  private startBgm(fromTime: number): void {
    if (!this.context || !this.musicGain || this.bgmId === "none") return;
    const remaining = this.totalDuration - fromTime;
    if (remaining <= 0.2) return;
    const duckSpans = this.scenes
      .map((scene, index) => {
        if (!this.buffers[index]) return null;
        const start = sceneStart(this.scenes, index) - fromTime;
        return { start, end: start + Math.max(0.1, scene.duration) };
      })
      .filter((span): span is { start: number; end: number } => span !== null);
    this.bgmHandle = scheduleBgm({
      context: this.context,
      destination: this.musicGain,
      presetId: this.bgmId,
      volume: this.bgmVolume,
      startTime: this.context.currentTime,
      duration: remaining,
      duckSpans,
    });
  }

  private stopBgm(): void {
    this.bgmHandle?.stop();
    this.bgmHandle = null;
  }

  getRecordingStream(): MediaStream | null {
    return this.recording?.stream ?? null;
  }

  async dispose(): Promise<void> {
    this.stop();
    if (this.context) {
      await this.context.close().catch(() => undefined);
    }
    this.context = null;
    this.buffers = [];
    this.scenes = [];
  }
}
