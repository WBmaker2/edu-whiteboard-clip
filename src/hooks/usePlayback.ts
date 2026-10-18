import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AspectRatio, Project } from "../types/project";
import { AudioEngine } from "../lib/audioEngine";
import { activeBeatIndex, locateTime, projectDuration, sceneStart } from "../lib/time";
import { renderScene } from "../lib/renderer";
import type { DecodedVisual } from "../lib/renderer/core";

export interface PlaybackOptions {
  themeId: Project["themeId"];
  visualStyle: Project["visualStyle"];
  layoutStyle: Project["layoutStyle"];
  captions: boolean;
  captionLang: string;
  translations: Record<string, string[][]>;
  bgmId: string;
  bgmVolume: number;
  sfx: boolean;
  penTip: boolean;
  aspect?: AspectRatio;
  assetImages?: ReadonlyMap<string, DecodedVisual>;
  onRenderError?: (error: unknown) => void;
}

export function usePlayback(
  project: Project | null,
  options: PlaybackOptions,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
) {
  const engineRef = useRef<AudioEngine | null>(null);
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  const [activeScene, setActiveScene] = useState(0);
  const [ready, setReady] = useState(false);
  const rafRef = useRef(0);
  const timeRef = useRef(0);
  const rateRef = useRef(1);
  const playingRef = useRef(false);
  const lastBeatRef = useRef(-1);
  const renderErrorRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const projectRef = useRef(project);
  projectRef.current = project;

  const duration = project ? projectDuration(project) : 0;
  const total = useMemo(() => duration, [duration]);

  const draw = useCallback(
    (value: number) => {
      try {
        const current = projectRef.current;
        const canvas = canvasRef.current;
        if (!current || !canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const { index, localTime } = locateTime(current.scenes, value);
        const scene = current.scenes[index];
        const opts = optionsRef.current;
        const preview = !playingRef.current && localTime < 0.05;
        const translated =
          opts.captionLang !== "ko" ? opts.translations[opts.captionLang]?.[index] : undefined;
        const beatIndex = preview ? 0 : activeBeatIndex(scene, localTime);
        renderScene(ctx, scene, preview ? Math.min(2, scene.duration) : localTime, {
          themeId: opts.themeId,
          visualStyle: opts.visualStyle,
          layoutStyle: opts.layoutStyle,
          captions: opts.captions,
          captionText: opts.captions
            ? translated?.[beatIndex] ?? scene.beats[beatIndex]?.narration
            : undefined,
          sceneIndex: index,
          revealLimit: preview ? "all" : undefined,
          penTip: opts.penTip && !preview,
          aspect: opts.aspect,
          assetImages: opts.assetImages,
        });
        setActiveScene(index);
      } catch (error) {
        if (!renderErrorRef.current) {
          renderErrorRef.current = true;
          optionsRef.current.onRenderError?.(error);
        }
        engineRef.current?.pause();
        playingRef.current = false;
        setIsPlaying(false);
        cancelAnimationFrame(rafRef.current);
      }
    },
    [canvasRef],
  );

  useEffect(() => {
    const engine = new AudioEngine();
    engineRef.current = engine;
    return () => {
      void engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const audioKey = project
    ? project.scenes.map((scene) => scene.audioUrl ?? "none").join("|")
    : "none";

  useEffect(() => {
    let cancelled = false;
    const engine = engineRef.current;
    const current = projectRef.current;
    if (!engine || !current) {
      setReady(false);
      draw(0);
      return;
    }
    setReady(false);
    void engine
      .loadProject(current)
      .then(() => {
        if (cancelled) return;
        setReady(true);
        setTime(0);
        timeRef.current = 0;
        draw(0);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [audioKey, draw]);

  useEffect(() => {
    if (!project) {
      draw(0);
      return;
    }
    draw(timeRef.current);
  }, [
    draw,
    project,
    options.themeId,
    options.visualStyle,
    options.layoutStyle,
    options.captions,
    options.captionLang,
    options.translations,
  ]);

  useEffect(() => {
    const engine = engineRef.current;
    engine?.setBgm(options.bgmId, options.bgmVolume);
  }, [options.bgmId, options.bgmVolume]);

  useEffect(() => {
    engineRef.current?.setSfx(options.sfx);
  }, [options.sfx]);

  const loop = useCallback(() => {
    const engine = engineRef.current;
    const current = projectRef.current;
    if (!engine || !current) return;
    const value = engine.getTime(projectDuration(current));
    if (value - timeRef.current > 0.03 || value < timeRef.current) {
      timeRef.current = value;
      setTime(value);
    }
    draw(value);
    const { index, localTime } = locateTime(current.scenes, value);
    const beat = activeBeatIndex(current.scenes[index], localTime);
    if (beat !== lastBeatRef.current) {
      lastBeatRef.current = beat;
      engine.tick();
    }
    if (value >= projectDuration(current) - 0.03) {
      engine.pause();
      playingRef.current = false;
      setIsPlaying(false);
      draw(projectDuration(current));
      return;
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [draw]);

  const play = useCallback(async () => {
    const engine = engineRef.current;
    const current = projectRef.current;
    if (!engine || !current) return;
    const totalDuration = projectDuration(current);
    let start = timeRef.current;
    if (start >= totalDuration - 0.1) start = 0;
    timeRef.current = start;
    setTime(start);
    await engine.play(start, rateRef.current);
    playingRef.current = true;
    setIsPlaying(true);
    lastBeatRef.current = -1;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const pause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const value = engine.pause();
    playingRef.current = false;
    setIsPlaying(false);
    cancelAnimationFrame(rafRef.current);
    timeRef.current = value;
    setTime(value);
    draw(value);
  }, [draw]);

  const toggle = useCallback(() => {
    if (playingRef.current) pause();
    else void play();
  }, [pause, play]);

  const seek = useCallback(
    (value: number) => {
      const clamped = Math.max(0, Math.min(total || 0, value));
      timeRef.current = clamped;
      setTime(clamped);
      const engine = engineRef.current;
      if (playingRef.current && engine) {
        void engine.play(clamped, rateRef.current);
        lastBeatRef.current = -1;
      } else {
        draw(clamped);
      }
    },
    [draw, total],
  );

  const setRate = useCallback(
    (value: number) => {
      rateRef.current = value;
      setRateState(value);
      const engine = engineRef.current;
      if (playingRef.current && engine) {
        void engine.play(timeRef.current, value);
      }
    },
    [],
  );

  const selectScene = useCallback(
    (index: number) => {
      const current = projectRef.current;
      if (!current || index < 0 || index >= current.scenes.length) return;
      seek(sceneStart(current.scenes, index) + 0.001);
    },
    [seek],
  );

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      playingRef.current = false;
    };
  }, []);

  return {
    canvasRef,
    time,
    duration: total,
    isPlaying,
    rate,
    activeScene,
    ready,
    play,
    pause,
    toggle,
    seek,
    setRate,
    selectScene,
  };
}
