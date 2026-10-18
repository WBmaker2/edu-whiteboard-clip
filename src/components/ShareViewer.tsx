import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Pause, Play, Sparkles } from "lucide-react";
import type { Project } from "../types/project";
import { decodeSharedProject, readShareData } from "../lib/share";
import { canvasProfile, renderPoster } from "../lib/renderer";
import { usePlayback } from "../hooks/usePlayback";
import { formatClock } from "../lib/time";
import { APP_NAME } from "../data/presets";
import { useI18n } from "../lib/i18n";

export const SHARED_PROJECT_KEY = "panseolab:shared-project";

export function ShareViewer() {
  const { t } = useI18n();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const data = readShareData(window.location.hash);
    if (!data) {
      setError(t("share.noData"));
      return;
    }
    try {
      setProject(decodeSharedProject(data));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t("share.readFailed"),
      );
    }
  }, [t]);

  const options = useMemo(
    () => ({
      themeId: project?.themeId ?? "paper",
      visualStyle: project?.visualStyle ?? "diagram",
      layoutStyle: project?.layoutStyle ?? "adaptive",
      aspect: project?.aspect ?? "16:9",
      captions: true,
      captionLang: "ko",
      translations: {},
      bgmId: "none",
      bgmVolume: 0,
      sfx: false,
      penTip: true,
    }),
    [project],
  );
  const playback = usePlayback(project, options, canvasRef);
  const profile = canvasProfile(project?.aspect ?? "16:9");

  useEffect(() => {
    if (project) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    renderPoster(ctx, "paper", "16:9");
  }, [project]);

  const importProject = () => {
    if (!project) return;
    try {
      sessionStorage.setItem(SHARED_PROJECT_KEY, JSON.stringify(project));
    } catch {
      setError(t("share.importFailed"));
      return;
    }
    window.location.href = window.location.pathname;
  };

  if (error) {
    return (
      <div className="share-viewer">
        <div className="share-card">
          <h1>{t("share.errorTitle", { app: APP_NAME })}</h1>
          <p>{error}</p>
          <a className="primary-button" href="./">
            {t("share.openApp", { app: APP_NAME })}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="share-viewer">
      <header className="share-header">
        <span className="share-brand">
          <Sparkles size={15} />
          {APP_NAME}
        </span>
        <span className="share-subtitle">{t("share.subtitle")}</span>
      </header>
      <main className="share-main">
        <div
          className={`share-stage ${project?.aspect === "9:16" ? "is-vertical" : ""}`}
        >
          <canvas
            ref={canvasRef}
            width={profile.width}
            height={profile.height}
            className="stage-canvas"
            aria-label={t("share.previewLabel")}
          />
        </div>
        {project && (
          <div className="share-controls">
            <button
              type="button"
              className="control-button play-button"
              onClick={playback.toggle}
              aria-label={playback.isPlaying ? t("share.pause") : t("share.play")}
            >
              {playback.isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <span className="time-readout">
              <strong>{formatClock(playback.time)}</strong>
              <span>/ {formatClock(playback.duration)}</span>
            </span>
            <div className="share-scene-dots">
              {project.scenes.map((scene, index) => (
                <button
                  key={scene.id}
                  type="button"
                  className={`share-dot ${playback.activeScene === index ? "is-active" : ""}`}
                  onClick={() => playback.selectScene(index)}
                  aria-label={t("share.sceneAria", { index: index + 1 })}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
      <footer className="share-footer">
        <button type="button" className="primary-button btn-pulse" onClick={importProject} disabled={!project}>
          <Download size={15} />
          {t("share.import", { app: APP_NAME })}
        </button>
        <p>
          {t("share.footerNote")}
        </p>
      </footer>
    </div>
  );
}
