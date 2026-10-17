import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  LayoutStyle,
  Project,
  Scene,
  SceneType,
  ThemeId,
  VisualStyle,
} from "../types/project";
import { SETTINGS_KEY } from "../data/presets";
import { uid } from "../lib/time";
import {
  emptyHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type ProjectHistory,
} from "../lib/history";
import {
  addBeat as addBeatOp,
  addScene as addSceneOp,
  applySceneRewrite as applySceneRewriteOp,
  deleteBeat as deleteBeatOp,
  deleteScene as deleteSceneOp,
  duplicateScene as duplicateSceneOp,
  moveBeat as moveBeatOp,
  moveScene as moveSceneOp,
  replaceSceneContent,
  setSceneType as setSceneTypeOp,
  withSceneAudio,
} from "../lib/sceneOps";

export type StudioPhase = "idle" | "generating" | "ready" | "exporting";
export type AutosaveState = "idle" | "saving" | "saved" | "error";

export interface Toast {
  id: string;
  kind: "info" | "success" | "error";
  message: string;
}

export interface StudioState {
  apiKey: string;
  rememberKey: boolean;
  topic: string;
  themeId: ThemeId;
  visualStyle: VisualStyle;
  layoutStyle: LayoutStyle;
  model: string;
  ttsModel: string;
  voice: string;
  bgmId: string;
  bgmVolume: number;
  resolution: "fhd" | "hd";
  exportFormat: "webm" | "mp4";
  generateWithAudio: boolean;
  captions: boolean;
  captionLang: string;
  rate: number;
  penTip: boolean;
  sfx: boolean;
  project: Project | null;
  history: ProjectHistory;
  phase: StudioPhase;
  progressPercent: number;
  progressMessage: string;
  activeSceneIndex: number;
  currentTime: number;
  isPlaying: boolean;
  autosaveState: AutosaveState;
  lastSavedAt: string | null;
  draftAvailable: boolean;
  toasts: Toast[];
  translations: Record<string, string[][]>;
  presentationOpen: boolean;
  worksheetOpen: boolean;
  quizOpen: boolean;
  materialsOpen: boolean;
  historyOpen: boolean;
  setApiKey: (value: string) => void;
  setRememberKey: (value: boolean) => void;
  patch: (partial: Partial<StudioState>) => void;
  setProject: (project: Project | null) => void;
  loadProject: (project: Project) => void;
  applyEdit: (mutator: (project: Project) => Project) => void;
  updateScene: (index: number, patch: Partial<Scene>) => void;
  updateBeat: (
    sceneIndex: number,
    beatIndex: number,
    patch: Partial<Scene["beats"][number]>,
  ) => void;
  setSceneType: (sceneIndex: number, type: SceneType) => void;
  addScene: (afterIndex: number) => void;
  deleteScene: (index: number) => void;
  duplicateScene: (index: number) => void;
  moveScene: (from: number, to: number) => void;
  addBeat: (sceneIndex: number, afterBeatIndex?: number) => void;
  deleteBeat: (sceneIndex: number, beatIndex: number) => void;
  moveBeat: (sceneIndex: number, from: number, to: number) => void;
  replaceSceneAudio: (
    sceneIndex: number,
    audio: { blob: Blob; duration: number; windows?: [number, number][]; source: "tts" | "recorded" },
  ) => void;
  applySceneRewrite: (
    sceneIndex: number,
    content: { title: string; subtitle: string; beats: Scene["beats"] },
    audio?: { blob: Blob; duration: number; windows?: [number, number][]; source: "tts" | "recorded" },
  ) => void;
  undo: () => void;
  redo: () => void;
  setProgress: (percent: number, message: string) => void;
  setPhase: (phase: StudioPhase) => void;
  setAutosaveState: (state: AutosaveState, savedAt?: string) => void;
  setDraftAvailable: (value: boolean) => void;
  pushToast: (kind: Toast["kind"], message: string) => void;
  dismissToast: (id: string) => void;
  setTranslation: (lang: string, narrations: string[][]) => void;
  openModal: (
    name: "presentation" | "worksheet" | "quiz" | "materials" | "history",
    open: boolean,
  ) => void;
  resetProject: () => void;
}

