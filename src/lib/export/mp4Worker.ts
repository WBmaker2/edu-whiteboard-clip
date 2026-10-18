import { ArrayBufferTarget, Muxer } from "mp4-muxer";

interface InitMessage {
  type: "init";
  width: number;
  height: number;
  codec: string;
  bitrate: number;
  fps: number;
  sampleRate: number;
  numberOfChannels: number;
  audioBitrate: number;
}

interface AudioMessage {
  type: "audio";
  data: ArrayBuffer;
}

interface FrameMessage {
  type: "frame";
  bitmap: ImageBitmap;
  timestampUs: number;
  durationUs: number;
  keyFrame: boolean;
}

type IncomingMessage = InitMessage | AudioMessage | FrameMessage | { type: "finish" };

interface WorkerScope {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  onmessage: ((event: MessageEvent) => void) | null;
}

const scope = self as unknown as WorkerScope;

let muxer: Muxer<ArrayBufferTarget> | null = null;
let videoEncoder: VideoEncoder | null = null;
let audioEncoder: AudioEncoder | null = null;
let encoderError: Error | null = null;
let audioConfig: { sampleRate: number; numberOfChannels: number } = {
  sampleRate: 48_000,
  numberOfChannels: 2,
};

function reportError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  scope.postMessage({ type: "error", message });
}

function closeEncoders(): void {
  try {
    videoEncoder?.close();
  } catch {
    /* already closed */
  }
  try {
    audioEncoder?.close();
  } catch {
    /* already closed */
  }
}

async function encodeAudio(message: AudioMessage): Promise<void> {
  if (!audioEncoder || !muxer) throw new Error("인코더가 준비되지 않았습니다.");
  const data = new Float32Array(message.data);
  const totalFrames = Math.floor(data.length / audioConfig.numberOfChannels);
  const channel0 = data.subarray(0, totalFrames);
  const channel1 = data.subarray(totalFrames, totalFrames * 2);
  const blockSize = 4096;
  for (let offset = 0; offset < totalFrames; offset += blockSize) {
    if (encoderError) throw encoderError;
    const frames = Math.min(blockSize, totalFrames - offset);
    const block = new Float32Array(frames * 2);
    block.set(channel0.subarray(offset, offset + frames), 0);
    block.set(channel1.subarray(offset, offset + frames), frames);
    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate: audioConfig.sampleRate,
      numberOfFrames: frames,
      numberOfChannels: audioConfig.numberOfChannels,
      timestamp: Math.round((offset / audioConfig.sampleRate) * 1_000_000),
      data: block,
    });
    audioEncoder.encode(audioData);
    audioData.close();
    while (audioEncoder.encodeQueueSize > 8) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  await audioEncoder.flush();
  if (encoderError) throw encoderError;
  scope.postMessage({ type: "audio-done" });
}

async function encodeFrame(message: FrameMessage): Promise<void> {
  if (!videoEncoder) throw new Error("인코더가 준비되지 않았습니다.");
  if (encoderError) {
    message.bitmap.close();
    throw encoderError;
  }
  const frame = new VideoFrame(message.bitmap, {
    timestamp: message.timestampUs,
    duration: message.durationUs,
  });
  message.bitmap.close();
  videoEncoder.encode(frame, { keyFrame: message.keyFrame });
  frame.close();
  while (videoEncoder.encodeQueueSize > 8) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  scope.postMessage({ type: "ack" });
}

scope.onmessage = (event: MessageEvent) => {
  const message = event.data as IncomingMessage;
  void (async () => {
    try {
      if (message.type === "init") {
        if (
          typeof VideoEncoder === "undefined" ||
          typeof AudioEncoder === "undefined" ||
          typeof AudioData === "undefined" ||
          typeof VideoFrame === "undefined"
        ) {
          scope.postMessage({ type: "unsupported" });
          return;
        }
        audioConfig = {
          sampleRate: message.sampleRate,
          numberOfChannels: message.numberOfChannels,
        };
        muxer = new Muxer({
          target: new ArrayBufferTarget(),
          video: {
            codec: "avc",
            width: message.width,
            height: message.height,
            frameRate: message.fps,
          },
          audio: {
            codec: "aac",
            numberOfChannels: message.numberOfChannels,
            sampleRate: message.sampleRate,
          },
          fastStart: "in-memory",
        });
        videoEncoder = new VideoEncoder({
          output: (chunk, meta) => muxer?.addVideoChunk(chunk, meta),
          error: (error) => {
            encoderError = error instanceof Error ? error : new Error(String(error));
          },
        });
        videoEncoder.configure({
          codec: message.codec,
          width: message.width,
          height: message.height,
          bitrate: message.bitrate,
          framerate: message.fps,
          latencyMode: "quality",
        });
        audioEncoder = new AudioEncoder({
          output: (chunk, meta) => muxer?.addAudioChunk(chunk, meta),
          error: (error) => {
            encoderError = error instanceof Error ? error : new Error(String(error));
          },
        });
        audioEncoder.configure({
          codec: "mp4a.40.2",
          sampleRate: message.sampleRate,
          numberOfChannels: message.numberOfChannels,
          bitrate: message.audioBitrate,
        });
        scope.postMessage({ type: "ready" });
        return;
      }
      if (message.type === "audio") {
        await encodeAudio(message);
        return;
      }
      if (message.type === "frame") {
        await encodeFrame(message);
        return;
      }
      if (message.type === "finish") {
        if (!videoEncoder || !muxer) throw new Error("인코더가 준비되지 않았습니다.");
        await videoEncoder.flush();
        if (encoderError) throw encoderError;
        muxer.finalize();
        const buffer = (muxer.target as ArrayBufferTarget).buffer;
        if (!buffer) throw new Error("MP4 파일을 만들지 못했습니다.");
        scope.postMessage({ type: "done", buffer }, [buffer]);
      }
    } catch (error) {
      closeEncoders();
      reportError(error);
    }
  })();
};
