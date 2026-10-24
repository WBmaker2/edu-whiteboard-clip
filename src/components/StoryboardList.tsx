import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  FileJson,
  GripVertical,
  ImagePlus,
  Loader2,
  Mic,
  PencilLine,
  Plus,
  Save,
  Sigma,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  Wand2,
  X,
} from "lucide-react";
import type { Project, Scene, SceneType } from "../types/project";
import { useStudioStore } from "../store/studioStore";
import { useRecorder } from "../hooks/useRecorder";
import { uid } from "../lib/time";
import {
  canAddBeat,
  canAddScene,
  canDeleteScene,
  defaultBeat,
  isAudioStale,
} from "../lib/sceneOps";
import { generateSceneAudio } from "../lib/narration";
import { useI18n } from "../lib/i18n";
import { createSnapshot } from "../lib/storage";
import {
  createFormulaAsset,
  createImageAssetFromFile,
} from "../lib/assets";
import { generateImageAsset } from "../lib/imageGen";
import { FormulaEditor } from "./FormulaEditor";
import { ConfirmDialog } from "./ConfirmDialog";
import type { RecordedResult } from "../hooks/useRecorder";
import type { SceneRewriteContent } from "../lib/rewrite";

const RewriteSceneModal = lazy(() =>
  import("./RewriteSceneModal").then((module) => ({
    default: module.RewriteSceneModal,
  })),
);

interface StoryboardListProps {
  project: Project;
  activeScene: number;
  onSelectScene: (index: number) => void;
  onRegenerate: (index: number) => Promise<void>;
  onRecorded: (index: number, result: RecordedResult) => void;
  onSaveDraft: () => void;
  onExportJson: () => void;
}

