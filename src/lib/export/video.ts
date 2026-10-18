import type { AspectRatio, Project } from "../../types/project";
import { AudioEngine } from "../audioEngine";
import { activeBeatIndex, locateTime, projectDuration } from "../time";
import { canvasProfile, renderScene } from "../renderer";
import { resolutionPreset, type ResolutionId } from "../../data/presets";
import { ensureExportFonts } from "../fonts";
import { preloadProjectImages } from "../assets";
import { withWebmDuration } from "./webmDuration";

const WEBM_MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

function chooseWebmMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const mime of WEBM_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

export interface ExportVideoOptions {
  project: Project;
  format: "webm" | "mp4";
  resolution: ResolutionId;
  aspect?: AspectRatio;
  captions: boolean;
  bgmVolume: number;
  translations?: string[][];
  captionLang: string;
  penTip?: boolean;
  signal?: AbortSignal;
  onProgress?: (percent: number, message: string) => void;
  onFormatFallback?: (message: string) => void;
}

export interface ExportVideoResult {
  blob: Blob;
  mimeType: string;
  extension: "webm" | "mp4";
}

async function exportWebm({
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
}: ExportVideoOptions): Promise<ExportVideoResult> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("이 브라우저는 영상 녹화(MediaRecorder)를 지원하지 않습니다.");
  }
  const mimeType = chooseWebmMime();
  if (!mimeType) {
    throw new Error("이 브라우저에서 사용할 수 있는 영상 형식이 없습니다. Chrome 최신 버전을 권장합니다.");
  }
  const preset = resolutionPreset(resolution, aspect ?? "16:9");
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

  const engine = new AudioEngine();
  let recorder: MediaRecorder | null = null;
  let raf = 0;
  try {
    onProgress?.(2, "오디오와 캔버스를 준비하는 중...");
    await ensureExportFonts();
    const assetImages = await preloadProjectImages(project);
    await engine.loadProject(project);
    await engine.ensure();
    engine.setMonitor(false);
    engine.setBgm(project.bgmId, bgmVolume);
    engine.setSfx(false);

    const first = project.scenes[0];
    renderScene(ctx, first, 0, {
      themeId: project.themeId,
      visualStyle: project.visualStyle,
      layoutStyle: project.layoutStyle,
      captions,
      captionText: captions ? first.beats[0]?.narration : undefined,
      sceneIndex: 0,
      penTip,
      aspect,
      assetImages,
    });

    const canvasStream = canvas.captureStream(30);
    const audioStream = engine.getRecordingStream();
    const tracks = [
      ...canvasStream.getVideoTracks(),
      ...(audioStream ? audioStream.getAudioTracks() : []),
    ];
    const combined = new MediaStream(tracks);
    recorder = new MediaRecorder(combined, {
      mimeType,
      videoBitsPerSecond: resolution === "fhd" ? 8_000_000 : 4_500_000,
      audioBitsPerSecond: 128_000,
    });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    let recorderError: Error | null = null;
    recorder.onerror = (event) => {
      recorderError = new Error(
        `녹화 중 오류가 발생했습니다: ${String((event as any)?.error?.message ?? "unknown")}`,
      );
    };
    const stopped = new Promise<void>((resolve) => {
      if (!recorder) return resolve();
      recorder.onstop = () => resolve();
    });

    recorder.start(1000);
    const total = projectDuration(project);
    await engine.play(0, 1);
    onProgress?.(5, "장면을 실시간으로 인코딩하는 중...");

    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (signal?.aborted) {
          reject(new DOMException("Export cancelled", "AbortError"));
          return;
        }
        if (recorderError) {
          reject(recorderError);
          return;
        }
        const time = engine.getTime(total);
        const { index, localTime } = locateTime(project.scenes, time);
        const scene = project.scenes[index];
        const captionForLang =
          captionLang !== "ko" ? translations?.[index] : undefined;
        const beatIndex = activeBeatIndex(scene, localTime);
        renderScene(ctx, scene, localTime, {
          themeId: project.themeId,
          visualStyle: project.visualStyle,
          layoutStyle: project.layoutStyle,
          captions,
          captionText: captions
            ? captionForLang?.[beatIndex] ?? scene.beats[beatIndex]?.narration
            : undefined,
          sceneIndex: index,
          penTip,
          aspect,
          assetImages,
        });
        const percent = Math.min(95, 5 + Math.round((time / total) * 90));
        onProgress?.(percent, `${index + 1}/${project.scenes.length} 장면 인코딩 중...`);
        if (time >= total - 0.05) {
          const lastScene = project.scenes[project.scenes.length - 1];
          renderScene(ctx, lastScene, Math.max(0, lastScene.duration - 0.001), {
            themeId: project.themeId,
            visualStyle: project.visualStyle,
            layoutStyle: project.layoutStyle,
            captions,
            captionText: captions
              ? lastScene.beats[lastScene.beats.length - 1]?.narration
              : undefined,
            sceneIndex: project.scenes.length - 1,
            penTip,
            aspect,
            assetImages,
          });
          resolve();
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });

    onProgress?.(97, "영상 파일을 마무리하는 중...");
    if (recorder.state !== "inactive") {
      recorder.requestData();
      recorder.stop();
    }
    await stopped;
    await engine.dispose();
    const raw = new Blob(chunks, { type: mimeType });
    if (raw.size === 0) throw new Error("빈 영상이 생성되었습니다. 다시 시도해 주세요.");
    const blob = await withWebmDuration(raw, total * 1000);
    onProgress?.(100, "영상 파일이 준비되었습니다.");
    return { blob, mimeType, extension: "webm" };
  } catch (error) {
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    await engine.dispose();
    throw error;
  } finally {
    cancelAnimationFrame(raf);
    canvas.remove();
  }
}

export async function exportVideo(
  options: ExportVideoOptions,
): Promise<ExportVideoResult> {
  if (options.format === "mp4") {
    const preset = resolutionPreset(options.resolution, options.aspect ?? "16:9");
    const mp4 = await import("./mp4");
    const supported = await mp4.isMp4Supported(preset.width, preset.height);
    if (supported) {
      try {
        return await mp4.exportMp4(options);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        options.onFormatFallback?.(
          "MP4 인코딩 중 문제가 발생해 WebM으로 대신 저장합니다.",
        );
      }
    } else {
      options.onFormatFallback?.(
        "이 브라우저에서는 MP4를 지원하지 않아 WebM으로 저장합니다.",
      );
    }
  }
  return exportWebm(options);
}
