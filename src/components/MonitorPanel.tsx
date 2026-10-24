import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  Camera,
  Captions,
  Link2,
  Clapperboard,
  FileJson,
  Image,
  LayoutList,
  Loader2,
  MonitorUp,
  PlayCircle,
  Presentation,
  Redo2,
  PenLine,
  Save,
  Sparkles,
  ClipboardList,
  History,
  ListChecks,
  Plus,
  Undo2,
} from "lucide-react";
import type { Project } from "../types/project";
import { useStudioStore } from "../store/studioStore";
import { usePlayback } from "../hooks/usePlayback";
import { useAssetImages } from "../hooks/useAssetImages";
import { useI18n } from "../lib/i18n";
import { localLabel } from "../lib/labels";
import { PlayerControls } from "./PlayerControls";
import { StoryboardList } from "./StoryboardList";
import { canvasProfile, renderPoster } from "../lib/renderer";
import { THEMES } from "../data/presets";
import { ensureExportFonts } from "../lib/fonts";
import type { RecordedResult } from "../hooks/useRecorder";

interface MonitorPanelProps {
  project: Project | null;
  active: boolean;
  onDemo: () => void;
  onSaveDraft: () => void;
  onExportJson: () => void;
  onSnapshot: (canvas: HTMLCanvasElement, sceneIndex: number) => void;
  onExportSrt: () => void;
  onExportSvg: () => void;
  onOpenPresentation: () => void;
  onOpenWorksheet: () => void;
  onOpenQuiz: () => void;
  onOpenMaterials: () => void;
  onExportVideo: () => void;
  onShareLink: () => void;
  onRegenerate: (index: number) => Promise<void>;
  onRecorded: (index: number, result: RecordedResult) => void;
  onLanguageChange: (code: string) => void;
  onSelectScene?: (index: number) => void;
}

