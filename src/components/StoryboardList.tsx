import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  FileJson,
  Loader2,
  Mic,
  PencilLine,
  Plus,
  Save,
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
import { synthesizeNarration } from "../lib/gemini";
import { createSnapshot } from "../lib/storage";
import type { RecordedResult } from "../hooks/useRecorder";
import { RewriteSceneModal } from "./RewriteSceneModal";
import type { SceneRewriteContent } from "../lib/rewrite";

interface StoryboardListProps {
  project: Project;
  activeScene: number;
  onSelectScene: (index: number) => void;
  onRegenerate: (index: number) => Promise<void>;
  onRecorded: (index: number, result: RecordedResult) => void;
  onSaveDraft: () => void;
  onExportJson: () => void;
}

function audioBadge(scene: Scene) {
  if (scene.audioSource === "tts") return { label: "AI 음성", tone: "ai" };
  if (scene.audioSource === "recorded") return { label: "내 목소리", tone: "recorded" };
  return { label: "무음", tone: "none" };
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
  const store = useStudioStore();
  const recorder = useRecorder();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<Scene | null>(null);
  const [regenerating, setRegenerating] = useState<number | null>(null);
  const [rewriteIndex, setRewriteIndex] = useState<number | null>(null);

  const totalDuration = useMemo(
    () => project.scenes.reduce((sum, scene) => sum + scene.duration, 0),
    [project.scenes],
  );

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setDraft(JSON.parse(JSON.stringify(project.scenes[index])) as Scene);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setDraft(null);
  };

  const saveEdit = () => {
    if (editingIndex === null || !draft) return;
    store.updateScene(editingIndex, {
      type: draft.type,
      title: draft.title,
      subtitle: draft.subtitle,
      beats: draft.beats,
    });
    setEditingIndex(null);
    setDraft(null);
    store.pushToast("success", `${editingIndex + 1}번째 씬의 대본과 판서를 저장했습니다.`);
  };

  const regenerate = async (index: number) => {
    if (!store.apiKey.trim()) {
      store.pushToast("error", "음성 재생성을 위해 Gemini API 키를 입력해 주세요.");
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
        store.pushToast("success", `${index + 1}번째 씬에 내 목소리를 적용했습니다.`);
      }
      return;
    }
    if (recorder.isRecording) {
      store.pushToast("info", "이미 다른 씬을 녹음하고 있습니다. 먼저 녹음을 완료해 주세요.");
      return;
    }
    try {
      await recorder.start(index);
      store.pushToast("info", "녹음을 시작했습니다. 프롬프트를 읽고 완료 버튼을 눌러 주세요.");
    } catch (error) {
      store.pushToast(
        "error",
        error instanceof Error
          ? `마이크를 시작하지 못했습니다: ${error.message}`
          : "마이크 권한이 필요합니다. 브라우저 주소창에서 마이크 허용을 확인해 주세요.",
      );
    }
  };

  const applyRewrite = async (index: number, rewrite: SceneRewriteContent, withAudio: boolean) => {
    const scene = project.scenes[index];
    if (!scene) return;
    try {
      await createSnapshot(project, `AI 재작성 전 · ${scene.title}`, true);
    } catch {
      /* snapshot is best-effort */
    }
    const beats = rewrite.beats.map((beat) => ({ id: uid("beat"), ...beat }));
    let audio:
      | { blob: Blob; duration: number; windows: [number, number][]; source: "tts" }
      | undefined;
    if (withAudio) {
      if (!store.apiKey.trim()) {
        throw new Error("음성 생성을 위해 Gemini API 키가 필요합니다.");
      }
      const result = await synthesizeNarration({
        apiKey: store.apiKey,
        text: beats.map((beat) => beat.narration).join(" "),
        beats,
        voice: store.voice,
        ttsModel: store.ttsModel,
        onFallback: (model) =>
          store.pushToast("info", `TTS 모델을 ${model}로 자동 전환했습니다.`),
      });
      audio = {
        blob: result.blob,
        duration: result.duration,
        windows: result.windows,
        source: "tts",
      };
    }
    store.applySceneRewrite(
      index,
      { title: rewrite.title, subtitle: rewrite.subtitle, beats },
      audio,
    );
    store.pushToast(
      "success",
      withAudio
        ? `${index + 1}번째 장면을 재작성하고 음성을 새로 만들었습니다.`
        : `${index + 1}번째 장면을 재작성했습니다. 음성 업데이트가 필요합니다.`,
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
          스토리보드 상세 큐시트
        </h2>
        <div className="storyboard-actions">
          <button type="button" className="mini-button" onClick={onSaveDraft}>
            <Save size={13} />
            초안 저장
          </button>
          <button type="button" className="mini-button" onClick={onExportJson}>
            <FileJson size={13} />
            JSON 내보내기
          </button>
          <span className="storyboard-total">
            총 {project.scenes.length}씬 · {Math.round(totalDuration)}초
          </span>
        </div>
      </div>

      {activeRecordingScene && (
        <div className="recording-banner">
          <span className="recording-dot" />
          <div>
            <strong>{recorder.recordingScene! + 1}번째 씬 녹음 중</strong>
            <p>“{activeRecordingScene.beats[0]?.narration}”</p>
          </div>
          <button
            type="button"
            className="danger-button"
            onClick={() => void record(recorder.recordingScene!)}
          >
            <Square size={13} />
            녹음 완료
          </button>
          <button type="button" className="icon-button" onClick={recorder.cancel} aria-label="녹음 취소">
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
              className={`scene-card ${activeScene === index ? "is-active" : ""}`}
            >
              <button
                type="button"
                className="scene-card-summary"
                onClick={() => onSelectScene(index)}
                aria-label={`${index + 1}번째 씬으로 이동`}
              >
                <span className={`scene-kind kind-${scene.type}`}>
                  {scene.type === "intro" ? "INTRO" : scene.type === "outro" ? "OUTRO" : `SCENE ${index}`}
                </span>
                <span className="scene-title">
                  <strong>{scene.title}</strong>
                  <small>{scene.subtitle}</small>
                </span>
                {stale && (
                  <span className="audio-badge tone-stale" title="대본이 바뀌어 음성을 다시 만들어야 합니다">
                    <AlertTriangle size={11} />
                    업데이트 필요
                  </span>
                )}
                <span className={`audio-badge tone-${badge.tone}`}>{badge.label}</span>
                <span className="scene-time">{scene.duration.toFixed(1)}초</span>
              </button>

              <div className="scene-card-actions">
                <button
                  type="button"
                  className="mini-button is-ai"
                  onClick={() => setRewriteIndex(index)}
                >
                  <Wand2 size={13} />
                  AI로 다시 쓰기
                </button>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => (isEditing ? cancelEdit() : startEdit(index))}
                >
                  <PencilLine size={13} />
                  대본/판서 수정
                </button>
                <button
                  type="button"
                  className={`mini-button ${recorder.isRecording && recorder.recordingScene === index ? "is-recording" : ""}`}
                  onClick={() => void record(index)}
                >
                  <Mic size={13} />
                  {recorder.isRecording && recorder.recordingScene === index ? "녹음 완료" : "내 목소리 녹음"}
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
                  {regenerating === index ? "생성 중" : "음성 다시 만들기"}
                </button>
                <span className="scene-action-divider" />
                <button
                  type="button"
                  className="icon-button tiny"
                  onClick={() => store.moveScene(index, index - 1)}
                  disabled={index === 0}
                  aria-label="씬 위로 이동"
                  title="위로"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  className="icon-button tiny"
                  onClick={() => store.moveScene(index, index + 1)}
                  disabled={index === project.scenes.length - 1}
                  aria-label="씬 아래로 이동"
                  title="아래로"
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  className="icon-button tiny"
                  onClick={() => store.duplicateScene(index)}
                  disabled={!canAddScene(project)}
                  aria-label="씬 복제"
                  title="복제"
                >
                  <Copy size={13} />
                </button>
                <button
                  type="button"
                  className="icon-button tiny is-danger"
                  onClick={() => {
                    if (window.confirm(`${index + 1}번째 씬을 삭제할까요?`)) {
                      store.deleteScene(index);
                    }
                  }}
                  disabled={!canDeleteScene(project)}
                  aria-label="씬 삭제"
                  title="삭제"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {isEditing && draft ? (
                <div className="scene-editor">
                  <div className="editor-row">
                    <label className="field-label">
                      장면 유형
                      <select
                        className="text-input"
                        value={draft.type}
                        onChange={(event) =>
                          setDraft({ ...draft, type: event.target.value as SceneType })
                        }
                      >
                        <option value="intro">도입</option>
                        <option value="body">전개</option>
                        <option value="outro">정리</option>
                      </select>
                    </label>
                    <label className="field-label">
                      씬 제목
                      <input
                        className="text-input"
                        value={draft.title}
                        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                      />
                    </label>
                  </div>
                  <label className="field-label">
                    한 줄 요약
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
                          <span className="beat-editor-title">비트 {beatIndex + 1}</span>
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
                            aria-label={`비트 ${beatIndex + 1} 삭제`}
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
                          placeholder="핵심 키워드"
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
                          placeholder="짧은 설명"
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
                          placeholder="나레이션 대본"
                        />
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
                      비트 추가 ({draft.beats.length}/5)
                    </button>
                    <span className="editor-spacer" />
                    <button type="button" className="mini-button" onClick={cancelEdit}>
                      취소
                    </button>
                    <button type="button" className="mini-button is-primary" onClick={saveEdit}>
                      <Check size={13} />
                      저장
                    </button>
                  </div>
                  <p className="editor-note">
                    대본을 수정한 뒤 AI 음성을 다시 만들면 변경된 내용이 반영됩니다.
                  </p>
                </div>
              ) : (
                <div className="scene-beats">
                  {scene.beats.map((beat, beatIndex) => (
                    <div className="beat-preview" key={beat.id}>
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
                  대본이 바뀌어 기존 음성이 맞지 않습니다. 눌러서 음성을 다시 만드세요.
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
          장면 추가 ({project.scenes.length}/{10})
        </button>
        <span className="panel-hint">
          장면 {project.scenes.length}개 · 비트 2~5개 · 모든 편집은 Undo로 되돌릴 수 있습니다
        </span>
      </div>

      {rewriteIndex !== null && project.scenes[rewriteIndex] && (
        <RewriteSceneModal
          open
          project={project}
          sceneIndex={rewriteIndex}
          onClose={() => setRewriteIndex(null)}
          onApply={(rewrite, withAudio) => applyRewrite(rewriteIndex, rewrite, withAudio)}
        />
      )}
    </section>
  );
}
