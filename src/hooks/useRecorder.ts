import { useCallback, useRef, useState } from "react";
import type { Scene } from "../types/project";
import { buildWindows } from "../lib/time";

export interface RecordedResult {
  blob: Blob;
  duration: number;
  windows: [number, number][];
}

export function useRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingScene, setRecordingScene] = useState<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startAtRef = useRef(0);

  const stop = useCallback(async (scene?: Scene): Promise<RecordedResult | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return null;
    const elapsed = (performance.now() - startAtRef.current) / 1000;
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      };
      if (recorder.state !== "inactive") recorder.stop();
      else resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
    });
    streamRef.current?.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setRecordingScene(null);

    let duration = Math.max(1, elapsed);
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      const buffer = await context.decodeAudioData(await blob.arrayBuffer());
      duration = buffer.duration;
    } catch {
      /* keep elapsed duration */
    } finally {
      await context?.close().catch(() => undefined);
    }
    const windows = scene ? buildWindows(scene.beats, duration) : [];
    return { blob, duration, windows };
  }, []);

  const start = useCallback(async (sceneIndex: number): Promise<void> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("이 브라우저에서는 마이크 녹음을 지원하지 않습니다.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.start(200);
    startAtRef.current = performance.now();
    recorderRef.current = recorder;
    streamRef.current = stream;
    setRecordingScene(sceneIndex);
    setIsRecording(true);
  }, []);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setRecordingScene(null);
  }, []);

  return { isRecording, recordingScene, start, stop, cancel };
}
