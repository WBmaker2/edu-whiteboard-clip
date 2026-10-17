import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, ShieldCheck, Sparkles } from "lucide-react";
import { HeaderTabs, type StudioTab } from "./components/HeaderTabs";
import { SettingsPanel } from "./components/SettingsPanel";
import { MonitorPanel } from "./components/MonitorPanel";
import { PresentationMode } from "./components/PresentationMode";
import { WorksheetModal } from "./components/WorksheetModal";
import { QuizModal } from "./components/QuizModal";
import { MaterialsModal } from "./components/MaterialsModal";
import { HelpModal } from "./components/HelpModal";
import { VideoExportModal } from "./components/VideoExportModal";
import { HistoryModal } from "./components/HistoryModal";
import { Toasts } from "./components/Toasts";
import { useStudioStore } from "./store/studioStore";
import { createDemoProject } from "./data/demoProject";
import { generateStoryboard, synthesizeNarration, translateNarrations } from "./lib/gemini";
import { projectDuration } from "./lib/time";
import type { Project, Scene } from "./types/project";
import { buildSrt, downloadText } from "./lib/export/srt";
import { downloadProject, parseProjectJson } from "./lib/export/project";
import { downloadCanvas } from "./lib/export/image";
import { exportVideo } from "./lib/export/video";
import {
  createSnapshot,
  deleteDraft,
  hasDraft,
  loadDraft,
  saveDraft,
} from "./lib/storage";
import { audioUrlFor } from "./lib/audioUrls";
import { isAudioStale, sceneTextHash } from "./lib/sceneOps";
import type { RecordedResult } from "./hooks/useRecorder";
import { CAPTION_LANGUAGES } from "./data/presets";

interface ExportResult {
  url: string;
  filename: string;
  size: number;
}

