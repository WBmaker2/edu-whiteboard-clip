import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  Highlighter,
  Maximize2,
  Mic2,
  Minimize2,
  MousePointer2,
  PenLine,
  Presentation,
  Square,
  Volume2,
  X,
} from "lucide-react";
import type { Project } from "../types/project";
import { useShallow } from "zustand/react/shallow";
import { useStudioStore } from "../store/studioStore";
import { useAssetImages } from "../hooks/useAssetImages";
import { canvasProfile, renderScene } from "../lib/renderer";
import { useI18n } from "../lib/i18n";

interface PresentationModeProps {
  project: Project | null;
  open: boolean;
  startScene: number;
  onClose: () => void;
}

type Tool = "laser" | "pen" | "highlighter" | "eraser";

interface Stroke {
  tool: Exclude<Tool, "eraser">;
  points: { x: number; y: number }[];
}

export function PresentationMode({ project, open, startScene, onClose }: PresentationModeProps) {
  const { t } = useI18n();
  const store = useStudioStore(
    useShallow((state) => ({
      themeId: state.themeId,
      visualStyle: state.visualStyle,
      layoutStyle: state.layoutStyle,
      captions: state.captions,
      captionLang: state.captionLang,
      translations: state.translations,
      aspect: state.aspect,
      pushToast: state.pushToast,
    })),
  );
  const profile = canvasProfile(store.aspect);
  const stageRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const strokesRef = useRef<Record<number, Stroke[]>>({});
  const drawingRef = useRef<Stroke | null>(null);
  const [sceneIndex, setSceneIndex] = useState(startScene);
  const [reveal, setReveal] = useState(3);
  const [tool, setTool] = useState<Tool>("laser");
  const [guideOpen, setGuideOpen] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const scene = project?.scenes[sceneIndex];
  const assetImages = useAssetImages(project);
  const themeId = project?.themeId ?? "paper";
  const visualStyle = project?.visualStyle ?? "diagram";

  const drawStage = useCallback(() => {
    const canvas = stageRef.current;
    const current = project?.scenes[sceneIndex];
    if (!canvas || !current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const translated =
      store.captionLang !== "ko"
        ? store.translations[store.captionLang]?.[sceneIndex]
        : undefined;
    const total = current.beats.length;
    const captionBeat = Math.max(0, Math.min(total - 1, reveal - 1));
    const captionText =
      reveal >= total
        ? current.subtitle
        : translated?.[captionBeat] ?? current.beats[captionBeat]?.narration;
    renderScene(ctx, current, current.duration, {
      themeId,
      visualStyle,
      layoutStyle: store.layoutStyle,
      captions: store.captions,
      captionText: store.captions ? captionText : undefined,
      sceneIndex,
      revealLimit: reveal >= total ? "all" : reveal,
      penTip: false,
      aspect: store.aspect,
      assetImages,
    });
  }, [
    project,
    sceneIndex,
    reveal,
    themeId,
    visualStyle,
    store.layoutStyle,
    store.captions,
    store.captionLang,
    store.translations,
    store.aspect,
    assetImages,
  ]);

  const redrawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, profile.width, profile.height);
    const strokes = strokesRef.current[sceneIndex] ?? [];
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (stroke.tool === "highlighter") {
        ctx.strokeStyle = "rgba(250, 204, 21, 0.42)";
        ctx.lineWidth = 22;
      } else if (stroke.tool === "laser") {
        ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
        ctx.lineWidth = 5;
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 18;
      } else {
        ctx.strokeStyle = "#1d4ed8";
        ctx.lineWidth = 5;
      }
      ctx.beginPath();
      stroke.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.restore();
    }
  }, [sceneIndex, profile.width, profile.height]);

  useEffect(() => {
    if (!open) return;
    const index = Math.max(0, Math.min(startScene, (project?.scenes.length ?? 1) - 1));
    setSceneIndex(index);
    setReveal(project?.scenes[index]?.beats.length ?? 3);
    setGuideOpen(false);
    strokesRef.current = {};
    audioRef.current?.pause();
    setIsNarrating(false);
  }, [open, project, startScene]);

  useEffect(() => {
    if (!open) return;
    drawStage();
    redrawOverlay();
  }, [open, drawStage, redrawOverlay, sceneIndex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        onClose();
      } else if (event.key === "ArrowRight") {
        setSceneIndex((value) => Math.min((project?.scenes.length ?? 1) - 1, value + 1));
      } else if (event.key === "ArrowLeft") {
        setSceneIndex((value) => Math.max(0, value - 1));
      } else if (/^[1-9]$/.test(event.key)) {
        const beats = project?.scenes[sceneIndex]?.beats.length ?? 3;
        setReveal(Math.min(beats, Number(event.key)));
      } else if (event.key === "0") {
        setReveal(project?.scenes[sceneIndex]?.beats.length ?? 3);
      }
      else if (event.key.toLowerCase() === "l") setTool("laser");
      else if (event.key.toLowerCase() === "p") setTool("pen");
      else if (event.key.toLowerCase() === "h") setTool("highlighter");
      else if (event.key.toLowerCase() === "c") {
        strokesRef.current[sceneIndex] = [];
        redrawOverlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, project, sceneIndex, redrawOverlay]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    void rootRef.current?.requestFullscreen?.().catch(() => undefined);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      audioRef.current?.pause();
    };
  }, [open]);

  useEffect(() => {
    audioRef.current?.pause();
    setIsNarrating(false);
    setReveal(project?.scenes[sceneIndex]?.beats.length ?? 3);
  }, [sceneIndex, project]);

  const beat = scene
    ? scene.beats[Math.max(0, Math.min(scene.beats.length - 1, reveal - 1))]
    : null;

  const guides = useMemo(() => {
    if (!scene) return [];
    return scene.beats.map((item, index) => ({
      beat: item,
      prompts: [
        t("present.guidePromptSeen", { label: item.label }),
        t("present.guidePromptMissing", { label: item.label }),
        index === scene.beats.length - 1
          ? t("present.guidePromptWrap")
          : t("present.guidePromptConnect", {
              next: scene.beats[index + 1]?.label ?? t("present.guideNextConcept"),
            }),
      ],
    }));
  }, [scene, t]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = overlayRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * profile.width,
      y: ((event.clientY - rect.top) / rect.height) * profile.height,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === "eraser") {
      strokesRef.current[sceneIndex] = [];
      redrawOverlay();
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const stroke: Stroke = { tool, points: [pointFromEvent(event)] };
    drawingRef.current = stroke;
    strokesRef.current[sceneIndex] = [...(strokesRef.current[sceneIndex] ?? []), stroke];
    redrawOverlay();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current.points.push(pointFromEvent(event));
    redrawOverlay();
  };

  const handlePointerUp = () => {
    if (drawingRef.current?.tool === "laser") {
      const laser = drawingRef.current;
      window.setTimeout(() => {
        strokesRef.current[sceneIndex] = (strokesRef.current[sceneIndex] ?? []).filter(
          (stroke) => stroke !== laser,
        );
        redrawOverlay();
      }, 900);
    }
    drawingRef.current = null;
  };

  const toggleNarration = () => {
    if (!scene?.audioUrl) {
      store.pushToast("info", t("present.noNarration"));
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio(scene.audioUrl);
      audioRef.current.onended = () => setIsNarrating(false);
    }
    if (isNarrating) {
      audioRef.current.pause();
      setIsNarrating(false);
    } else {
      audioRef.current.src = scene.audioUrl;
      void audioRef.current.play();
      setIsNarrating(true);
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void rootRef.current?.requestFullscreen?.().catch(() => undefined);
    }
  };

  if (!open || !project || !scene) return null;

  return createPortal(
    <div className="presentation-root" ref={rootRef}>
      <div className="presentation-top">
        <div className="presentation-title-group">
          <span className="presentation-badge">
            <Presentation size={14} />
            {t("present.badge")}
          </span>
          <div>
            <strong>{project.topic}</strong>
            <small>
              {sceneIndex + 1} / {project.scenes.length} · {scene.title}
            </small>
          </div>
        </div>

        <div className="presentation-tools">
          <div className="presentation-group">
            <span className="presentation-label">{t("present.revealLabel")}</span>
            {Array.from({ length: Math.max(1, scene.beats.length - 1) }, (_, index) => index + 1).map(
              (step) => (
                <button
                  key={step}
                  type="button"
                  className={reveal === step ? "is-active" : ""}
                  onClick={() => setReveal(step)}
                >
                  {t("present.step", { step })}
                </button>
              ),
            )}
            <button
              type="button"
              className={reveal >= scene.beats.length ? "is-active" : ""}
              onClick={() => setReveal(scene.beats.length)}
            >
              {t("present.revealAll")}
            </button>
          </div>
          <div className="presentation-group">
            <button type="button" className={tool === "laser" ? "is-active" : ""} onClick={() => setTool("laser")} title={t("present.laserTitle")}>
              <MousePointer2 size={14} /> {t("present.laser")}
            </button>
            <button type="button" className={tool === "pen" ? "is-active" : ""} onClick={() => setTool("pen")} title={t("present.penTitle")}>
              <PenLine size={14} /> {t("present.pen")}
            </button>
            <button type="button" className={tool === "highlighter" ? "is-active" : ""} onClick={() => setTool("highlighter")} title={t("present.highlighterTitle")}>
              <Highlighter size={14} /> {t("present.highlighter")}
            </button>
            <button type="button" className={tool === "eraser" ? "is-active" : ""} onClick={() => setTool("eraser")} title={t("present.eraserTitle")}>
              <Eraser size={14} /> {t("present.eraser")}
            </button>
          </div>
          <button type="button" className={`presentation-icon ${guideOpen ? "is-active" : ""}`} onClick={() => setGuideOpen((value) => !value)} title={t("present.guideTitle")}>
            <Square size={15} /> {t("present.guide")}
          </button>
          <button type="button" className="presentation-icon" onClick={toggleFullscreen} title={t("present.fullscreenTitle")}>
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button type="button" className="presentation-icon" onClick={onClose} title={t("present.exitTitle")}>
            <X size={17} />
          </button>
        </div>
      </div>

      <div className="presentation-stage-wrap">
        <div
          className={`presentation-stage ${guideOpen ? "with-guide" : ""} ${
            store.aspect === "9:16" ? "is-vertical" : ""
          }`}
        >
          <canvas
            ref={stageRef}
            width={profile.width}
            height={profile.height}
            className={`presentation-canvas ${store.aspect === "9:16" ? "is-vertical" : ""}`}
          />
          <canvas
            ref={overlayRef}
            width={profile.width}
            height={profile.height}
            className={`annotation-canvas tool-${tool}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>
        {guideOpen && (
          <aside className="guide-panel">
            <div className="guide-head">
              <span className="panel-label">
                <Mic2 size={14} />
                {t("present.guideTitle")}
              </span>
              <button type="button" className="icon-button" onClick={() => setGuideOpen(false)} aria-label={t("present.guideClose")}>
                <X size={14} />
              </button>
            </div>
            <div className="guide-scene-title">
              <small>{scene.type === "intro" ? t("present.sceneIntro") : scene.type === "outro" ? t("present.sceneOutro") : t("present.sceneBody")}</small>
              <strong>{scene.title}</strong>
              <p>{scene.subtitle}</p>
            </div>
            <div className="guide-beats">
              {guides.map((item, index) => (
                <div
                  className={`guide-beat ${
                    index < reveal || reveal >= scene.beats.length ? "is-revealed" : ""
                  }`}
                  key={item.beat.id}
                >
                  <span className="guide-beat-number">{String(index + 1).padStart(2, "0")}</span>
                  <strong>{item.beat.label}</strong>
                  <p>{item.beat.desc}</p>
                  <ul>
                    {item.prompts.map((prompt) => (
                      <li key={prompt}>{prompt}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="guide-tip">
              <strong>{t("present.tipTitle")}</strong>
              <p>{beat ? `“${beat.narration}”` : ""}</p>
            </div>
          </aside>
        )}
      </div>

      <div className="presentation-bottom">
        <div className="presentation-bottom-left">
          <button type="button" className="presentation-narrate" onClick={toggleNarration}>
            <Volume2 size={15} />
            {isNarrating ? t("present.narrationStop") : t("present.narrationPlay")}
          </button>
          <span className="shortcut-hint">
            {t("present.shortcutLabel")} <b>←</b> {t("present.prevScene")} <b>→</b> {t("present.nextScene")} <b>1/2/3</b> {t("present.shortcutReveal")} <b>L</b> {t("present.laser")} <b>P</b> {t("present.pen")} <b>C</b> {t("present.eraser")}
          </span>
        </div>
        <div className="presentation-bottom-center">
          <button
            type="button"
            className="presentation-nav"
            onClick={() => setSceneIndex((value) => Math.max(0, value - 1))}
            disabled={sceneIndex === 0}
            aria-label={t("present.prevScene")}
          >
            <ChevronLeft size={18} />
          </button>
          {project.scenes.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`presentation-dot ${index === sceneIndex ? "is-active" : ""}`}
              onClick={() => setSceneIndex(index)}
              aria-label={t("present.sceneAria", { index: index + 1 })}
            />
          ))}
          <button
            type="button"
            className="presentation-nav"
            onClick={() => setSceneIndex((value) => Math.min(project.scenes.length - 1, value + 1))}
            disabled={sceneIndex === project.scenes.length - 1}
            aria-label={t("present.nextScene")}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <span className="presentation-count">
          <strong>{sceneIndex + 1}</strong> / {project.scenes.length} {t("present.sceneUnit")}
        </span>
      </div>
    </div>,
    document.body,
  );
}
