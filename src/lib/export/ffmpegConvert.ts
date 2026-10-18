import type { FFmpeg } from "@ffmpeg/ffmpeg";

let ffmpegPromise: Promise<FFmpeg> | null = null;
let activeFfmpeg: FFmpeg | null = null;

export function ffmpegConversionSupported(): boolean {
  return typeof Worker !== "undefined";
}

async function loadFfmpeg(): Promise<FFmpeg> {
  if (ffmpegPromise) return ffmpegPromise;
  ffmpegPromise = (async () => {
    const [{ FFmpeg }, coreModule, wasmModule, workerModule] = await Promise.all([
      import("@ffmpeg/ffmpeg"),
      import("@ffmpeg/core?url"),
      import("@ffmpeg/core/wasm?url"),
      import("@ffmpeg/ffmpeg/worker?url"),
    ]);
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL: coreModule.default,
      wasmURL: wasmModule.default,
      classWorkerURL: workerModule.default,
    });
    activeFfmpeg = ffmpeg;
    return ffmpeg;
  })().catch((error) => {
    ffmpegPromise = null;
    throw error;
  });
  return ffmpegPromise;
}

export interface ConvertOptions {
  onProgress?: (percent: number, message: string) => void;
  signal?: AbortSignal;
}

export async function convertWebmToMp4(
  webm: Blob,
  options: ConvertOptions = {},
): Promise<Blob> {
  if (options.signal?.aborted) {
    throw new DOMException("Export cancelled", "AbortError");
  }
  options.onProgress?.(1, "ffmpeg 도구를 내려받는 중...(약 31MB, 최초 1회)");
  const ffmpeg = await loadFfmpeg();
  if (options.signal?.aborted) {
    throw new DOMException("Export cancelled", "AbortError");
  }

  const progressHandler = ({ progress }: { progress: number }) => {
    options.onProgress?.(
      Math.max(2, Math.min(98, Math.round(progress * 100))),
      "WebM을 MP4(H.264/AAC)로 변환하는 중...",
    );
  };
  ffmpeg.on("progress", progressHandler);

  try {
    await ffmpeg.writeFile("input.webm", new Uint8Array(await webm.arrayBuffer()));
    if (options.signal?.aborted) {
      throw new DOMException("Export cancelled", "AbortError");
    }
    await ffmpeg.exec([
      "-i",
      "input.webm",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "output.mp4",
    ]);
    const data = await ffmpeg.readFile("output.mp4");
    if (typeof data === "string") throw new Error("변환 결과를 읽지 못했습니다.");
    options.onProgress?.(100, "MP4 변환이 완료되었습니다.");
    const bytes = data as unknown as Uint8Array;
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    return new Blob([copy], { type: "video/mp4" });
  } finally {
    ffmpeg.off("progress", progressHandler);
    try {
      await ffmpeg.deleteFile("input.webm");
      await ffmpeg.deleteFile("output.mp4");
    } catch {
      /* files may not exist when the run failed early */
    }
  }
}

export function cancelFfmpegConversion(): void {
  if (activeFfmpeg) {
    activeFfmpeg.terminate();
    activeFfmpeg = null;
    ffmpegPromise = null;
  }
}
