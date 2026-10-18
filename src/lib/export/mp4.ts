import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import type { AspectRatio, Project } from "../../types/project";
import { activeBeatIndex, locateTime, projectDuration } from "../time";
import { canvasProfile, renderScene } from "../renderer";
import { scheduleBgm } from "../bgm";
import { scheduleVoice } from "../voiceTrack";
import { ensureExportFonts } from "../fonts";
import { preloadProjectImages } from "../assets";
import { resolutionPreset, type ResolutionId } from "../../data/presets";

const AUDIO_SAMPLE_RATE = 48_000;
const FPS = 30;

export interface Mp4ExportOptions {
  project: Project;
  resolution: ResolutionId;
  aspect?: AspectRatio;
  captions: boolean;
  bgmVolume: number;
  translations?: string[][];
  captionLang: string;
  penTip?: boolean;
  signal?: AbortSignal;
  onProgress?: (percent: number, message: string) => void;
}

export interface Mp4ExportResult {
  blob: Blob;
  mimeType: string;
  extension: "mp4";
}

export function hasWebCodecs(): boolean {
  return (
    typeof VideoEncoder !== "undefined" &&
    typeof AudioEncoder !== "undefined" &&
    typeof AudioData !== "undefined" &&
    typeof VideoFrame !== "undefined" &&
    typeof OfflineAudioContext !== "undefined"
  );
}

async function pickVideoCodec(width: number, height: number): Promise<string | null> {
  if (!hasWebCodecs()) return null;
  const macroblocks = Math.ceil(width / 16) * Math.ceil(height / 16);
  const candidates =
    macroblocks > 3600
      ? ["avc1.640028", "avc1.4d0028", "avc1.42E028"]
      : ["avc1.42E01F", "avc1.4d001F", "avc1.64001F"];
  for (const codec of candidates) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec,
        width,
        height,
        bitrate: 6_000_000,
        framerate: FPS,
      });
      if (support.supported) return codec;
    } catch {
      /* try next codec */
    }
  }
  return null;
}

export async function isMp4Supported(width: number, height: number): Promise<boolean> {
  return (await pickVideoCodec(width, height)) !== null;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
}

class WorkerUnsupportedError extends Error {}

function canUseWorker(): boolean {
  return typeof Worker !== "undefined" && typeof createImageBitmap === "function";
}

export async function exportMp4(options: Mp4ExportOptions): Promise<Mp4ExportResult> {
  if (!hasWebCodecs()) {
    throw new Error("이 브라우저는 WebCodecs MP4 인코딩을 지원하지 않습니다.");
  }
  await ensureExportFonts();
  const preset = resolutionPreset(options.resolution, options.aspect ?? "16:9");
  const codec = await pickVideoCodec(preset.width, preset.height);
  if (!codec) {
    throw new Error("이 브라우저에서 사용할 수 있는 H.264 인코더를 찾지 못했습니다.");
  }
  if (canUseWorker()) {
    try {
      return await exportMp4WithWorker(options, preset, codec);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      if (!(error instanceof WorkerUnsupportedError)) throw error;
    }
  }
  return exportMp4OnMainThread(options, preset, codec);
}

async function mixAudio(project: Project, duration: number, bgmVolume: number): Promise<AudioBuffer> {
  const context = new OfflineAudioContext(
    2,
    Math.max(1, Math.ceil(duration * AUDIO_SAMPLE_RATE)),
    AUDIO_SAMPLE_RATE,
  );
  const decodeContext = new AudioContext();
  try {
    let cursor = 0;
    const duckSpans: { start: number; end: number }[] = [];
    for (const scene of project.scenes) {
      const sceneDuration = Math.max(0.1, scene.duration);
      if (scene.audioBlob && scene.audioSource !== "none") {
        try {
          const decoded = await decodeContext.decodeAudioData(
            (await scene.audioBlob.arrayBuffer()).slice(0),
          );
          scheduleVoice(context, context.destination, decoded, {
            when: Math.max(0, cursor),
            duration: Math.min(decoded.duration, sceneDuration),
          });
          duckSpans.push({
            start: cursor,
            end: Math.min(duration, cursor + sceneDuration),
          });
        } catch {
          /* skip unreadable scene audio */
        }
      }
      cursor += sceneDuration;
    }
    if (project.bgmId !== "none" && bgmVolume > 0) {
      scheduleBgm({
        context,
        destination: context.destination,
        presetId: project.bgmId,
        volume: bgmVolume,
        startTime: 0,
        duration,
        duckSpans,
      });
    }
    return await context.startRendering();
  } finally {
    await decodeContext.close().catch(() => undefined);
  }
}

