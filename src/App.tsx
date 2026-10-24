import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, ShieldCheck, Sparkles } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { HeaderTabs, type StudioTab } from "./components/HeaderTabs";
import { SettingsPanel } from "./components/SettingsPanel";
import { Toasts } from "./components/Toasts";

const PresentationMode = lazy(() =>
  import("./components/PresentationMode").then((module) => ({
    default: module.PresentationMode,
  })),
);
const WorksheetModal = lazy(() =>
  import("./components/WorksheetModal").then((module) => ({
    default: module.WorksheetModal,
  })),
);
const QuizModal = lazy(() =>
  import("./components/QuizModal").then((module) => ({ default: module.QuizModal })),
);
const MaterialsModal = lazy(() =>
  import("./components/MaterialsModal").then((module) => ({
    default: module.MaterialsModal,
  })),
);
const HelpModal = lazy(() =>
  import("./components/HelpModal").then((module) => ({ default: module.HelpModal })),
);
const VideoExportModal = lazy(() =>
  import("./components/VideoExportModal").then((module) => ({
    default: module.VideoExportModal,
  })),
);
const HistoryModal = lazy(() =>
  import("./components/HistoryModal").then((module) => ({
    default: module.HistoryModal,
  })),
);
const LibraryModal = lazy(() =>
  import("./components/LibraryModal").then((module) => ({
    default: module.LibraryModal,
  })),
);
const MonitorPanel = lazy(() =>
  import("./components/MonitorPanel").then((module) => ({
    default: module.MonitorPanel,
  })),
);
const CopyLinkDialog = lazy(() =>
  import("./components/CopyLinkDialog").then((module) => ({
    default: module.CopyLinkDialog,
  })),
);
import { useStudioStore } from "./store/studioStore";
import { createDemoProject } from "./data/demoProject";
import { generateSceneAudio } from "./lib/narration";
import { projectDuration } from "./lib/time";
import type { Project, ProjectSummary, Scene } from "./types/project";
import { downloadCanvas } from "./lib/export/image";
import { downloadProject, parseProjectJson } from "./lib/export/project";
import { downloadText, sanitizeFileName } from "./lib/download";
import {
  createSnapshot,
  getLastProjectSummary,
  isQuotaError,
  loadProjectById,
  migrateLibrary,
  newProjectId,
  saveProject,
  setLastProjectId,
} from "./lib/storage";
import { blobUrlFor, releaseProjectUrls } from "./lib/blobUrls";
import { startPwa } from "./lib/pwa";
import { isAudioStale, sceneTextHash } from "./lib/sceneOps";
import { resolveTheme, resolveVisual } from "./lib/recommend";
import { ensureExportFonts } from "./lib/fonts";
import { useI18n } from "./lib/i18n";
import type { RecordedResult } from "./hooks/useRecorder";
import { CAPTION_LANGUAGES } from "./data/presets";
import { SHARED_PROJECT_KEY } from "./components/ShareViewer";
import { buildShareUrl, encodeSharedProject, MAX_SHARE_URL_LENGTH } from "./lib/share";

interface ExportResult {
  url: string;
  filename: string;
  size: number;
}