export default function App() {
  const store = useStudioStore();
  const [tab, setTab] = useState<StudioTab>("settings");
  const [helpOpen, setHelpOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState("");
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exportError, setExportError] = useState("");
  const exportAbortRef = useRef<AbortController | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const project = store.project;

  useEffect(() => {
    document.title = "교육용 화이트보드 영상 만들기";
  }, []);

  useEffect(() => {
    const current = useStudioStore.getState().project;
    if (!current) return;
    if (
      current.themeId === store.themeId &&
      current.visualStyle === store.visualStyle &&
      current.layoutStyle === store.layoutStyle &&
      current.bgmId === store.bgmId
    ) {
      return;
    }
    useStudioStore.setState({
      project: {
        ...current,
        themeId: store.themeId,
        visualStyle: store.visualStyle,
        layoutStyle: store.layoutStyle,
        bgmId: store.bgmId,
      },
    });
  }, [project, store.themeId, store.visualStyle, store.layoutStyle, store.bgmId]);

  useEffect(() => {
    if (!project) return;
    const timer = window.setTimeout(() => {
      const current = useStudioStore.getState().project;
      if (!current) return;
      useStudioStore.getState().setAutosaveState("saving");
      void saveDraft(current)
        .then(() => {
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
              error instanceof Error
                ? `자동 저장에 실패했습니다: ${error.message}`
                : "자동 저장에 실패했습니다.",
            );
        });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [project]);

  useEffect(() => {
    let cancelled = false;
    void hasDraft()
      .then((exists) => {
        if (!cancelled && exists && !useStudioStore.getState().project) {
          useStudioStore.getState().setDraftAvailable(true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

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

  const runWithConcurrency = async <T,>(
    tasks: (() => Promise<T>)[],
    limit: number,
  ): Promise<PromiseSettledResult<T>[]> => {
    const results: PromiseSettledResult<T>[] = new Array(tasks.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (cursor < tasks.length) {
        const index = cursor;
        cursor += 1;
        try {
          results[index] = { status: "fulfilled", value: await tasks[index]() };
        } catch (reason) {
          results[index] = { status: "rejected", reason };
        }
      }
    });
    await Promise.all(workers);
    return results;
  };

  const handleGenerate = async () => {
    const state = useStudioStore.getState();
    if (!state.apiKey.trim()) {
      state.pushToast("error", "Gemini API 키를 입력해 주세요.");
      setTab("settings");
      return;
    }
    if (!state.topic.trim()) {
      state.pushToast("error", "교육 영상 주제 또는 학습 목표를 입력해 주세요.");
      setTab("settings");
      return;
    }
    state.setPhase("generating");
    state.setProgress(4, "5개 씬 스토리보드를 설계하는 중...");
    let fallbackNotified = false;
    try {
      const { scenes: generated, modelUsed } = await generateStoryboard({
        apiKey: state.apiKey,
        topic: state.topic,
        model: state.model,
        onFallback: (model) => {
          if (fallbackNotified) return;
          fallbackNotified = true;
          state.pushToast("info", `선택한 모델 대신 ${model} 모델로 자동 전환했습니다.`);
        },
      });
      const scenes: Scene[] = generated.map((scene) => ({ ...scene }));
      let ttsFailed = false;
      let completed = 0;
      if (state.generateWithAudio) state.setProgress(24, "스토리보드가 완성되었습니다. 나레이션을 합성하는 중...");
      else state.setProgress(60, "음성 없이 스토리보드를 저장하는 중...");
      const tasks = scenes.map((scene, index) => async () => {
        const text = scene.beats.map((beat) => beat.narration).join(" ");
        try {
          const result = await synthesizeNarration({
            apiKey: state.apiKey,
            text,
            beats: scene.beats,
            voice: state.voice,
            ttsModel: state.ttsModel,
            onFallback: (model) => {
              if (fallbackNotified) return;
              fallbackNotified = true;
              state.pushToast("info", `TTS 모델을 ${model}로 자동 전환했습니다.`);
            },
          });
          scenes[index] = {
            ...scene,
            audioBlob: result.blob,
            audioUrl: audioUrlFor(result.blob),
            audioTextHash: sceneTextHash(scene.beats),
            duration: result.duration,
            windows: result.windows,
            audioSource: "tts",
          };
        } catch {
          ttsFailed = true;
          scenes[index] = { ...scene, audioSource: "none" };
        } finally {
          completed += 1;
          state.setProgress(
            24 + Math.round((completed / scenes.length) * 70),
            `나레이션 음성 합성 완료 (${completed}/${scenes.length}개 씬)`,
          );
        }
      });
      if (state.generateWithAudio) {
        await runWithConcurrency(tasks, 2);
      } else {
        state.setProgress(90, "음성 없이 스토리보드를 준비했습니다.");
      }
      const nextProject: Project = {
        version: 1,
        topic: state.topic,
        themeId: state.themeId,
        visualStyle: state.visualStyle,
        layoutStyle: state.layoutStyle,
        voice: state.voice,
        model: modelUsed || state.model,
        ttsModel: state.ttsModel,
        bgmId: state.bgmId,
        scenes,
        savedAt: new Date().toISOString(),
      };
      state.setProject(nextProject);
      state.setProgress(100, "교육용 영상 제작 완료");
      state.setPhase("ready");
      state.pushToast(
        !state.generateWithAudio ? "info" : ttsFailed ? "info" : "success",
        !state.generateWithAudio
          ? "스토리보드를 음성 없이 만들었습니다. 필요한 장면만 음성을 생성할 수 있습니다."
          : ttsFailed
            ? "스토리보드는 완성되었습니다. 일부 씬의 음성 합성에 실패해 무음으로 저장했습니다."
            : "스토리보드와 나레이션이 완성되었습니다. 모니터에서 재생해 보세요.",
      );
      setTab("monitor");
    } catch (error) {
      state.setPhase("idle");
      state.setProgress(0, "");
      state.pushToast(
        "error",
        error instanceof Error ? error.message : "영상 생성 중 문제가 발생했습니다.",
      );
      setTab("settings");
    }
  };

  const handleDemo = () => {
    const state = useStudioStore.getState();
    const demo = createDemoProject();
    const projectWithSettings: Project = {
      ...demo,
      themeId: state.themeId,
      visualStyle: state.visualStyle,
      layoutStyle: state.layoutStyle,
      bgmId: state.bgmId,
    };
    state.setProject(projectWithSettings);
    state.pushToast("info", "예시 프로젝트를 불러왔습니다. API 키 없이 모든 기능을 체험해 보세요.");
    setTab("monitor");
  };

  const handleNewProject = () => {
    if (store.project && !window.confirm("현재 작업을 비우고 새 프로젝트를 시작할까요? 저장하지 않은 내용은 사라집니다.")) {
      return;
    }
    store.resetProject();
    store.setDraftAvailable(false);
    setTab("settings");
    store.pushToast("info", "새 프로젝트를 시작했습니다.");
  };

  const handleLoadDraft = async () => {
    try {
      const draft = await loadDraft();
      if (!draft) {
        store.pushToast("error", "저장된 초안이 없습니다.");
        return;
      }
      store.loadProject(draft);
      setTab("monitor");
      store.pushToast("success", "저장된 프로젝트 초안을 불러왔습니다.");
    } catch (error) {
      store.pushToast(
        "error",
        error instanceof Error ? `초안을 불러오지 못했습니다: ${error.message}` : "초안을 불러오지 못했습니다.",
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
      store.loadProject(imported);
      setTab("monitor");
      store.pushToast("success", `프로젝트 파일(${file.name})을 불러왔습니다.`);
    } catch (error) {
      store.pushToast(
        "error",
        error instanceof Error ? `파일을 불러오지 못했습니다: ${error.message}` : "파일을 불러오지 못했습니다.",
      );
    }
  };

  const handleSaveDraft = async () => {
    if (!project) {
      store.pushToast("error", "저장할 씬 데이터가 없습니다.");
      return;
    }
    try {
      await saveDraft(project);
      await createSnapshot(project, "수동 스냅샷", true);
      store.setAutosaveState("saved", new Date().toISOString());
      store.pushToast("success", "현재 작업을 초안과 스냅샷으로 저장했습니다.");
    } catch (error) {
      store.pushToast(
        "error",
        error instanceof Error ? `초안 저장에 실패했습니다: ${error.message}` : "초안 저장에 실패했습니다.",
      );
    }
  };

  const handleExportJson = async () => {
    if (!project) return;
    try {
      await downloadProject(project);
      store.pushToast("success", "프로젝트 JSON 파일을 다운로드했습니다.");
    } catch (error) {
      store.pushToast("error", error instanceof Error ? error.message : "JSON 내보내기에 실패했습니다.");
    }
  };

  const handleSnapshot = (canvas: HTMLCanvasElement, sceneIndex: number) => {
    if (!project) return;
    downloadCanvas(canvas, `panseolab_scene_${sceneIndex + 1}.png`);
    store.pushToast("success", "현재 장면을 PNG 이미지로 저장했습니다.");
  };

  const handleExportSrt = () => {
    if (!project) return;
    const translations =
      store.captionLang !== "ko" ? store.translations[store.captionLang] : undefined;
    const srt = buildSrt(project, translations, store.captionLang);
    downloadText(`panseolab_subtitles_${store.captionLang}.srt`, srt);
    store.pushToast(
      "success",
      store.captionLang !== "ko" && !translations
        ? "번역 자막이 없어 한국어 원본으로 SRT를 저장했습니다."
        : "SRT 자막 파일을 저장했습니다.",
    );
  };

  const handleLanguageChange = async (code: string) => {
    const state = useStudioStore.getState();
    if (code === "ko") {
      state.patch({ captionLang: "ko" });
      state.pushToast("info", "자막 언어를 한국어 원본으로 설정했습니다.");
      return;
    }
    if (state.translations[code]) {
      state.patch({ captionLang: code });
      const label = CAPTION_LANGUAGES.find((item) => item.code === code)?.label ?? code;
      state.pushToast("success", `자막 언어를 ${label}로 전환했습니다.`);
      return;
    }
    if (!state.apiKey.trim()) {
      state.pushToast("error", "다국어 자막 번역을 위해 Gemini API 키를 입력해 주세요.");
      return;
    }
    setTranslating(true);
    const label = CAPTION_LANGUAGES.find((item) => item.code === code)?.label ?? code;
    state.pushToast("info", `${label} 자막을 번역하는 중...`);
    try {
      const narrations = await translateNarrations({
        apiKey: state.apiKey,
        model: state.model,
        scenes: state.project?.scenes ?? [],
        lang: code,
      });
      state.setTranslation(code, narrations);
      state.patch({ captionLang: code });
      state.pushToast("success", `${label} 자막 번역이 완료되었습니다.`);
    } catch (error) {
      state.pushToast(
        "error",
        error instanceof Error ? `자막 번역에 실패했습니다: ${error.message}` : "자막 번역에 실패했습니다.",
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
      state.pushToast("error", "음성 재생성을 위해 Gemini API 키를 입력해 주세요.");
      return;
    }
    const result = await synthesizeNarration({
      apiKey: state.apiKey,
      text: target.beats.map((beat) => beat.narration).join(" "),
      beats: target.beats,
      voice: state.voice,
      ttsModel: state.ttsModel,
      onFallback: (model) => state.pushToast("info", `TTS 모델을 ${model}로 자동 전환했습니다.`),
    });
    state.replaceSceneAudio(index, {
      blob: result.blob,
      duration: result.duration,
      windows: result.windows,
      source: "tts",
    });
    state.pushToast("success", `${index + 1}번째 씬의 나레이션을 다시 만들었습니다.`);
  }, []);

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
        `음성 업데이트가 필요한 장면이 ${staleScenes}개 있습니다. 필요하면 먼저 음성을 다시 만들어 주세요.`,
      );
    }
    const controller = new AbortController();
    exportAbortRef.current = controller;
    setExportOpen(true);
    setExportProgress(0);
    setExportMessage("내보내기를 준비하는 중...");
    setExportResult((previous) => {
      if (previous) URL.revokeObjectURL(previous.url);
      return null;
    });
    setExportError("");
    try {
      const result = await exportVideo({
        project: state.project,
        format: state.exportFormat,
        resolution: state.resolution,
        captions: state.captions,
        bgmVolume: state.bgmVolume,
        translations:
          state.captionLang !== "ko" ? state.translations[state.captionLang] : undefined,
        captionLang: state.captionLang,
        signal: controller.signal,
        onProgress: (percent, message) => {
          setExportProgress(percent);
          setExportMessage(message);
        },
        onFormatFallback: (message) => {
          state.pushToast("info", message);
          setExportMessage(message);
        },
      });
      const safeTopic = (state.project.topic || "whiteboard_lesson")
        .replace(/[^\w\s가-힣-]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .slice(0, 40);
      const filename = `${safeTopic || "whiteboard_lesson"}_${Date.now()}.${result.extension}`;
      const url = URL.createObjectURL(result.blob);
      setExportResult({ url, filename, size: result.blob.size });
      setExportMessage("영상 파일이 준비되었습니다.");
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      state.pushToast(
        "success",
        `비디오 내보내기가 완료되었습니다 (${result.extension.toUpperCase()}).`,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setExportOpen(false);
        state.pushToast("info", "비디오 내보내기를 취소했습니다.");
      } else {
        setExportError(error instanceof Error ? error.message : "비디오 내보내기에 실패했습니다.");
      }
    } finally {
      exportAbortRef.current = null;
    }
  };

  const handleCancelExport = () => {
    exportAbortRef.current?.abort();
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
        onNewProject={handleNewProject}
        onLoadDraft={() => void handleLoadDraft()}
        onImportProject={handleImportClick}
        onShowShortcuts={() => setHelpOpen(true)}
      />

      {store.draftAvailable && !project && (
        <div className="draft-banner" role="status">
          <div>
            <strong>이전에 작업하던 프로젝트가 있습니다.</strong>
            <p>브라우저에 자동 저장된 초안을 이어서 작업할 수 있습니다.</p>
          </div>
          <div className="draft-banner-actions">
            <button type="button" className="primary-button small" onClick={() => void handleLoadDraft()}>
              이어서 작업
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void deleteDraft();
                store.setDraftAvailable(false);
                store.pushToast("info", "저장된 초안을 삭제했습니다.");
              }}
            >
              새로 시작
            </button>
          </div>
        </div>
      )}

      <main className={`studio-layout ${tab === "monitor" ? "show-monitor" : "show-settings"}`}>
        <div className="settings-column">
          <SettingsPanel onGenerate={() => void handleGenerate()} onDemo={handleDemo} />
        </div>
        <div className="monitor-column">
          <MonitorPanel
            project={project}
            active={tab === "monitor"}
            onDemo={handleDemo}
            onSaveDraft={() => void handleSaveDraft()}
            onExportJson={() => void handleExportJson()}
            onSnapshot={handleSnapshot}
            onExportSrt={handleExportSrt}
            onOpenPresentation={() => store.openModal("presentation", true)}
            onOpenWorksheet={() => store.openModal("worksheet", true)}
            onOpenQuiz={() => store.openModal("quiz", true)}
            onOpenMaterials={() => store.openModal("materials", true)}
            onExportVideo={() => void handleExportVideo()}
            onRegenerate={handleRegenerateScene}
            onRecorded={handleRecorded}
            onLanguageChange={(code) => void handleLanguageChange(code)}
          />
        </div>
      </main>

      <footer className="site-footer">
        <div className="footer-left">
          <span className="footer-brand">
            <Sparkles size={14} />
            판서랩
          </span>
          <span className="footer-dot">·</span>
          <span>교육용 화이트보드 영상 만들기</span>
          {project && (
            <>
              <span className="footer-dot">·</span>
              <span>
                {project.scenes.length}씬 · {Math.round(totalDuration)}초
              </span>
            </>
          )}
        </div>
        <div className="footer-right">
          <span className="footer-note">
            <ShieldCheck size={13} />
            모든 처리는 브라우저에서 이루어집니다
          </span>
          <span className="footer-dot">·</span>
          <span>© {new Date().getFullYear()} 판서랩</span>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="footer-link">
            Gemini API
            <ArrowUpRight size={12} />
          </a>
        </div>
      </footer>

      <input
        ref={importRef}
        type="file"
        accept=".json,.panseolab.json,application/json"
        hidden
        onChange={(event) => void handleImportFile(event)}
      />

      <PresentationMode
        project={project}
        open={store.presentationOpen}
        startScene={store.activeSceneIndex}
        onClose={() => store.openModal("presentation", false)}
      />
      <WorksheetModal
        open={store.worksheetOpen}
        project={project}
        onClose={() => store.openModal("worksheet", false)}
      />
      <QuizModal
        open={store.quizOpen}
        project={project}
        onClose={() => store.openModal("quiz", false)}
      />
      <MaterialsModal
        open={store.materialsOpen}
        project={project}
        onClose={() => store.openModal("materials", false)}
      />
      <HistoryModal
        open={store.historyOpen}
        onClose={() => store.openModal("history", false)}
      />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <VideoExportModal
        open={exportOpen}
        progress={exportProgress}
        message={exportMessage}
        result={exportResult}
        error={exportError}
        onCancel={handleCancelExport}
        onClose={closeExport}
      />
      <Toasts />
      {translating && (
        <div className="translating-chip" role="status">
          <span className="spinner-dot" />
          자막을 번역하는 중...
        </div>
      )}
    </div>
  );
}
