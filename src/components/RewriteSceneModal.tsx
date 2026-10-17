import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, RotateCcw, Sparkles, Volume2, Wand2 } from "lucide-react";
import type { Project } from "../types/project";
import { Modal } from "./Modal";
import { useStudioStore } from "../store/studioStore";
import {
  REWRITE_PRESETS,
  rewriteScene,
  type SceneRewriteContent,
} from "../lib/rewrite";
import { describeBudget, rewriteSceneBudget } from "../lib/requestBudget";

interface RewriteSceneModalProps {
  open: boolean;
  project: Project;
  sceneIndex: number;
  onClose: () => void;
  onApply: (rewrite: SceneRewriteContent, withAudio: boolean) => Promise<void>;
}

function changed(current: string, next: string): boolean {
  return current.trim() !== next.trim();
}

export function RewriteSceneModal({
  open,
  project,
  sceneIndex,
  onClose,
  onApply,
}: RewriteSceneModalProps) {
  const store = useStudioStore();
  const scene = project.scenes[sceneIndex];
  const [presetId, setPresetId] = useState("easier");
  const [custom, setCustom] = useState("");
  const [beatCount, setBeatCount] = useState(3);
  const [withAudio, setWithAudio] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<SceneRewriteContent | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !scene) return;
    setPresetId("easier");
    setCustom("");
    setBeatCount(Math.min(4, Math.max(2, scene.beats.length)));
    setWithAudio(false);
    setResult(null);
    setError("");
    setLoading(false);
    setApplying(false);
  }, [open, sceneIndex, scene]);

  const budget = useMemo(() => rewriteSceneBudget(withAudio), [withAudio]);

  if (!scene) return null;

  const generate = async () => {
    if (!store.apiKey.trim()) {
      store.pushToast("error", "AI 재작성을 위해 Gemini API 키를 입력해 주세요.");
      return;
    }
    const preset = REWRITE_PRESETS.find((item) => item.id === presetId);
    const instruction = [preset?.prompt, custom.trim() ? `추가 지시: ${custom.trim()}` : ""]
      .filter(Boolean)
      .join(" ");
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await rewriteScene({
        apiKey: store.apiKey,
        model: store.model,
        topic: project.topic,
        scene,
        sceneIndex,
        totalScenes: project.scenes.length,
        previousTitle: project.scenes[sceneIndex - 1]?.title,
        nextTitle: project.scenes[sceneIndex + 1]?.title,
        instruction,
        beatCount,
        onFallback: (model) =>
          store.pushToast("info", `선택한 모델 대신 ${model} 모델로 자동 전환했습니다.`),
      });
      setResult(response.rewrite);
      store.pushToast("success", "재작성안을 만들었습니다. 적용 전에 변경 내용을 확인해 주세요.");
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "장면 재작성 중 문제가 발생했습니다.";
      setError(message);
      store.pushToast("error", message);
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!result) return;
    setApplying(true);
    try {
      await onApply(result, withAudio);
      onClose();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "재작성안을 적용하지 못했습니다.";
      setError(message);
      store.pushToast("error", message);
    } finally {
      setApplying(false);
    }
  };

  const beatRows = result
    ? Array.from({ length: Math.max(scene.beats.length, result.beats.length) })
    : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      title="AI로 장면 다시 쓰기"
      subtitle={`${sceneIndex + 1}번째 장면 · ${scene.title}`}
      icon={<Wand2 size={19} />}
      actions={
        <span className="budget-chip" title="이번 작업에서 예상되는 Gemini 호출 수">
          <Sparkles size={12} />
          {describeBudget(budget)}
        </span>
      }
    >
      <div className="rewrite-shell">
        <div className="rewrite-controls">
          <span className="small-label">어떻게 다듬을까요?</span>
          <div className="rewrite-presets">
            {REWRITE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`preset-chip ${presetId === preset.id ? "is-active" : ""}`}
                onClick={() => setPresetId(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            className="text-area"
            placeholder="추가 지시가 있다면 적어 주세요. 예: 중학생 눈높이로, 실제 실험 사례를 넣어서"
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
          />
          <div className="rewrite-options">
            <label className="field-label inline">
              비트 수
              <select
                className="text-input compact-select"
                value={beatCount}
                onChange={(event) => setBeatCount(Number(event.target.value))}
              >
                {[2, 3, 4].map((count) => (
                  <option key={count} value={count}>
                    {count}개
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={withAudio}
                onChange={(event) => setWithAudio(event.target.checked)}
              />
              음성도 함께 새로 만들기 (+1회 호출)
            </label>
            <button
              type="button"
              className="primary-button small"
              onClick={() => void generate()}
              disabled={loading || applying}
            >
              {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              {loading ? "재작성 중..." : result ? "다시 생성" : "재작성안 만들기"}
            </button>
          </div>
          {error && <p className="inline-note is-error">{error}</p>}
        </div>

        {result ? (
          <div className="rewrite-diff">
            <div className="rewrite-diff-head">
              <span>현재 장면</span>
              <span>AI 재작성안</span>
            </div>
            <div className={`diff-row ${changed(scene.title, result.title) ? "is-changed" : ""}`}>
              <div>
                <small>제목</small>
                <strong>{scene.title}</strong>
              </div>
              <div>
                <small>제목</small>
                <strong>{result.title}</strong>
              </div>
            </div>
            <div
              className={`diff-row ${changed(scene.subtitle, result.subtitle) ? "is-changed" : ""}`}
            >
              <div>
                <small>요약</small>
                <p>{scene.subtitle}</p>
              </div>
              <div>
                <small>요약</small>
                <p>{result.subtitle}</p>
              </div>
            </div>
            {beatRows.map((_, index) => {
              const before = scene.beats[index];
              const after = result.beats[index];
              const rowChanged =
                !before ||
                !after ||
                changed(before.label, after.label) ||
                changed(before.desc, after.desc) ||
                changed(before.narration, after.narration);
              return (
                <div className={`diff-row beat ${rowChanged ? "is-changed" : ""}`} key={index}>
                  <div>
                    <small>비트 {index + 1}</small>
                    {before ? (
                      <>
                        <strong>{before.label}</strong>
                        <span>{before.desc}</span>
                        <p>“{before.narration}”</p>
                      </>
                    ) : (
                      <span className="diff-empty">없음</span>
                    )}
                  </div>
                  <div>
                    <small>비트 {index + 1}</small>
                    {after ? (
                      <>
                        <strong>{after.label}</strong>
                        <span>{after.desc}</span>
                        <p>“{after.narration}”</p>
                      </>
                    ) : (
                      <span className="diff-empty">없음</span>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="rewrite-apply">
              <button type="button" className="mini-button" onClick={onClose} disabled={applying}>
                취소
              </button>
              <button
                type="button"
                className="primary-button small"
                onClick={() => void apply()}
                disabled={applying}
              >
                {applying ? (
                  <Loader2 size={14} className="spin" />
                ) : withAudio ? (
                  <Volume2 size={14} />
                ) : (
                  <Check size={14} />
                )}
                {applying
                  ? withAudio
                    ? "적용하고 음성을 만드는 중..."
                    : "적용 중..."
                  : withAudio
                    ? "적용하고 음성 생성"
                    : "이 재작성안 적용"}
              </button>
            </div>
            {!withAudio && scene.audioSource !== "none" && (
              <p className="editor-note">
                음성을 함께 만들지 않으면 기존 음성은 '업데이트 필요' 상태가 됩니다.
              </p>
            )}
          </div>
        ) : (
          <div className="rewrite-empty">
            <RotateCcw size={22} />
            <p>지시를 고르고 재작성안을 만들면 현재 장면과 나란히 비교할 수 있습니다.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