const WORKER_WINDOW = 4;

async function exportMp4WithWorker(
  {
    project,
    resolution,
    aspect,
    captions,
    bgmVolume,
    translations,
    captionLang,
    penTip,
    signal,
    onProgress,
  }: Mp4ExportOptions,
  preset: ReturnType<typeof resolutionPreset>,
  codec: string,
): Promise<Mp4ExportResult> {
  const total = projectDuration(project);
  throwIfAborted(signal);
  const assetImages = await preloadProjectImages(project);

  onProgress?.(4, "오디오를 믹싱하는 중...");
  const audioBuffer = await mixAudio(project, total, bgmVolume);
  throwIfAborted(signal);

  const worker = new Worker(new URL("./mp4Worker.ts", import.meta.url), {
    type: "module",
  });
  let workerError: Error | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let inFlight = 0;
  const waiters: Array<() => void> = [];

  let settleReady: ((state: "ready" | "unsupported" | "error") => void) | null = null;
  const readyPromise = new Promise<"ready" | "unsupported" | "error">((resolve) => {
    settleReady = resolve;
  });
  let settleAudio: (() => void) | null = null;
  const audioPromise = new Promise<void>((resolve) => {
    settleAudio = resolve;
  });
  let settleDone: ((buffer: ArrayBuffer) => void) | null = null;
  let failDone: ((error: Error) => void) | null = null;
  const donePromise = new Promise<ArrayBuffer>((resolve, reject) => {
    settleDone = resolve;
    failDone = reject;
  });
  void donePromise.catch(() => undefined);

  worker.onmessage = (event: MessageEvent) => {
    const message = event.data as {
      type: string;
      buffer?: ArrayBuffer;
      message?: string;
    };
    if (message.type === "ready") {
      settleReady?.("ready");
      return;
    }
    if (message.type === "unsupported") {
      settleReady?.("unsupported");
      return;
    }
    if (message.type === "audio-done") {
      settleAudio?.();
      return;
    }
    if (message.type === "ack") {
      inFlight -= 1;
      const next = waiters.shift();
      if (next) {
        inFlight += 1;
        next();
      }
      return;
    }
    if (message.type === "done" && message.buffer) {
      settleDone?.(message.buffer);
      return;
    }
    if (message.type === "error") {
      workerError = new Error(message.message ?? "MP4 인코딩 중 오류가 발생했습니다.");
      settleReady?.("error");
      settleAudio?.();
      while (waiters.length > 0) waiters.shift()?.();
      failDone?.(workerError);
    }
  };

  const onAbort = () => {
    workerError = workerError ?? new DOMException("Export cancelled", "AbortError");
    settleReady?.("error");
    settleAudio?.();
    while (waiters.length > 0) waiters.shift()?.();
    failDone?.(workerError);
    worker.terminate();
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    worker.postMessage({
      type: "init",
      width: preset.width,
      height: preset.height,
      codec,
      bitrate: resolution === "fhd" ? 8_000_000 : 4_500_000,
      fps: FPS,
      sampleRate: AUDIO_SAMPLE_RATE,
      numberOfChannels: 2,
      audioBitrate: 128_000,
    });
    const state = await readyPromise;
    if (state !== "ready") {
      if (workerError) throw workerError;
      if (state === "unsupported") {
        throw new WorkerUnsupportedError("이 환경에서는 워커 인코딩을 사용할 수 없습니다.");
      }
      throw new Error("MP4 인코더를 준비하지 못했습니다.");
    }
    throwIfAborted(signal);

    onProgress?.(12, "오디오를 인코딩하는 중...");
    const planar = new Float32Array(audioBuffer.length * 2);
    planar.set(audioBuffer.getChannelData(0), 0);
    planar.set(audioBuffer.getChannelData(1), audioBuffer.length);
    worker.postMessage({ type: "audio", data: planar.buffer }, [planar.buffer]);
    await audioPromise;
    if (workerError) throw workerError;
    throwIfAborted(signal);

    canvas = document.createElement("canvas");
    canvas.width = preset.width;
    canvas.height = preset.height;
    canvas.style.position = "fixed";
    canvas.style.left = "-10000px";
    canvas.style.top = "0";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("캔버스를 초기화하지 못했습니다.");
    const scale = preset.width / canvasProfile(aspect ?? "16:9").base;
    ctx.scale(scale, scale);

    const acquireSlot = async (): Promise<void> => {
      if (workerError) throw workerError;
      if (inFlight < WORKER_WINDOW) {
        inFlight += 1;
        return;
      }
      await new Promise<void>((resolve) => waiters.push(resolve));
      if (workerError) throw workerError;
    };

    onProgress?.(18, "장면을 빠르게 그리는 중...");
    const frameCount = Math.max(1, Math.ceil(total * FPS));
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      throwIfAborted(signal);
      if (workerError) throw workerError;
      const time = Math.min(total, frameIndex / FPS);
      const { index, localTime } = locateTime(project.scenes, time);
      const scene = project.scenes[index];
      const translated =
        captionLang !== "ko" ? translations?.[index] : undefined;
      const beatIndex = activeBeatIndex(scene, localTime);
      renderScene(ctx, scene, localTime, {
        themeId: project.themeId,
        visualStyle: project.visualStyle,
        layoutStyle: project.layoutStyle,
        captions,
        captionText: captions
          ? translated?.[beatIndex] ?? scene.beats[beatIndex]?.narration
          : undefined,
        sceneIndex: index,
        penTip,
        aspect,
        assetImages,
      });
      await acquireSlot();
      const bitmap = await createImageBitmap(canvas);
      if (workerError) {
        bitmap.close();
        throw workerError;
      }
      worker.postMessage(
        {
          type: "frame",
          bitmap,
          timestampUs: Math.round((frameIndex / FPS) * 1_000_000),
          durationUs: Math.round((1 / FPS) * 1_000_000),
          keyFrame: frameIndex % (FPS * 2) === 0,
        },
        [bitmap],
      );
      if (frameIndex % 10 === 0) {
        onProgress?.(
          Math.min(96, 18 + Math.round((frameIndex / frameCount) * 78)),
          `${index + 1}/${project.scenes.length} 장면을 MP4로 인코딩하는 중...`,
        );
      }
    }

    worker.postMessage({ type: "finish" });
    const buffer = await donePromise;
    if (workerError) throw workerError;
    onProgress?.(100, "MP4 파일이 준비되었습니다.");
    return {
      blob: new Blob([buffer], { type: "video/mp4" }),
      mimeType: "video/mp4",
      extension: "mp4",
    };
  } finally {
    signal?.removeEventListener("abort", onAbort);
    worker.terminate();
    canvas?.remove();
  }
}

