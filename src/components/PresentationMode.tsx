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
import { useStudioStore } from "../store/studioStore";
import { CANVAS_HEIGHT, CANVAS_WIDTH, renderScene } from "../lib/renderer";

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
  const store = useStudioStore();
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
      themeId: store.themeId,
      visualStyle: store.visualStyle,
      layoutStyle: store.layoutStyle,
      captions: store.captions,
      captionText: store.captions ? captionText : undefined,
      sceneIndex,
      revealLimit: reveal >= total ? "all" : reveal,
    });
  }, [
    project,
    sceneIndex,
    reveal,
    store.themeId,
    store.visualStyle,
    store.layoutStyle,
    store.captions,
    store.captionLang,
    store.translations,
  ]);

  const redrawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
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
  }, [sceneIndex]);

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
        `“${item.label}”을(를) 일상에서 본 경험이 있나요?`,
        `만약 ${item.label} 단계가 없다면 어떤 일이 생길까요?`,
        index === scene.beats.length - 1
          ? "오늘 배운 내용을 한 문장으로 정리해 볼까요?"
          : `다음 단계인 ${scene.beats[index + 1]?.label ?? "다음 개념"}과 어떻게 연결될까요?`,
      ],
    }));
  }, [scene]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = overlayRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
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
      store.pushToast("info", "이 씬에는 아직 나레이션 음성이 없습니다.");
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
            교사용 수업 발표 모드
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
            <span className="presentation-label">판서 공개</span>
            {Array.from({ length: Math.max(1, scene.beats.length - 1) }, (_, index) => index + 1).map(
              (step) => (
                <button
                  key={step}
                  type="button"
                  className={reveal === step ? "is-active" : ""}
                  onClick={() => setReveal(step)}
                >
                  {step}단계
                </button>
              ),
            )}
            <button
              type="button"
              className={reveal >= scene.beats.length ? "is-active" : ""}
              onClick={() => setReveal(scene.beats.length)}
            >
              전체
            </button>
          </div>
          <div className="presentation-group">
            <button type="button" className={tool === "laser" ? "is-active" : ""} onClick={() => setTool("laser")} title="레이저 (L)">
              <MousePointer2 size={14} /> 레이저
            </button>
            <button type="button" className={tool === "pen" ? "is-active" : ""} onClick={() => setTool("pen")} title="판서 펜 (P)">
              <PenLine size={14} /> 펜
            </button>
            <button type="button" className={tool === "highlighter" ? "is-active" : ""} onClick={() => setTool("highlighter")} title="형광펜 (H)">
              <Highlighter size={14} /> 형광펜
            </button>
            <button type="button" className={tool === "eraser" ? "is-active" : ""} onClick={() => setTool("eraser")} title="지우기 (C)">
              <Eraser size={14} /> 지우기
            </button>
          </div>
          <button type="button" className={`presentation-icon ${guideOpen ? "is-active" : ""}`} onClick={() => setGuideOpen((value) => !value)} title="강의 가이드">
            <Square size={15} /> 가이드
          </button>
          <button type="button" className="presentation-icon" onClick={toggleFullscreen} title="전체 화면">
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button type="button" className="presentation-icon" onClick={onClose} title="발표 모드 종료 (ESC)">
            <X size={17} />
          </button>
        </div>
      </div>

      <div className="presentation-stage-wrap">
        <div className={`presentation-stage ${guideOpen ? "with-guide" : ""}`}>
          <canvas ref={stageRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="presentation-canvas" />
          <canvas
            ref={overlayRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
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
                강의 가이드
              </span>
              <button type="button" className="icon-button" onClick={() => setGuideOpen(false)} aria-label="가이드 닫기">
                <X size={14} />
              </button>
            </div>
            <div className="guide-scene-title">
              <small>{scene.type === "intro" ? "도입" : scene.type === "outro" ? "정리" : "전개"}</small>
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
              <strong>발문 팁</strong>
              <p>{beat ? `“${beat.narration}”` : ""}</p>
            </div>
          </aside>
        )}
      </div>

      <div className="presentation-bottom">
        <div className="presentation-bottom-left">
          <button type="button" className="presentation-narrate" onClick={toggleNarration}>
            <Volume2 size={15} />
            {isNarrating ? "나레이션 정지" : "내레이션 듣기"}
          </button>
          <span className="shortcut-hint">
            단축키: <b>←</b> 이전 씬 <b>→</b> 다음 씬 <b>1/2/3</b> 판서 <b>L</b> 레이저 <b>P</b> 펜 <b>C</b> 지우기
          </span>
        </div>
        <div className="presentation-bottom-center">
          <button
            type="button"
            className="presentation-nav"
            onClick={() => setSceneIndex((value) => Math.max(0, value - 1))}
            disabled={sceneIndex === 0}
            aria-label="이전 씬"
          >
            <ChevronLeft size={18} />
          </button>
          {project.scenes.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`presentation-dot ${index === sceneIndex ? "is-active" : ""}`}
              onClick={() => setSceneIndex(index)}
              aria-label={`${index + 1}번째 씬`}
            />
          ))}
          <button
            type="button"
            className="presentation-nav"
            onClick={() => setSceneIndex((value) => Math.min(project.scenes.length - 1, value + 1))}
            disabled={sceneIndex === project.scenes.length - 1}
            aria-label="다음 씬"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <span className="presentation-count">
          <strong>{sceneIndex + 1}</strong> / {project.scenes.length} 씬
        </span>
      </div>
    </div>,
    document.body,
  );
}