export function StoryboardList({
  project,
  activeScene,
  onSelectScene,
  onRegenerate,
  onRecorded,
  onSaveDraft,
  onExportJson,
}: StoryboardListProps) {
  const { t, te } = useI18n();
  const store = useStudioStore(
    useShallow((state) => ({
      apiKey: state.apiKey,
      voice: state.voice,
      ttsModel: state.ttsModel,
      updateScene: state.updateScene,
      applySceneRewrite: state.applySceneRewrite,
      addScene: state.addScene,
      deleteScene: state.deleteScene,
      duplicateScene: state.duplicateScene,
      moveScene: state.moveScene,
      addAsset: state.addAsset,
      pushToast: state.pushToast,
    })),
  );
  const recorder = useRecorder();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<Scene | null>(null);
  const [regenerating, setRegenerating] = useState<number | null>(null);
  const [rewriteIndex, setRewriteIndex] = useState<number | null>(null);
  const [formulaFor, setFormulaFor] = useState<number | null>(null);
  const [aiFor, setAiFor] = useState<number | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImageBeatRef = useRef<number | null>(null);

  const totalDuration = useMemo(
    () => project.scenes.reduce((sum, scene) => sum + scene.duration, 0),
    [project.scenes],
  );

  const audioBadge = (scene: Scene) => {
    if (scene.audioSource === "tts") return { label: t("storyboard.audioAi"), tone: "ai" };
    if (scene.audioSource === "recorded")
      return { label: t("storyboard.audioRecorded"), tone: "recorded" };
    return { label: t("storyboard.audioNone"), tone: "none" };
  };

  const visualKindLabel = (kind: "image" | "formula" | "ai"): string =>
    kind === "formula"
      ? t("storyboard.kindFormula")
      : kind === "ai"
        ? t("storyboard.kindAi")
        : t("storyboard.kindImage");

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setFormulaFor(null);
    setAiFor(null);
    setDraft(JSON.parse(JSON.stringify(project.scenes[index])) as Scene);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setDraft(null);
    setFormulaFor(null);
    setAiFor(null);
  };

  const saveEdit = () => {
    if (editingIndex === null || !draft) return;
    store.updateScene(editingIndex, {
      type: draft.type,
      title: draft.title,
      subtitle: draft.subtitle,
      beats: draft.beats,
    });
    const sceneNumber = editingIndex + 1;
    setEditingIndex(null);
    setDraft(null);
    setFormulaFor(null);
    setAiFor(null);
    store.pushToast("success", t("storyboard.savedScene", { scene: sceneNumber }));
  };

  const assetUrl = (assetId?: string) =>
    assetId ? project.assets[assetId]?.url : undefined;

  const openImagePicker = (beatIndex: number) => {
    pendingImageBeatRef.current = beatIndex;
    imageInputRef.current?.click();
  };

  const handleImageChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    const beatIndex = pendingImageBeatRef.current;
    pendingImageBeatRef.current = null;
    if (!file || beatIndex === null) return;
    if (!file.type.startsWith("image/")) {
      store.pushToast("error", t("storyboard.onlyImages"));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      store.pushToast("error", t("storyboard.imageTooLarge"));
      return;
    }
    try {
      const asset = await createImageAssetFromFile(file);
      store.addAsset(asset);
      setDraft((current) =>
        current
          ? {
              ...current,
              beats: current.beats.map((beat, index) =>
                index === beatIndex
                  ? { ...beat, visual: { kind: "image" as const, assetId: asset.id } }
                  : beat,
              ),
            }
          : current,
      );
      store.pushToast(
        "success",
        t("storyboard.imageAttached", { beat: beatIndex + 1 }),
      );
    } catch {
      store.pushToast("error", t("storyboard.imageReadFailed"));
    }
  };

  const applyFormula = (
    beatIndex: number,
    latex: string,
    png: Blob,
    width: number,
    height: number,
  ) => {
    const asset = createFormulaAsset(latex, png, width, height);
    store.addAsset(asset);
    setDraft((current) =>
      current
        ? {
            ...current,
            beats: current.beats.map((beat, index) =>
              index === beatIndex
                ? { ...beat, visual: { kind: "formula" as const, assetId: asset.id } }
                : beat,
            ),
          }
        : current,
    );
    setFormulaFor(null);
    store.pushToast(
      "success",
      t("storyboard.formulaAdded", { beat: beatIndex + 1 }),
    );
  };

  const openAiFor = (beatIndex: number, current?: string) => {
    setFormulaFor(null);
    setAiFor(beatIndex);
    setAiPrompt(current ?? draft?.beats[beatIndex]?.label ?? "");
  };

  const generateAiImage = async (beatIndex: number) => {
    const prompt = aiPrompt.trim();
    if (!prompt) {
      store.pushToast("error", t("storyboard.aiNeedPrompt"));
      return;
    }
    if (!store.apiKey.trim()) {
      store.pushToast("error", t("storyboard.aiNeedKey"));
      return;
    }
    setAiBusy(true);
    try {
      const asset = await generateImageAsset({
        prompt,
        apiKey: store.apiKey,
        aspect: project.aspect,
      });
      store.addAsset(asset);
      setDraft((current) =>
        current
          ? {
              ...current,
              beats: current.beats.map((beat, index) =>
                index === beatIndex
                  ? { ...beat, visual: { kind: "ai" as const, assetId: asset.id } }
                  : beat,
              ),
            }
          : current,
      );
      setAiFor(null);
      setAiPrompt("");
      store.pushToast("success", t("storyboard.aiAdded", { beat: beatIndex + 1 }));
    } catch (error) {
      store.pushToast(
        "error",
        error instanceof Error ? te(error.message) : t("storyboard.aiFailed"),
      );
    } finally {
      setAiBusy(false);
    }
  };

  const removeVisual = (beatIndex: number) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            beats: current.beats.map((beat, index) =>
              index === beatIndex ? { ...beat, visual: undefined } : beat,
            ),
          }
        : current,
    );
  };

  const regenerate = async (index: number) => {
    if (!store.apiKey.trim()) {
      store.pushToast("error", t("storyboard.needKeyRegen"));
      return;
    }
    setRegenerating(index);
    try {
      await onRegenerate(index);
    } finally {
      setRegenerating(null);
    }
  };

  const record = async (index: number) => {
    if (recorder.isRecording && recorder.recordingScene === index) {
      const result = await recorder.stop(project.scenes[index]);
      if (result) {
        onRecorded(index, result);
        store.pushToast("success", t("storyboard.voiceApplied", { scene: index + 1 }));
      }
      return;
    }
    if (recorder.isRecording) {
      store.pushToast("info", t("storyboard.recordingOther"));
      return;
    }
    try {
      await recorder.start(index);
      store.pushToast("info", t("storyboard.recordingStarted"));
    } catch (error) {
      store.pushToast(
        "error",
        error instanceof Error
          ? t("storyboard.micFailed", { message: te(error.message) })
          : t("storyboard.micPermission"),
      );
    }
  };

  const applyRewrite = async (index: number, rewrite: SceneRewriteContent, withAudio: boolean) => {
    const scene = project.scenes[index];
    if (!scene) return;
    try {
      await createSnapshot(
        project,
        t("storyboard.snapshotLabel", { title: scene.title }),
        true,
      );
    } catch {
      /* snapshot is best-effort */
    }
    const beats = rewrite.beats.map((beat) => ({ id: uid("beat"), ...beat }));
    let audio:
      | { blob: Blob; duration: number; windows: [number, number][]; source: "tts" }
      | undefined;
    if (withAudio) {
      if (!store.apiKey.trim()) {
        throw new Error(t("storyboard.needKeyForAudio"));
      }
      audio = await generateSceneAudio({
        apiKey: store.apiKey,
        voice: store.voice,
        ttsModel: store.ttsModel,
        beats,
        onFallback: (model) =>
          store.pushToast("info", t("storyboard.ttsFallback", { model })),
      });
    }
    store.applySceneRewrite(
      index,
      { title: rewrite.title, subtitle: rewrite.subtitle, beats },
      audio,
    );
    store.pushToast(
      "success",
      withAudio
        ? t("storyboard.rewrittenWithAudio", { scene: index + 1 })
        : t("storyboard.rewrittenNeedsAudio", { scene: index + 1 }),
    );
  };

  const activeRecordingScene =
    recorder.isRecording && recorder.recordingScene !== null
      ? project.scenes[recorder.recordingScene]
      : null;

  return (
    <section className="panel-card storyboard-card">
      <div className="storyboard-heading">
        <h2 className="panel-label">
          <Sparkles size={15} />
          {t("storyboard.title")}
        </h2>
        <div className="storyboard-actions">
          <button type="button" className="mini-button" onClick={onSaveDraft}>
            <Save size={13} />
            {t("storyboard.saveDraft")}
          </button>
          <button type="button" className="mini-button" onClick={onExportJson}>
            <FileJson size={13} />
            {t("storyboard.exportJson")}
          </button>
          <span className="storyboard-total">
            {t("storyboard.total", {
              scenes: project.scenes.length,
              seconds: Math.round(totalDuration),
            })}
          </span>
        </div>
      </div>

      {activeRecordingScene && (
        <div className="recording-banner">
          <span className="recording-dot" />
          <div>
            <strong>
              {t("storyboard.recordingScene", { scene: recorder.recordingScene! + 1 })}
            </strong>
            <p>“{activeRecordingScene.beats[0]?.narration}”</p>
          </div>
          <button
            type="button"
            className="danger-button"
            onClick={() => void record(recorder.recordingScene!)}
          >
            <Square size={13} />
            {t("storyboard.finishRecording")}
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={recorder.cancel}
            aria-label={t("storyboard.cancelRecording")}
          >
            <X size={15} />
          </button>
        </div>
      )}

      <div className="storyboard-list">
        {project.scenes.map((scene, index) => {
          const isEditing = editingIndex === index;
          const badge = audioBadge(scene);
          const stale = isAudioStale(scene);
          return (
            <article
              key={scene.id}
              className={`scene-card ${activeScene === index ? "is-active" : ""} ${
                dragOver === index ? "is-drag-over" : ""
              }`}
              onDragOver={(event) => {
                if (dragIndexRef.current === null) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDragOver(index);
              }}
              onDragLeave={() => setDragOver((current) => (current === index ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                const from = dragIndexRef.current;
                if (from !== null && from !== index) {
                  store.moveScene(from, index);
                }
                dragIndexRef.current = null;
                setDragOver(null);
              }}
            >
              <button
                type="button"
                className="scene-card-summary"
                onClick={() => onSelectScene(index)}
              >
                <span className={`scene-kind kind-${scene.type}`}>
                  {scene.type === "intro" ? "INTRO" : scene.type === "outro" ? "OUTRO" : `SCENE ${index}`}
                </span>
                <span className="scene-title">
                  <strong>{scene.title}</strong>
                  <small>{scene.subtitle}</small>
                </span>
                {stale && (
                  <span className="audio-badge tone-stale" title={t("storyboard.staleTitle")}>
                    <AlertTriangle size={11} />
                    {t("storyboard.staleBadge")}
                  </span>
                )}
                <span className={`audio-badge tone-${badge.tone}`}>{badge.label}</span>
                <span className="scene-time">
                  {t("storyboard.seconds", { value: scene.duration.toFixed(1) })}
                </span>
              </button>

              <div className="scene-card-actions">
                <span
                  className="scene-drag-handle"
                  draggable
                  role="button"
                  tabIndex={0}
                  aria-label={t("storyboard.dragHandle", { scene: index + 1 })}
                  title={t("storyboard.dragHint")}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(index));
                    dragIndexRef.current = index;
                  }}
                  onDragEnd={() => {
                    dragIndexRef.current = null;
                    setDragOver(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.altKey && event.key === "ArrowUp" && index > 0) {
                      event.preventDefault();
                      store.moveScene(index, index - 1);
                    }
                    if (
                      event.altKey &&
                      event.key === "ArrowDown" &&
                      index < project.scenes.length - 1
                    ) {
                      event.preventDefault();
                      store.moveScene(index, index + 1);
                    }
                  }}
                >
                  <GripVertical size={14} />
                </span>
                <button
                  type="button"
                  className="mini-button is-ai"
                  onClick={() => setRewriteIndex(index)}
                >
                  <Wand2 size={13} />
                  {t("storyboard.rewrite")}
                </button>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => (isEditing ? cancelEdit() : startEdit(index))}
                >
                  <PencilLine size={13} />
                  {t("storyboard.editScript")}
                </button>
                <button
                  type="button"
                  className={`mini-button ${recorder.isRecording && recorder.recordingScene === index ? "is-recording" : ""}`}
                  onClick={() => void record(index)}
                >
                  <Mic size={13} />
                  {recorder.isRecording && recorder.recordingScene === index
                    ? t("storyboard.finishRecording")
                    : t("storyboard.recordVoice")}
                </button>
                <button
                  type="button"
                  className={`mini-button ${stale ? "is-warn" : ""}`}
                  onClick={() => void regenerate(index)}
                  disabled={regenerating === index}
                >
                  {regenerating === index ? (
                    <Loader2 size={13} className="spin" />
                  ) : (
                    <Volume2 size={13} />
                  )}
                  {regenerating === index
                    ? t("storyboard.regenerating")
                    : t("storyboard.regenerate")}
                </button>
                <span className="scene-action-divider" />
                <button
                  type="button"
                  className="icon-button tiny"
                  onClick={() => store.moveScene(index, index - 1)}
                  disabled={index === 0}
                  aria-label={t("storyboard.moveUp")}
                  title={t("storyboard.moveUpShort")}
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  className="icon-button tiny"
                  onClick={() => store.moveScene(index, index + 1)}
                  disabled={index === project.scenes.length - 1}
                  aria-label={t("storyboard.moveDown")}
                  title={t("storyboard.moveDownShort")}
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  className="icon-button tiny"
                  onClick={() => store.duplicateScene(index)}
                  disabled={!canAddScene(project)}
                  aria-label={t("storyboard.duplicate")}
                  title={t("storyboard.duplicateShort")}
                >
                  <Copy size={13} />
                </button>
                <button
                  type="button"
                  className="icon-button tiny is-danger"
                  onClick={() => setConfirmDelete(index)}
                  disabled={!canDeleteScene(project)}
                  aria-label={t("storyboard.delete")}
                  title={t("storyboard.deleteShort")}
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {isEditing && draft ? (
                <div className="scene-editor">
                  <div className="editor-row">
                    <label className="field-label">
                      {t("storyboard.sceneType")}
                      <select
                        className="text-input"
                        value={draft.type}
                        onChange={(event) =>
                          setDraft({ ...draft, type: event.target.value as SceneType })
                        }
                      >
                        <option value="intro">{t("storyboard.typeIntro")}</option>
                        <option value="body">{t("storyboard.typeBody")}</option>
                        <option value="outro">{t("storyboard.typeOutro")}</option>
                      </select>
                    </label>
                    <label className="field-label">
                      {t("storyboard.sceneTitle")}
                      <input
                        className="text-input"
                        value={draft.title}
                        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                      />
                    </label>
                  </div>
                  <label className="field-label">
                    {t("storyboard.oneLineSummary")}
                    <input
                      className="text-input"
                      value={draft.subtitle}
                      onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })}
                    />
                  </label>
                  <div className="beat-editor-grid">
                    {draft.beats.map((beat, beatIndex) => (
                      <div className="beat-editor" key={beat.id}>
                        <div className="beat-editor-head">
                          <span className="beat-editor-title">
                            {t("storyboard.beat", { beat: beatIndex + 1 })}
                          </span>
                          <button
                            type="button"
                            className="icon-button tiny is-danger"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                beats: draft.beats.filter((_, itemIndex) => itemIndex !== beatIndex),
                              })
                            }
                            disabled={draft.beats.length <= 2}
                            aria-label={t("storyboard.deleteBeat", { beat: beatIndex + 1 })}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <input
                          className="text-input compact-input"
                          value={beat.label}
                          onChange={(event) => {
                            const beats = draft.beats.map((item, itemIndex) =>
                              itemIndex === beatIndex ? { ...item, label: event.target.value } : item,
                            );
                            setDraft({ ...draft, beats });
                          }}
                          placeholder={t("storyboard.keyword")}
                        />
                        <input
                          className="text-input compact-input"
                          value={beat.desc}
                          onChange={(event) => {
                            const beats = draft.beats.map((item, itemIndex) =>
                              itemIndex === beatIndex ? { ...item, desc: event.target.value } : item,
                            );
                            setDraft({ ...draft, beats });
                          }}
                          placeholder={t("storyboard.shortDesc")}
                        />
                        <textarea
                          rows={3}
                          className="text-area compact-area"
                          value={beat.narration}
                          onChange={(event) => {
                            const beats = draft.beats.map((item, itemIndex) =>
                              itemIndex === beatIndex
                                ? { ...item, narration: event.target.value }
                                : item,
                            );
                            setDraft({ ...draft, beats });
                          }}
                          placeholder={t("storyboard.narration")}
                        />
                        <div className="beat-visual-row">
                          {beat.visual ? (
                            <>
                              {assetUrl(beat.visual.assetId) ? (
                                <img
                                  className="beat-visual-thumb"
                                  src={assetUrl(beat.visual.assetId)}
                                  alt=""
                                />
                              ) : (
                                <span className="beat-visual-thumb is-empty" />
                              )}
                              <span className="beat-visual-kind">
                                {visualKindLabel(beat.visual.kind)}
                              </span>
                              {beat.visual.kind === "formula" ? (
                                <button
                                  type="button"
                                  className="mini-button"
                                  onClick={() => setFormulaFor(beatIndex)}
                                >
                                  {t("storyboard.edit")}
                                </button>
                              ) : beat.visual.kind === "ai" ? (
                                <button
                                  type="button"
                                  className="mini-button is-ai"
                                  onClick={() =>
                                    openAiFor(
                                      beatIndex,
                                      project.assets[beat.visual!.assetId]?.name,
                                    )
                                  }
                                >
                                  <Sparkles size={12} />
                                  {t("storyboard.aiRegenerate")}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="mini-button"
                                  onClick={() => openImagePicker(beatIndex)}
                                >
                                  {t("storyboard.replace")}
                                </button>
                              )}
                              <button
                                type="button"
                                className="mini-button is-warn"
                                onClick={() => removeVisual(beatIndex)}
                              >
                                <Trash2 size={12} />
                                {t("storyboard.remove")}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="mini-button"
                                onClick={() => openImagePicker(beatIndex)}
                              >
                                <ImagePlus size={12} />
                                {t("storyboard.image")}
                              </button>
                              <button
                                type="button"
                                className="mini-button"
                                onClick={() => setFormulaFor(beatIndex)}
                              >
                                <Sigma size={12} />
                                {t("storyboard.formula")}
                              </button>
                              <button
                                type="button"
                                className="mini-button is-ai"
                                onClick={() => openAiFor(beatIndex)}
                              >
                                <Sparkles size={12} />
                                {t("storyboard.aiImage")}
                              </button>
                            </>
                          )}
                        </div>
                        {formulaFor === beatIndex && (
                          <FormulaEditor
                            initialLatex={
                              beat.visual?.kind === "formula"
                                ? project.assets[beat.visual.assetId]?.latex
                                : undefined
                            }
                            onCancel={() => setFormulaFor(null)}
                            onSave={(latex, png, width, height) =>
                              applyFormula(beatIndex, latex, png, width, height)
                            }
                          />
                        )}
                        {aiFor === beatIndex && (
                          <div className="formula-editor">
                            <label className="field-label">
                              {t("storyboard.aiPromptLabel")}
                              <textarea
                                rows={2}
                                className="text-area compact-area"
                                value={aiPrompt}
                                onChange={(event) => setAiPrompt(event.target.value)}
                                placeholder={t("storyboard.aiPromptPlaceholder")}
                                autoFocus
                              />
                            </label>
                            <p className="editor-note">{t("storyboard.aiDisclosure")}</p>
                            <div className="formula-actions">
                              <button
                                type="button"
                                className="mini-button"
                                onClick={() => setAiFor(null)}
                                disabled={aiBusy}
                              >
                                {t("storyboard.cancel")}
                              </button>
                              <button
                                type="button"
                                className="mini-button is-primary"
                                onClick={() => void generateAiImage(beatIndex)}
                                disabled={aiBusy || !aiPrompt.trim()}
                              >
                                {aiBusy ? (
                                  <Loader2 size={13} className="spin" />
                                ) : (
                                  <Sparkles size={13} />
                                )}
                                {aiBusy
                                  ? t("storyboard.aiGenerating")
                                  : t("storyboard.aiGenerate")}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="editor-actions">
                    <button
                      type="button"
                      className="mini-button"
                      onClick={() =>
                        setDraft({ ...draft, beats: [...draft.beats, defaultBeat(draft.beats.length)] })
                      }
                      disabled={!canAddBeat(draft)}
                    >
                      <Plus size={13} />
                      {t("storyboard.addBeat", { count: draft.beats.length })}
                    </button>
                    <span className="editor-spacer" />
                    <button type="button" className="mini-button" onClick={cancelEdit}>
                      {t("storyboard.cancel")}
                    </button>
                    <button type="button" className="mini-button is-primary" onClick={saveEdit}>
                      <Check size={13} />
                      {t("storyboard.save")}
                    </button>
                  </div>
                  <p className="editor-note">{t("storyboard.editorNote")}</p>
                </div>
              ) : (
                <div className="scene-beats">
                  {scene.beats.map((beat, beatIndex) => (
                    <div className="beat-preview" key={beat.id}>
                      {beat.visual && assetUrl(beat.visual.assetId) && (
                        <img
                          className="beat-preview-thumb"
                          src={assetUrl(beat.visual.assetId)}
                          alt={t("storyboard.beatPreviewAlt", {
                            beat: beatIndex + 1,
                            kind: visualKindLabel(beat.visual.kind),
                          })}
                        />
                      )}
                      <div className="beat-preview-head">
                        <strong>{beat.label}</strong>
                        <span>#{beatIndex + 1}</span>
                      </div>
                      <span className="beat-desc">{beat.desc}</span>
                      <p className="beat-narration">“{beat.narration}”</p>
                    </div>
                  ))}
                </div>
              )}

              {stale && !isEditing && (
                <button
                  type="button"
                  className="stale-notice"
                  onClick={() => void regenerate(index)}
                >
                  <AlertTriangle size={13} />
                  {t("storyboard.staleNotice")}
                </button>
              )}
            </article>
          );
        })}
      </div>

      <div className="storyboard-footer">
        <button
          type="button"
          className="mini-button"
          onClick={() => store.addScene(project.scenes.length - 1)}
          disabled={!canAddScene(project)}
        >
          <Plus size={13} />
          {t("storyboard.addScene")} ({project.scenes.length}/10)
        </button>
        <span className="panel-hint">
          {t("storyboard.footerNote", { scenes: project.scenes.length })}
        </span>
      </div>

      {rewriteIndex !== null && project.scenes[rewriteIndex] && (
        <Suspense fallback={null}>
          <RewriteSceneModal
            open
            project={project}
            sceneIndex={rewriteIndex}
            onClose={() => setRewriteIndex(null)}
            onApply={(rewrite, withAudio) => applyRewrite(rewriteIndex, rewrite, withAudio)}
          />
        </Suspense>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => void handleImageChosen(event)}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title={t("storyboard.deleteTitle")}
        message={
          confirmDelete !== null
            ? t("storyboard.deleteConfirm", { scene: confirmDelete + 1 })
            : ""
        }
        confirmLabel={t("storyboard.delete")}
        cancelLabel={t("common.cancel")}
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete !== null) store.deleteScene(confirmDelete);
          setConfirmDelete(null);
        }}
      />
    </section>
  );
}