async function exportMp4OnMainThread(
  {
    project,
    resolution,
    aspect,
    captions,
    bgmVolume,
    translations,
    captionLang,
    penTip,
    signal,
    onProgress,
  }: Mp4ExportOptions,
  preset: ReturnType<typeof resolutionPreset>,
  codec: string,
): Promise<Mp4ExportResult> {
  const total = projectDuration(project);
  const assetImages = await preloadProjectImages(project);
  const canvas = document.createElement("canvas");
  canvas.width = preset.width;
  canvas.height = preset.height;
  canvas.style.position = "fixed";
  canvas.style.left = "-10000px";
  canvas.style.top = "0";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 초기화하지 못했습니다.");
  const scale = preset.width / canvasProfile(aspect ?? "16:9").base;
  ctx.scale(scale, scale);

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: "avc",
      width: preset.width,
      height: preset.height,
      frameRate: FPS,
    },
    audio: {
      codec: "aac",
      numberOfChannels: 2,
      sampleRate: AUDIO_SAMPLE_RATE,
    },
    fastStart: "in-memory",
  });

  let encoderError: Error | null = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      encoderError = error instanceof Error ? error : new Error(String(error));
    },
  });
  videoEncoder.configure({
    codec,
    width: preset.width,
    height: preset.height,
    bitrate: resolution === "fhd" ? 8_000_000 : 4_500_000,
    framerate: FPS,
    latencyMode: "quality",
  });
  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (error) => {
      encoderError = error instanceof Error ? error : new Error(String(error));
    },
  });
  audioEncoder.configure({
    codec: "mp4a.40.2",
    sampleRate: AUDIO_SAMPLE_RATE,
    numberOfChannels: 2,
    bitrate: 128_000,
  });

  const waitForEncoder = async (encoder: VideoEncoder | AudioEncoder) => {
    while (encoder.encodeQueueSize > 8) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      throwIfAborted(signal);
    }
  };

  try {
    onProgress?.(4, "오디오를 믹싱하는 중...");
    const audioBuffer = await mixAudio(project, total, bgmVolume);
    throwIfAborted(signal);

    onProgress?.(12, "오디오를 인코딩하는 중...");
    const channels = [
      audioBuffer.getChannelData(0),
      audioBuffer.getChannelData(1),
    ];
    const blockSize = 4096;
    for (let offset = 0; offset < audioBuffer.length; offset += blockSize) {
      throwIfAborted(signal);
      const frames = Math.min(blockSize, audioBuffer.length - offset);
      const data = new Float32Array(frames * 2);
      data.set(channels[0].subarray(offset, offset + frames), 0);
      data.set(channels[1].subarray(offset, offset + frames), frames);
      const audioData = new AudioData({
        format: "f32-planar",
        sampleRate: AUDIO_SAMPLE_RATE,
        numberOfFrames: frames,
        numberOfChannels: 2,
        timestamp: Math.round((offset / AUDIO_SAMPLE_RATE) * 1_000_000),
        data,
      });
      audioEncoder.encode(audioData);
      audioData.close();
      await waitForEncoder(audioEncoder);
    }
    await audioEncoder.flush();
    if (encoderError) throw encoderError;

    onProgress?.(18, "장면을 빠르게 그리는 중...");
    const frameCount = Math.max(1, Math.ceil(total * FPS));
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      throwIfAborted(signal);
      if (encoderError) throw encoderError;
      const time = Math.min(total, frameIndex / FPS);
      const { index, localTime } = locateTime(project.scenes, time);
      const scene = project.scenes[index];
      const translated =
        captionLang !== "ko" ? translations?.[index] : undefined;
      const beatIndex = activeBeatIndex(scene, localTime);
      renderScene(ctx, scene, localTime, {
        themeId: project.themeId,
        visualStyle: project.visualStyle,
        layoutStyle: project.layoutStyle,
        captions,
        captionText: captions
          ? translated?.[beatIndex] ?? scene.beats[beatIndex]?.narration
          : undefined,
        sceneIndex: index,
        penTip,
        aspect,
        assetImages,
      });
      const frame = new VideoFrame(canvas, {
        timestamp: Math.round((frameIndex / FPS) * 1_000_000),
        duration: Math.round((1 / FPS) * 1_000_000),
      });
      videoEncoder.encode(frame, { keyFrame: frameIndex % (FPS * 2) === 0 });
      frame.close();
      await waitForEncoder(videoEncoder);
      if (frameIndex % 10 === 0) {
        onProgress?.(
          Math.min(96, 18 + Math.round((frameIndex / frameCount) * 78)),
          `${index + 1}/${project.scenes.length} 장면을 MP4로 인코딩하는 중...`,
        );
      }
    }
    await videoEncoder.flush();
    if (encoderError) throw encoderError;
    muxer.finalize();
    const buffer = (muxer.target as ArrayBufferTarget).buffer;
    if (!buffer) throw new Error("MP4 파일을 만들지 못했습니다.");
    onProgress?.(100, "MP4 파일이 준비되었습니다.");
    return {
      blob: new Blob([buffer], { type: "video/mp4" }),
      mimeType: "video/mp4",
      extension: "mp4",
    };
  } catch (error) {
    try {
      videoEncoder.close();
    } catch {
      /* already closed */
    }
    try {
      audioEncoder.close();
    } catch {
      /* already closed */
    }
    throw error;
  } finally {
    canvas.remove();
  }
}