const defaultTopic = "광합성이 빛을 양분으로 바꾸는 과정";

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      apiKey: "",
      rememberKey: false,
      topic: defaultTopic,
      themeId: "paper",
      visualStyle: "diagram",
      layoutStyle: "adaptive",
      model: "gemini-3.8-flash",
      ttsModel: "gemini-3.8-flash-tts",
      voice: "Kore",
      bgmId: "none",
      bgmVolume: 0.4,
      resolution: "fhd",
      exportFormat: "webm",
      generateWithAudio: true,
      captions: true,
      captionLang: "ko",
      rate: 1,
      penTip: true,
      sfx: true,
      project: null,
      history: emptyHistory,
      phase: "idle",
      progressPercent: 0,
      progressMessage: "",
      activeSceneIndex: 0,
      currentTime: 0,
      isPlaying: false,
      autosaveState: "idle",
      lastSavedAt: null,
      draftAvailable: false,
      toasts: [],
      translations: {},
      presentationOpen: false,
      worksheetOpen: false,
      quizOpen: false,
      materialsOpen: false,
      historyOpen: false,
      setApiKey: (value) => set({ apiKey: value }),
      setRememberKey: (value) => set({ rememberKey: value }),
      patch: (partial) => set(partial),
      loadProject: (project) =>
        set({
          topic: project.topic,
          themeId: project.themeId,
          visualStyle: project.visualStyle,
          layoutStyle: project.layoutStyle,
          voice: project.voice,
          model: project.model,
          ttsModel: project.ttsModel,
          bgmId: project.bgmId,
          project,
          history: emptyHistory,
          phase: "ready",
          progressPercent: 0,
          progressMessage: "",
          activeSceneIndex: 0,
          currentTime: 0,
          isPlaying: false,
          autosaveState: "idle",
          translations: {},
          draftAvailable: false,
        }),
      setProject: (project) =>
        set({
          project,
          history: emptyHistory,
          phase: project ? "ready" : "idle",
          progressPercent: 0,
          progressMessage: "",
          activeSceneIndex: 0,
          currentTime: 0,
          isPlaying: false,
          autosaveState: "idle",
          translations: {},
          draftAvailable: false,
        }),
      applyEdit: (mutator) => {
        const current = get().project;
        if (!current) return;
        const next = mutator(current);
        if (!next || next === current) return;
        set({
          project: next,
          history: pushHistory(get().history, current),
          autosaveState: "saving",
        });
      },
      updateScene: (index, patch) => {
        get().applyEdit((project) => replaceSceneContent(project, index, patch));
      },
      updateBeat: (sceneIndex, beatIndex, patch) => {
        get().applyEdit((project) => {
          const scene = project.scenes[sceneIndex];
          if (!scene) return project;
          const beats = scene.beats.map((beat, index) =>
            index === beatIndex ? { ...beat, ...patch } : beat,
          );
          return replaceSceneContent(project, sceneIndex, { beats });
        });
      },
      setSceneType: (sceneIndex, type) => {
        get().applyEdit((project) => setSceneTypeOp(project, sceneIndex, type));
      },
      addScene: (afterIndex) => {
        get().applyEdit((project) => addSceneOp(project, afterIndex));
      },
      deleteScene: (index) => {
        get().applyEdit((project) => deleteSceneOp(project, index));
      },
      duplicateScene: (index) => {
        get().applyEdit((project) => duplicateSceneOp(project, index));
      },
      moveScene: (from, to) => {
        get().applyEdit((project) => moveSceneOp(project, from, to));
      },
      addBeat: (sceneIndex, afterBeatIndex) => {
        get().applyEdit((project) => addBeatOp(project, sceneIndex, afterBeatIndex));
      },
      deleteBeat: (sceneIndex, beatIndex) => {
        get().applyEdit((project) => deleteBeatOp(project, sceneIndex, beatIndex));
      },
      moveBeat: (sceneIndex, from, to) => {
        get().applyEdit((project) => moveBeatOp(project, sceneIndex, from, to));
      },
      replaceSceneAudio: (sceneIndex, audio) => {
        get().applyEdit((project) => withSceneAudio(project, sceneIndex, audio));
      },
      applySceneRewrite: (sceneIndex, content, audio) => {
        get().applyEdit((project) =>
          applySceneRewriteOp(project, sceneIndex, content, audio),
        );
      },
      undo: () => {
        const { history, project } = get();
        if (!project) return;
        const result = undoHistory(history, project);
        if (!result) return;
        set({
          project: result.project,
          history: result.history,
          translations: {},
          autosaveState: "saving",
          activeSceneIndex: Math.min(get().activeSceneIndex, result.project.scenes.length - 1),
        });
      },
      redo: () => {
        const { history, project } = get();
        if (!project) return;
        const result = redoHistory(history, project);
        if (!result) return;
        set({
          project: result.project,
          history: result.history,
          translations: {},
          autosaveState: "saving",
          activeSceneIndex: Math.min(get().activeSceneIndex, result.project.scenes.length - 1),
        });
      },
      setProgress: (progressPercent, progressMessage) =>
        set({ progressPercent, progressMessage }),
      setPhase: (phase) => set({ phase }),
      setAutosaveState: (autosaveState, savedAt) =>
        set({ autosaveState, lastSavedAt: savedAt ?? get().lastSavedAt }),
      setDraftAvailable: (draftAvailable) => set({ draftAvailable }),
      pushToast: (kind, message) => {
        const toast: Toast = { id: uid("toast"), kind, message };
        set({ toasts: [...get().toasts, toast] });
        window.setTimeout(() => {
          set({ toasts: get().toasts.filter((item) => item.id !== toast.id) });
        }, 4200);
      },
      dismissToast: (id) =>
        set({ toasts: get().toasts.filter((item) => item.id !== id) }),
      setTranslation: (lang, narrations) =>
        set({ translations: { ...get().translations, [lang]: narrations } }),
      openModal: (name, open) =>
        set({
          presentationOpen: name === "presentation" ? open : get().presentationOpen,
          worksheetOpen: name === "worksheet" ? open : get().worksheetOpen,
          quizOpen: name === "quiz" ? open : get().quizOpen,
          materialsOpen: name === "materials" ? open : get().materialsOpen,
          historyOpen: name === "history" ? open : get().historyOpen,
        }),
      resetProject: () =>
        set({
          project: null,
          history: emptyHistory,
          phase: "idle",
          progressPercent: 0,
          progressMessage: "",
          activeSceneIndex: 0,
          currentTime: 0,
          isPlaying: false,
          autosaveState: "idle",
          translations: {},
        }),
    }),
    {
      name: SETTINGS_KEY,
      partialize: (state) => ({
        topic: state.topic,
        themeId: state.themeId,
        visualStyle: state.visualStyle,
        layoutStyle: state.layoutStyle,
        model: state.model,
        ttsModel: state.ttsModel,
        voice: state.voice,
        bgmId: state.bgmId,
        bgmVolume: state.bgmVolume,
        resolution: state.resolution,
        exportFormat: state.exportFormat,
        generateWithAudio: state.generateWithAudio,
        captions: state.captions,
        captionLang: state.captionLang,
        rate: state.rate,
        penTip: state.penTip,
        sfx: state.sfx,
        rememberKey: state.rememberKey,
        ...(state.rememberKey ? { apiKey: state.apiKey } : {}),
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<StudioState>;
        const remember = Boolean(saved.rememberKey);
        return {
          ...current,
          ...saved,
          apiKey: remember ? saved.apiKey ?? "" : "",
        };
      },
    },
  ),
);