export function MonitorPanel({
  project,
  active,
  onDemo,
  onSaveDraft,
  onExportJson,
  onSnapshot,
  onExportSrt,
  onExportSvg,
  onOpenPresentation,
  onOpenWorksheet,
  onOpenQuiz,
  onOpenMaterials,
  onExportVideo,
  onShareLink,
  onRegenerate,
  onRecorded,
  onLanguageChange,
}: MonitorPanelProps) {
  const { t, te, language } = useI18n();
  const store = useStudioStore(
    useShallow((state) => ({
      themeId: state.themeId,
      visualStyle: state.visualStyle,
      layoutStyle: state.layoutStyle,
      aspect: state.aspect,
      captions: state.captions,
      captionLang: state.captionLang,
      translations: state.translations,
      bgmId: state.bgmId,
      bgmVolume: state.bgmVolume,
      sfx: state.sfx,
      penTip: state.penTip,
      resolution: state.resolution,
      exportFormat: state.exportFormat,
      phase: state.phase,
      progressPercent: state.progressPercent,
      progressMessage: state.progressMessage,
      autosaveState: state.autosaveState,
      lastSavedAt: state.lastSavedAt,
      canUndo: state.history.past.length > 0,
      canRedo: state.history.future.length > 0,
      patch: state.patch,
      addScene: state.addScene,
      openModal: state.openModal,
      undo: state.undo,
      redo: state.redo,
      pushToast: state.pushToast,
    })),
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const assetImages = useAssetImages(project);
  const profile = canvasProfile(store.aspect);
  const themeId = project?.themeId ?? (store.themeId === "auto" ? "paper" : store.themeId);
  const visualStyle =
    project?.visualStyle ?? (store.visualStyle === "auto" ? "diagram" : store.visualStyle);
  const options = {
    themeId,
    visualStyle,
    layoutStyle: store.layoutStyle,
    aspect: store.aspect,
    captions: store.captions,
    captionLang: store.captionLang,
    translations: store.translations,
    bgmId: store.bgmId,
    bgmVolume: store.bgmVolume,
    sfx: store.sfx,
    penTip: store.penTip,
    assetImages,
    onRenderError: (error: unknown) => {
      store.pushToast(
        "error",
        error instanceof Error
          ? t("monitor.renderErrorReason", { message: te(error.message) })
          : t("monitor.renderError"),
      );
    },
  };
  const playback = usePlayback(project, options, canvasRef);
  const theme = THEMES[themeId] ?? THEMES.paper;
  const isGenerating = store.phase === "generating";
  const canUndo = store.canUndo;
  const canRedo = store.canRedo;

  useEffect(() => {
    if (project) return;
    let cancelled = false;
    const draw = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderPoster(ctx, themeId, store.aspect);
    };
    draw();
    void ensureExportFonts().then(draw);
    void document.fonts?.ready.then(draw);
    return () => {
      cancelled = true;
    };
  }, [project, themeId, store.aspect]);

  useEffect(() => {
    if (useStudioStore.getState().activeSceneIndex !== playback.activeScene) {
      useStudioStore.getState().patch({ activeSceneIndex: playback.activeScene });
    }
  }, [playback.activeScene]);

  const togglePlayback = playback.toggle;

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (document.querySelector(".modal-backdrop, .presentation-root")) return;
      if (!project) return;
      event.preventDefault();
      togglePlayback();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, togglePlayback, project]);

  const replay = () => {
    playback.seek(0);
    if (!playback.isPlaying) void playback.play();
  };

  return (
    <div className="monitor-panel">
      <section className="panel-card monitor-card">
        <div className="monitor-heading">
          <div className="monitor-title">
            <span className="panel-label">
              <MonitorUp size={15} />
              {t("monitor.title")}
            </span>
            <span className="soft-chip">{localLabel(language, "theme", theme.id, "name", theme.name)}</span>
            {project && (
              <span className="soft-chip is-blue">
                {t("monitor.sceneCountLabel", { count: project.scenes.length })} · {formatRuntime(playback.duration)}
              </span>
            )}
          </div>
          <div className="monitor-tools">
            <div className="resolution-toggle" aria-label={t("monitor.resolution")}>
              <button
                type="button"
                className={store.resolution === "fhd" ? "is-active" : ""}
                onClick={() => store.patch({ resolution: "fhd" })}
              >
                FHD 1080p
              </button>
              <button
                type="button"
                className={store.resolution === "hd" ? "is-active" : ""}
                onClick={() => store.patch({ resolution: "hd" })}
              >
                <Sparkles size={12} />
                {t("monitor.speed720")}
              </button>
            </div>
            <button type="button" className="tool-button compact" onClick={() => canvasRef.current && onSnapshot(canvasRef.current, playback.activeScene)} disabled={!project} title={t("monitor.snapshotTitle")}>
              <Camera size={15} />
              <span>{t("monitor.snapshot")}</span>
            </button>
            <button type="button" className="tool-button compact" onClick={onExportSrt} disabled={!project} title={t("monitor.srtTitle")}>
              <Captions size={15} />
              <span>SRT</span>
            </button>
            <button type="button" className="tool-button compact" onClick={onExportJson} disabled={!project} title={t("monitor.jsonTitle")}>
              <FileJson size={15} />
              <span>JSON</span>
            </button>
            <button type="button" className="tool-button compact" onClick={onExportSvg} disabled={!project} title={t("monitor.svgTitle")}>
              <PenLine size={15} />
              <span>SVG</span>
            </button>
            <button type="button" className="tool-button" onClick={onOpenMaterials} disabled={!project} title={t("monitor.materialsTitle")}>
              <Image size={15} />
              <span>{t("monitor.materials")}</span>
            </button>
            <button type="button" className="tool-button" onClick={onOpenPresentation} disabled={!project} title={t("monitor.presentationTitle")}>
              <Presentation size={15} />
              <span>{t("monitor.presentation")}</span>
            </button>
            <button type="button" className="tool-button" onClick={onOpenWorksheet} disabled={!project} title={t("monitor.worksheetTitle")}>
              <ClipboardList size={15} />
              <span>{t("monitor.worksheet")}</span>
            </button>
            <button type="button" className="tool-button" onClick={onOpenQuiz} disabled={!project} title={t("monitor.quizTitle")}>
              <ListChecks size={15} />
              <span>{t("monitor.quiz")}</span>
            </button>
            <label className="select-pill format-pill" title={t("monitor.exportFormat")}>
              <Clapperboard size={14} />
              <select
                value={store.exportFormat}
                onChange={(event) =>
                  store.patch({ exportFormat: event.target.value as "webm" | "mp4" })
                }
                aria-label={t("monitor.exportFormat")}
              >
                <option value="webm">WebM</option>
                <option value="mp4">MP4</option>
              </select>
            </label>
            <button type="button" className="tool-button" onClick={onShareLink} disabled={!project} title={t("monitor.shareTitle")}>
              <Link2 size={15} />
              <span>{t("monitor.share")}</span>
            </button>
            <button type="button" className="tool-button is-accent" onClick={onExportVideo} disabled={!project} title={t("monitor.exportVideoTitle")}>
              <Clapperboard size={15} />
              <span>{t("monitor.exportVideo")}</span>
            </button>
          </div>
        </div>

        <div className="canvas-frame" id="scene-stage" role="tabpanel" aria-label={t("monitor.scenePreview")}>
          <canvas
            ref={canvasRef}
            width={profile.width}
            height={profile.height}
            className={`stage-canvas ${store.aspect === "9:16" ? "is-vertical" : ""}`}
            aria-label={t("monitor.preview")}
          />
          {isGenerating && (
            <div className="canvas-overlay">
              <Loader2 size={28} className="spin" />
              <strong>{store.progressPercent}%</strong>
              <span>{store.progressMessage}</span>
            </div>
          )}
          {!project && !isGenerating && (
            <div className="poster-actions">
              <button type="button" className="primary-button poster-demo-button" onClick={onDemo}>
                <PlayCircle size={16} />
                {t("monitor.demoStart")}
              </button>
            </div>
          )}
        </div>

        {project ? (
          <>
            <div className="scene-tabs">
              <div className="scene-tablist" role="tablist" aria-label={t("monitor.sceneSelect")}>
                {project.scenes.map((scene, index) => (
                  <button
                    key={scene.id}
                    ref={(element) => {
                      sceneTabRefs.current[index] = element;
                    }}
                    type="button"
                    role="tab"
                    id={`scene-tab-${index}`}
                    aria-controls="scene-stage"
                    aria-selected={playback.activeScene === index}
                    tabIndex={playback.activeScene === index ? 0 : -1}
                    className={`scene-tab ${playback.activeScene === index ? "is-active" : ""}`}
                    onClick={() => playback.selectScene(index)}
                    onKeyDown={(event) => {
                      const last = project.scenes.length - 1;
                      let target = -1;
                      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                        target = Math.min(last, index + 1);
                      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                        target = Math.max(0, index - 1);
                      } else if (event.key === "Home") {
                        target = 0;
                      } else if (event.key === "End") {
                        target = last;
                      }
                      if (target >= 0) {
                        event.preventDefault();
                        playback.selectScene(target);
                        sceneTabRefs.current[target]?.focus();
                      }
                    }}
                  >
                    <span className="scene-tab-dot" />
                    {index + 1}.{" "}
                    {scene.type === "intro"
                      ? t("storyboard.typeIntro")
                      : scene.type === "outro"
                        ? t("storyboard.typeOutro")
                        : `${t("storyboard.typeBody")} ${index}`}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="scene-tab scene-tab-add"
                onClick={() => store.addScene(playback.activeScene)}
                disabled={project.scenes.length >= 10}
                title={t("monitor.sceneAdd")}
              >
                <Plus size={12} />
                {t("monitor.sceneAddShort")}
              </button>
            </div>

            <PlayerControls
              time={playback.time}
              duration={playback.duration}
              isPlaying={playback.isPlaying}
              rate={playback.rate}
              activeScene={playback.activeScene}
              sceneDurations={project.scenes.map((scene) => scene.duration)}
              onToggle={playback.toggle}
              onSeek={playback.seek}
              onSetRate={playback.setRate}
              onLanguageChange={onLanguageChange}
              onReplay={replay}
            />

            <div className="monitor-footer">
              <span className="scene-counter">
                {t("monitor.sceneCounter")} <strong>{playback.activeScene + 1}</strong> / {project.scenes.length}
              </span>
              <div className="monitor-footer-actions">
                <span className={`autosave-status is-${store.autosaveState}`}>
                  {store.autosaveState === "saving"
                    ? t("monitor.autosaveSaving")
                    : store.autosaveState === "error"
                      ? t("monitor.autosaveError")
                      : store.lastSavedAt
                        ? t("monitor.autosaveSaved", { time: formatSavedTime(store.lastSavedAt) })
                        : t("monitor.autosaveIdle")}
                </span>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => store.openModal("history", true)}
                  title={t("monitor.historyTitle")}
                >
                  <History size={13} />
                  {t("monitor.history")}
                </button>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => store.undo()}
                  disabled={!canUndo}
                  title={t("monitor.undo")}
                >
                  <Undo2 size={13} />
                </button>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => store.redo()}
                  disabled={!canRedo}
                  title={t("monitor.redo")}
                >
                  <Redo2 size={13} />
                </button>
                <button type="button" className="mini-button" onClick={onSaveDraft}>
                  <Save size={13} />
                  {t("monitor.saveDraft")}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-monitor-note">
            <span className="empty-icon">
              <LayoutList size={18} />
            </span>
            <div>
              <strong>{t("monitor.emptyTitle")}</strong>
              <p>{t("monitor.emptyBody")}</p>
            </div>
          </div>
        )}
      </section>

      {!project && !isGenerating && (
        <section className="panel-card studio-tip-card">
          <div className="panel-heading">
            <span className="panel-label">
              <Sparkles size={15} />
              {t("monitor.tipTitle")}
            </span>
            <span className="panel-hint">{t("monitor.tipHint")}</span>
          </div>
          <div className="tip-flow">
            <span><b>1</b> {t("monitor.tipStep1")}</span>
            <i />
            <span><b>2</b> {t("monitor.tipStep2")}</span>
            <i />
            <span><b>3</b> {t("monitor.tipStep3")}</span>
          </div>
          <div className="tip-grid">
            <div>
              <strong>{t("monitor.tipStoryboard")}</strong>
              <p>{t("monitor.tipStoryboardDesc")}</p>
            </div>
            <div>
              <strong>{t("monitor.tipSketch")}</strong>
              <p>{t("monitor.tipSketchDesc")}</p>
            </div>
            <div>
              <strong>{t("monitor.tipMaterials")}</strong>
              <p>{t("monitor.tipMaterialsDesc")}</p>
            </div>
          </div>
        </section>
      )}

      {project && (
        <StoryboardList
          project={project}
          activeScene={playback.activeScene}
          onSelectScene={playback.selectScene}
          onRegenerate={onRegenerate}
          onRecorded={onRecorded}
          onSaveDraft={onSaveDraft}
          onExportJson={onExportJson}
        />
      )}
    </div>
  );
}

function formatSavedTime(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatRuntime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