export default function App() {
  const { t, te, language } = useI18n();
  const store = useStudioStore(
    useShallow((state) => ({
      project: state.project,
      presentationOpen: state.presentationOpen,
      worksheetOpen: state.worksheetOpen,
      quizOpen: state.quizOpen,
      materialsOpen: state.materialsOpen,
      historyOpen: state.historyOpen,
      activeSceneIndex: state.activeSceneIndex,
      captionLang: state.captionLang,
      translations: state.translations,
      openModal: state.openModal,
      pushToast: state.pushToast,
      setAutosaveState: state.setAutosaveState,
      resetProject: state.resetProject,
      loadProject: state.loadProject,
    })),
  );
  const [tab, setTab] = useState<StudioTab>("settings");
  const [monitorStarted, setMonitorStarted] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [recentLesson, setRecentLesson] = useState<ProjectSummary | null>(null);
  const [pwaApply, setPwaApply] = useState<(() => void) | null>(null);
  const [manualShareUrl, setManualShareUrl] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [converting, setConverting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState("");
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exportError, setExportError] = useState("");
  const exportAbortRef = useRef<AbortController | null>(null);
  const generateAbortRef = useRef<AbortController | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const project = store.project;

  useEffect(() => {
    document.title = t("app.title");
    document.documentElement.lang = language;
    void ensureExportFonts();
  }, [language, t]);

  useEffect(() => {
    startPwa(
      (applyUpdate) => setPwaApply(() => applyUpdate),
      () => useStudioStore.getState().pushToast("info", t("pwa.offlineReady")),
    );
  }, [t]);

  useEffect(() => {
    if (tab === "monitor") setMonitorStarted(true);
  }, [tab]);

  useEffect(() => {
    const prefetch = () => {
      void import("./components/MonitorPanel");
    };
    const timer = window.setTimeout(prefetch, 2500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!project) return;
    if (useStudioStore.getState().autosaveState === "idle") return;
    const timer = window.setTimeout(() => {
      const current = useStudioStore.getState().project;
      if (!current) return;
      useStudioStore.getState().setAutosaveState("saving");
      void saveProject(current)
        .then((saved) => {
          const latest = useStudioStore.getState().project;
          if (
            latest &&
            (latest.id !== saved.id || latest.title !== saved.title) &&
            saved.id
          ) {
            useStudioStore.getState().patch({
              project: { ...latest, id: saved.id, title: saved.title },
            });
          }
          useStudioStore
            .getState()
            .setAutosaveState("saved", new Date().toISOString());
        })
        .catch((error) => {
          useStudioStore.getState().setAutosaveState("error");
          useStudioStore
            .getState()
            .pushToast(
              "error",
              isQuotaError(error)
                ? t("library.quotaError")
                : error instanceof Error
                  ? t("draft.saveFailedReason", { message: te(error.message) })
                  : t("draft.saveFailed"),
            );
        });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [project, t, te]);

  useEffect(() => {
    const raw = sessionStorage.getItem(SHARED_PROJECT_KEY);
    if (!raw) return;
    sessionStorage.removeItem(SHARED_PROJECT_KEY);
    void (async () => {
      try {
        const imported = parseProjectJson(raw);
        const shared: Project = {
          ...imported,
          id: newProjectId(),
          title: imported.title ?? imported.topic,
        };
        store.loadProject(shared);
        void saveProject(shared)
          .then(() => getLastProjectSummary())
          .then((summary) => {
            if (summary) setRecentLesson(summary);
          });
        setTab("monitor");
        store.pushToast("success", t("draft.sharedImported"));
      } catch (error) {
        store.pushToast(
          "error",
          error instanceof Error ? te(error.message) : t("draft.sharedImportFailed"),
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    void migrateLibrary()
      .then(() => getLastProjectSummary())
      .then((summary) => {
        if (!cancelled && summary && !useStudioStore.getState().project) {
          setRecentLesson(summary);
        }
      })
      .catch((error) => {
        useStudioStore
          .getState()
          .pushToast(
            "error",
            error instanceof Error
              ? t("library.migrateFailed", { message: te(error.message) })
              : t("library.migrateFailedShort"),
          );
      });
    return () => {
      cancelled = true;
    };
  }, [t, te]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) {
        return;
      }
      if (document.querySelector(".modal-backdrop, .presentation-root")) return;
      event.preventDefault();
      if (event.shiftKey) useStudioStore.getState().redo();
      else useStudioStore.getState().undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleGenerate = async () => {
    const state = useStudioStore.getState();
    if (!state.apiKey.trim()) {
      state.pushToast("error", t("generate.needKey"));
      setTab("settings");
      return;
    }
    if (!state.topic.trim()) {
      state.pushToast("error", t("generate.needTopic"));
      setTab("settings");
      return;
    }
    const controller = new AbortController();
    generateAbortRef.current = controller;
    state.setPhase("generating");
    state.setProgress(4, t("generate.progressDesign"));
    let fallbackNotified = false;
    try {
      const { generateStoryboard } = await import("./lib/gemini");
      const curriculum = {
        grade: state.gradeLevel,
        subject: state.subject,
        standards: state.standards,
      };
      const { scenes: generated, modelUsed, styleHint } = await generateStoryboard({
        apiKey: state.apiKey,
        topic: state.topic,
        model: state.model,
        curriculum,
        signal: controller.signal,
        onFallback: (model) => {
          if (fallbackNotified) return;
          fallbackNotified = true;
          state.pushToast("info", t("generate.modelFallback", { model }));
        },
      });
      const themeId =
        state.themeId !== "auto"
          ? state.themeId
          : styleHint?.themeId ?? resolveTheme("auto", state.topic, curriculum);
      const visualStyle =
        state.visualStyle !== "auto"
          ? state.visualStyle
          : styleHint?.visualStyle ?? resolveVisual("auto", state.topic, curriculum);
      const scenes: Scene[] = generated.map((scene) => ({ ...scene }));
      let ttsFailed = false;
      let completed = 0;
      if (state.generateWithAudio) state.setProgress(24, t("generate.progressNarration"));
      else state.setProgress(60, t("generate.progressSaving"));
      const tasks = scenes.map((scene, index) => async () => {
        try {
          const result = await generateSceneAudio({
            apiKey: state.apiKey,
            voice: state.voice,
            ttsModel: state.ttsModel,
            beats: scene.beats,
            signal: controller.signal,
            onFallback: (model) => {
              if (fallbackNotified) return;
              fallbackNotified = true;
              state.pushToast("info", t("generate.ttsFallback", { model }));
            },
          });
          scenes[index] = {
            ...scene,
            audioBlob: result.blob,
            audioUrl: blobUrlFor(result.blob),
            audioTextHash: sceneTextHash(scene.beats),
            duration: result.duration,
            windows: result.windows,
            audioSource: result.source,
          };
        } catch {
          ttsFailed = true;
          scenes[index] = { ...scene, audioSource: "none" };
        } finally {
          completed += 1;
          state.setProgress(
            24 + Math.round((completed / scenes.length) * 70),
            t("generate.progressTtsDone", { completed, total: scenes.length }),
          );
        }
      });
      if (state.generateWithAudio) {
        await Promise.allSettled(tasks.map((task) => task()));
      } else {
        state.setProgress(90, t("generate.progressNoAudio"));
      }
      if (controller.signal.aborted) {
        throw new DOMException("Generation cancelled", "AbortError");
      }
      const nextProject: Project = {
        version: 2,
        id: newProjectId(),
        title: state.topic.trim() || undefined,
        aspect: "16:9",
        assets: {},
        topic: state.topic,
        themeId,
        visualStyle,
        layoutStyle: state.layoutStyle,
        voice: state.voice,
        model: modelUsed || state.model,
        ttsModel: state.ttsModel,
        bgmId: state.bgmId,
        scenes,
        savedAt: new Date().toISOString(),
      };
      state.setProject(nextProject);
      void saveProject(nextProject)
        .then(() => getLastProjectSummary())
        .then((summary) => {
          if (summary) setRecentLesson(summary);
        })
        .catch(() => undefined);
      state.setProgress(100, t("generate.progressDone"));
      state.setPhase("ready");
      state.pushToast(
        !state.generateWithAudio ? "info" : ttsFailed ? "info" : "success",
        !state.generateWithAudio
          ? t("generate.doneNoAudio")
          : ttsFailed
            ? t("generate.donePartial")
            : t("generate.done"),
      );
      setTab("monitor");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        state.setPhase("idle");
        state.setProgress(0, "");
        state.pushToast("info", t("generate.cancelled"));
        return;
      }
      state.setPhase("idle");
      state.setProgress(0, "");
      state.pushToast(
        "error",
        error instanceof Error ? te(error.message) : t("generate.failed"),
      );
      setTab("settings");
    } finally {
      generateAbortRef.current = null;
    }
  };

  const handleCancelGenerate = () => {
    generateAbortRef.current?.abort();
  };

  const rememberRecent = () => {
    void getLastProjectSummary().then((summary) => {
      if (summary) setRecentLesson(summary);
    });
  };

  const flushCurrentProject = async (): Promise<void> => {
    const state = useStudioStore.getState();
    const current = state.project;
    if (
      !current ||
      state.autosaveState === "idle" ||
      state.autosaveState === "saved"
    ) {
      return;
    }
    try {
      await saveProject(current);
    } catch (error) {
      store.pushToast(
        "error",
        isQuotaError(error)
          ? t("library.quotaError")
          : error instanceof Error
            ? t("draft.saveFailedReason", { message: te(error.message) })
            : t("draft.saveFailed"),
      );
    }
  };

  const handleOpenProject = async (next: Project) => {
    await flushCurrentProject();
    const current = useStudioStore.getState().project;
    if (current && current.id !== next.id) {
      releaseProjectUrls(current);
    }
    store.loadProject(next);
    if (next.id) void setLastProjectId(next.id).then(rememberRecent);
    else rememberRecent();
    setTab("monitor");
  };

  const handleDemo = () => {
    const state = useStudioStore.getState();
    const demo = createDemoProject();
    const projectWithSettings: Project = {
      ...demo,
      id: newProjectId(),
      title: demo.topic,
      themeId: resolveTheme(state.themeId, demo.topic, undefined),
      visualStyle: resolveVisual(state.visualStyle, demo.topic, undefined),
      layoutStyle: state.layoutStyle,
      bgmId: state.bgmId,
    };
    void handleOpenProject(projectWithSettings).then(() =>
      saveProject(projectWithSettings).then(rememberRecent),
    );
    state.pushToast("info", t("draft.demoLoaded"));
  };

  const handleNewProject = async () => {
    const state = useStudioStore.getState();
    if (state.phase === "generating" || state.phase === "exporting" || exportOpen) {
      state.pushToast("info", t("draft.busy"));
      return;
    }
    await flushCurrentProject();
    const current = useStudioStore.getState().project;
    releaseProjectUrls(current);
    state.resetProject();
    setTab("settings");
    state.pushToast("info", t("draft.newProject"));
  };

  const handleOpenRecent = async () => {
    try {
      const summary = recentLesson ?? (await getLastProjectSummary());
      if (!summary) {
        store.pushToast("error", t("draft.noSaved"));
        return;
      }
      const loaded = await loadProjectById(summary.id);
      if (!loaded) {
        store.pushToast("error", t("library.notFound"));
        return;
      }
      await handleOpenProject(loaded);
      store.pushToast("success", t("library.opened"));
    } catch (error) {
      store.pushToast(
        "error",
        error instanceof Error
          ? t("draft.openFailedReason", { message: error.message })
          : t("draft.openFailed"),
      );
    }
  };

  const handleImportClick = () => importRef.current?.click();

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const imported = parseProjectJson(text);
      await flushCurrentProject();
      const withId: Project = {
        ...imported,
        id: newProjectId(),
        title: imported.title ?? imported.topic,
      };
      const saved = await saveProject(withId);
      await handleOpenProject(saved);
      store.pushToast("success", t("draft.imported", { name: file.name }));
    } catch (error) {
      store.pushToast(
        "error",
        error instanceof Error
          ? t("draft.importFailedReason", { message: error.message })
          : t("draft.importFailed"),
      );
    }
  };

  const handleSaveDraft = async () => {
    if (!project) {
      store.pushToast("error", t("draft.nothingToSave"));
      return;
    }
    try {
      const saved = await saveProject(project);
      if (saved.id && (project.id !== saved.id || project.title !== saved.title)) {
        useStudioStore.getState().patch({
          project: { ...project, id: saved.id, title: saved.title },
        });
      }
      await createSnapshot(saved, t("history.manualSnapshot"), true);
      store.setAutosaveState("saved", new Date().toISOString());
      rememberRecent();
      store.pushToast("success", t("draft.saved"));
    } catch (error) {
      store.pushToast(
        "error",
        isQuotaError(error)
          ? t("library.quotaError")
          : error instanceof Error
            ? t("draft.saveFailedReason", { message: error.message })
            : t("draft.saveFailed"),
      );
    }
  };

  const handleDeletedCurrent = () => {
    releaseProjectUrls(useStudioStore.getState().project);
    store.resetProject();
    setRecentLesson(null);
    setTab("settings");
  };

  const handleExportJson = async () => {
    if (!project) return;
    try {
      await downloadProject(project);
      store.pushToast("success", t("export.jsonDone"));
    } catch (error) {
      store.pushToast(
        "error",
        error instanceof Error ? t("export.jsonFailedReason", { message: te(error.message) }) : t("export.jsonFailed"),
      );
    }
  };

  const handleSnapshot = (canvas: HTMLCanvasElement, sceneIndex: number) => {
    if (!project) return;
    downloadCanvas(canvas, `panseolab_scene_${sceneIndex + 1}.png`);
    store.pushToast("success", t("export.pngDone"));
  };

  const handleExportSvg = async () => {
    const state = useStudioStore.getState();
    const project = state.project;
    if (!project) return;
    const sceneIndex = Math.max(0, Math.min(project.scenes.length - 1, state.activeSceneIndex));
    const scene = project.scenes[sceneIndex];
    if (!scene) return;
    const { buildSceneSvg } = await import("./lib/export/svg");
    const svg = buildSceneSvg(project, scene, sceneIndex);
    downloadText(
      `${sanitizeFileName(project.topic)}_scene${sceneIndex + 1}.svg`,
      svg,
      "image/svg+xml;charset=utf-8",
    );
    state.pushToast("success", t("export.svgDone"));
  };

  const handleExportSrt = async () => {
    if (!project) return;
    const translations =
      store.captionLang !== "ko" ? store.translations[store.captionLang] : undefined;
    const { buildSrt } = await import("./lib/export/srt");
    const srt = buildSrt(project, translations, store.captionLang);
    downloadText(`panseolab_subtitles_${store.captionLang}.srt`, srt);
    store.pushToast(
      "success",
      store.captionLang !== "ko" && !translations
        ? t("export.srtOriginal")
        : t("export.srtSaved"),
    );
  };

  const handleLanguageChange = async (code: string) => {
    const state = useStudioStore.getState();
    if (code === "ko") {
      state.patch({ captionLang: "ko" });
      state.pushToast("info", t("export.captionOriginal"));
      return;
    }
    if (state.translations[code]) {
      state.patch({ captionLang: code });
      const label = CAPTION_LANGUAGES.find((item) => item.code === code)?.label ?? code;
      state.pushToast("success", t("export.captionSwitched", { label }));
      return;
    }
    if (!state.apiKey.trim()) {
      state.pushToast("error", t("export.translateNeedKey"));
      return;
    }
    setTranslating(true);
    const label = CAPTION_LANGUAGES.find((item) => item.code === code)?.label ?? code;
    state.pushToast("info", t("export.translating", { label }));
    try {
      const { translateNarrations } = await import("./lib/gemini");
      const narrations = await translateNarrations({
        apiKey: state.apiKey,
        model: state.model,
        scenes: state.project?.scenes ?? [],
        lang: code,
      });
      state.setTranslation(code, narrations);
      state.patch({ captionLang: code });
      state.pushToast("success", t("export.translated", { label }));
    } catch (error) {
      state.pushToast(
        "error",
        error instanceof Error ? t("export.translateFailedReason", { message: te(error.message) }) : t("export.translateFailed"),
      );
    } finally {
      setTranslating(false);
    }
  };

  const handleRegenerateScene = useCallback(async (index: number) => {
    const state = useStudioStore.getState();
    const target = state.project?.scenes[index];
    if (!target) return;
    if (!state.apiKey.trim()) {
      state.pushToast("error", t("export.audioNeedKey"));
      return;
    }
    const audio = await generateSceneAudio({
      apiKey: state.apiKey,
      voice: state.voice,
      ttsModel: state.ttsModel,
      beats: target.beats,
      onFallback: (model) => state.pushToast("info", t("generate.ttsFallback", { model })),
    });
    state.replaceSceneAudio(index, audio);
    state.pushToast("success", t("export.sceneAudioDone", { scene: index + 1 }));
  }, [t]);

  const handleRecorded = useCallback((index: number, result: RecordedResult) => {
    const state = useStudioStore.getState();
    const target = state.project?.scenes[index];
    if (!target) return;
    state.replaceSceneAudio(index, {
      blob: result.blob,
      duration: result.duration,
      windows: result.windows,
      source: "recorded",
    });
  }, []);

  const handleExportVideo = async () => {
    const state = useStudioStore.getState();
    if (!state.project) return;
    const staleScenes = state.project.scenes.filter((scene) => isAudioStale(scene)).length;
    if (staleScenes > 0) {
      state.pushToast(
        "info",
        t("export.staleScenes", { count: staleScenes }),
      );
    }
    const controller = new AbortController();
    exportAbortRef.current = controller;
    setExportOpen(true);
    setExportProgress(0);
    setExportMessage(t("export.preparing"));
    setExportResult((previous) => {
      if (previous) URL.revokeObjectURL(previous.url);
      return null;
    });
    setExportError("");
    try {
      const { exportVideo } = await import("./lib/export/video");
      const result = await exportVideo({
        project: state.project,
        format: state.exportFormat,
        resolution: state.resolution,
        aspect: state.project.aspect,
        captions: state.captions,
        bgmVolume: state.bgmVolume,
        penTip: state.penTip,
        translations:
          state.captionLang !== "ko" ? state.translations[state.captionLang] : undefined,
        captionLang: state.captionLang,
        signal: controller.signal,
        onProgress: (percent, message) => {
          setExportProgress(percent);
          setExportMessage(message);
        },
        onFormatFallback: (message) => {
          state.pushToast("info", te(message));
          setExportMessage(message);
        },
      });
      const safeTopic = sanitizeFileName(state.project.topic);
      const filename = `${safeTopic}_${Date.now()}.${result.extension}`;
      const url = URL.createObjectURL(result.blob);
      setExportResult({ url, filename, size: result.blob.size });
      setExportMessage(t("export.ready"));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      state.pushToast(
        "success",
        t("export.done", { format: result.extension.toUpperCase() }),
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setExportOpen(false);
        state.pushToast("info", t("export.cancelled"));
      } else {
        setExportError(error instanceof Error ? te(error.message) : t("export.failed"));
      }
    } finally {
      exportAbortRef.current = null;
    }
  };

  const handleCancelExport = () => {
    if (converting) {
      void import("./lib/export/ffmpegConvert").then((module) =>
      module.cancelFfmpegConversion(),
    );
      return;
    }
    exportAbortRef.current?.abort();
  };

  const handleConvertToMp4 = async () => {
    if (!exportResult || converting) return;
    const state = useStudioStore.getState();
    setConverting(true);
    setExportError("");
    setExportProgress(2);
    setExportMessage(t("export.ffmpegPreparing"));
    try {
      const response = await fetch(exportResult.url);
      const webm = await response.blob();
      const { convertWebmToMp4 } = await import("./lib/export/ffmpegConvert");
      const mp4 = await convertWebmToMp4(webm, {
        onProgress: (percent, message) => {
          setExportProgress(percent);
          setExportMessage(message);
        },
      });
      const filename = exportResult.filename.replace(/\.webm$/i, ".mp4");
      const url = URL.createObjectURL(mp4);
      setExportResult((previous) => {
        if (previous) URL.revokeObjectURL(previous.url);
        return { url, filename, size: mp4.size };
      });
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      state.pushToast("success", t("export.convertDone"));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        state.pushToast("info", t("export.convertCancelled"));
      } else {
        setExportError(
          error instanceof Error ? te(error.message) : t("export.convertFailed"),
        );
      }
    } finally {
      setConverting(false);
    }
  };

  const handleShareLink = async () => {
    const state = useStudioStore.getState();
    if (!state.project) return;
    try {
      const encoded = await encodeSharedProject(state.project);
      const url = buildShareUrl(
        `${window.location.origin}${window.location.pathname}`,
        encoded,
      );
      if (url.length > MAX_SHARE_URL_LENGTH) {
        state.pushToast(
          "info",
          t("share.tooLarge"),
        );
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        state.pushToast(
          "success",
          t("share.copied"),
        );
      } catch {
        setManualShareUrl(url);
      }
    } catch (error) {
      state.pushToast(
        "error",
        error instanceof Error ? te(error.message) : t("share.failed"),
      );
    }
  };

  const closeExport = () => {
    setExportOpen(false);
    setExportResult((previous) => {
      if (previous) URL.revokeObjectURL(previous.url);
      return null;
    });
    setExportError("");
  };

  const totalDuration = project ? projectDuration(project) : 0;

  return (
    <div className="app-shell">
      <HeaderTabs
        tab={tab}
        onTab={setTab}
        project={project}
        onNewProject={() => void handleNewProject()}
        onOpenLibrary={() => setLibraryOpen(true)}
        onImportProject={handleImportClick}
        onShowShortcuts={() => setHelpOpen(true)}
      />

      {pwaApply && !exportOpen && !store.presentationOpen && (
        <div className="pwa-update-banner" role="status">
          <div>
            <strong>{t("pwa.updateTitle")}</strong>
            <p>{t("pwa.updateBody")}</p>
          </div>
          <div className="draft-banner-actions">
            <button
              type="button"
              className="primary-button small btn-pulse"
              onClick={() => pwaApply()}
            >
              {t("pwa.updateNow")}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setPwaApply(null)}
            >
              {t("pwa.later")}
            </button>
          </div>
        </div>
      )}

      {recentLesson && !project && (
        <div className="draft-banner" role="status">
          <div>
            <strong>{t("draft.bannerTitle")}</strong>
            <p>
              {recentLesson.title} · {t("draft.bannerBody")}
            </p>
          </div>
          <div className="draft-banner-actions">
            <button
              type="button"
              className="primary-button small btn-pulse"
              onClick={() => void handleOpenRecent()}
            >
              {t("draft.continue")}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setLibraryOpen(true)}
            >
              {t("draft.startNew")}
            </button>
          </div>
        </div>
      )}

      <main className={`studio-layout ${tab === "monitor" ? "show-monitor" : "show-settings"}`}>
        <h1 className="sr-only">{t("app.heroTitle")}</h1>
        <div className="settings-column">
          <SettingsPanel
            onGenerate={() => void handleGenerate()}
            onDemo={handleDemo}
            onCancelGenerate={handleCancelGenerate}
          />
        </div>
        <div className="monitor-column">
          {monitorStarted && (
            <Suspense
              fallback={
                <div className="panel-card monitor-loading" role="status">
                  {t("monitor.loading")}
                </div>
              }
            >
              <MonitorPanel
                project={project}
                active={tab === "monitor"}
            onDemo={handleDemo}
            onSaveDraft={() => void handleSaveDraft()}
            onExportJson={() => void handleExportJson()}
            onSnapshot={handleSnapshot}
            onExportSrt={() => void handleExportSrt()}
            onExportSvg={handleExportSvg}
            onOpenPresentation={() => store.openModal("presentation", true)}
            onOpenWorksheet={() => store.openModal("worksheet", true)}
            onOpenQuiz={() => store.openModal("quiz", true)}
            onOpenMaterials={() => store.openModal("materials", true)}
            onExportVideo={() => void handleExportVideo()}
            onShareLink={() => void handleShareLink()}
            onRegenerate={handleRegenerateScene}
            onRecorded={handleRecorded}
                onLanguageChange={(code) => void handleLanguageChange(code)}
              />
            </Suspense>
          )}
        </div>
      </main>

      <footer className="site-footer">
        <div className="footer-left">
          <span className="footer-brand">
            <Sparkles size={14} />
            {t("app.brand")}
          </span>
          <span className="footer-dot">·</span>
          <span>{t("app.tagline")}</span>
          {project && (
            <>
              <span className="footer-dot">·</span>
              <span>
                {t("app.sceneSummary", {
                  count: project.scenes.length,
                  seconds: Math.round(totalDuration),
                })}
              </span>
            </>
          )}
        </div>
        <div className="footer-right">
          <span className="footer-note">
            <ShieldCheck size={13} />
            {t("app.privacy")}
          </span>
          <span className="footer-dot">·</span>
          <span>© {new Date().getFullYear()} {t("app.brand")}</span>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="footer-link">
            {t("app.geminiApi")}
            <ArrowUpRight size={12} />
          </a>
        </div>
      </footer>

      <input
        ref={importRef}
        type="file"
        accept=".json,.panseolab.json,application/json"
        data-testid="project-import"
        hidden
        onChange={(event) => void handleImportFile(event)}
      />

      <Suspense fallback={null}>
        {store.presentationOpen && (
          <PresentationMode
            project={project}
            open
            startScene={store.activeSceneIndex}
            onClose={() => store.openModal("presentation", false)}
          />
        )}
        {store.worksheetOpen && (
          <WorksheetModal
            open
            project={project}
            onClose={() => store.openModal("worksheet", false)}
          />
        )}
        {store.quizOpen && (
          <QuizModal
            open
            project={project}
            onClose={() => store.openModal("quiz", false)}
          />
        )}
        {store.materialsOpen && (
          <MaterialsModal
            open
            project={project}
            onClose={() => store.openModal("materials", false)}
          />
        )}
        {store.historyOpen && (
          <HistoryModal
            open
            projectId={project?.id}
            onClose={() => store.openModal("history", false)}
          />
        )}
        {manualShareUrl && (
          <CopyLinkDialog
            open
            url={manualShareUrl}
            onClose={() => setManualShareUrl(null)}
          />
        )}
        {libraryOpen && (
          <LibraryModal
            open
            currentId={project?.id}
            onClose={() => setLibraryOpen(false)}
            onOpen={handleOpenProject}
            onNewProject={() => void handleNewProject()}
            onDeletedCurrent={handleDeletedCurrent}
          />
        )}
        {helpOpen && <HelpModal open onClose={() => setHelpOpen(false)} />}
        {exportOpen && (
          <VideoExportModal
            open
            progress={exportProgress}
            message={exportMessage}
            result={exportResult}
            error={exportError}
            converting={converting}
            canConvert={typeof Worker !== "undefined"}
            onConvert={() => void handleConvertToMp4()}
            onCancel={handleCancelExport}
            onClose={closeExport}
          />
        )}
      </Suspense>
      <Toasts />
      {translating && (
        <div className="translating-chip" role="status">
          <span className="spinner-dot" />
          {t("app.translatingCaptions")}
        </div>
      )}
    </div>
  );
}
