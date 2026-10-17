import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import type { Project } from "../../types/project";
import { activeBeatIndex, locateTime, projectDuration } from "../time";
import { CANVAS_WIDTH, renderScene } from "../renderer";
import { scheduleBgm } from "../bgm";
import { RESOLUTIONS, type ResolutionId } from "../../data/presets";

const AUDIO_SAMPLE_RATE = 48_000;
const FPS = 30;

export interface Mp4ExportOptions {
  project: Project;
  resolution: ResolutionId;
  captions: boolean;
  bgmVolume: number;
  translations?: string[][];
  captionLang: string;
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
  const candidates =
    width >= 1920
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
          const source = context.createBufferSource();
          source.buffer = decoded;
          source.connect(context.destination);
          source.start(Math.max(0, cursor));
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

export async function exportMp4({
  project,
  resolution,
  captions,
  bgmVolume,
  translations,
  captionLang,
  signal,
  onProgress,
}: Mp4ExportOptions): Promise<Mp4ExportResult> {
  if (!hasWebCodecs()) {
    throw new Error("이 브라우저는 WebCodecs MP4 인코딩을 지원하지 않습니다.");
  }
  const preset = RESOLUTIONS.find((item) => item.id === resolution) ?? RESOLUTIONS[0];
  const codec = await pickVideoCodec(preset.width, preset.height);
  if (!codec) {
    throw new Error("이 브라우저에서 사용할 수 있는 H.264 인코더를 찾지 못했습니다.");
  }
  const total = projectDuration(project);
  const canvas = document.createElement("canvas");
  canvas.width = preset.width;
  canvas.height = preset.height;
  canvas.style.position = "fixed";
  canvas.style.left = "-10000px";
  canvas.style.top = "0";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 초기화하지 못했습니다.");
  const scale = preset.width / CANVAS_WIDTH;
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
