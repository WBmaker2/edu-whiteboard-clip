import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
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
import { useI18n } from "../lib/i18n";

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

const PRESET_LABEL_KEYS: Record<string, string> = {
  easier: "rewrite.presetEasier",
  shorter: "rewrite.presetShorter",
  example: "rewrite.presetExample",
  visual: "rewrite.presetVisual",
  misconception: "rewrite.presetMisconception",
};

export function RewriteSceneModal({
  open,
  project,
  sceneIndex,
  onClose,
  onApply,
}: RewriteSceneModalProps) {
  const { t } = useI18n();
  const store = useStudioStore(
    useShallow((state) => ({
      apiKey: state.apiKey,
      model: state.model,
      gradeLevel: state.gradeLevel,
      subject: state.subject,
      standards: state.standards,
      pushToast: state.pushToast,
    })),
  );
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
      store.pushToast("error", t("rewrite.needKey"));
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
        curriculum: {
          grade: store.gradeLevel,
          subject: store.subject,
          standards: store.standards,
        },
        onFallback: (model) =>
          store.pushToast("info", t("rewrite.fallbackModel", { model })),
      });
      setResult(response.rewrite);
      store.pushToast("success", t("rewrite.generated"));
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : t("rewrite.generateFailed");
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
        caught instanceof Error ? caught.message : t("rewrite.applyFailed");
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
      title={t("rewrite.title")}
      subtitle={t("rewrite.subtitle", { scene: sceneIndex + 1, title: scene.title })}
      icon={<Wand2 size={19} />}
      actions={
        <span className="budget-chip" title={t("rewrite.budgetTitle")}>
          <Sparkles size={12} />
          {describeBudget(budget, t)}
        </span>
      }
    >
      <div className="rewrite-shell">
        <div className="rewrite-controls">
          <span className="small-label">{t("rewrite.instructionsLabel")}</span>
          <div className="rewrite-presets">
            {REWRITE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`preset-chip ${presetId === preset.id ? "is-active" : ""}`}
                onClick={() => setPresetId(preset.id)}
              >
                {t(PRESET_LABEL_KEYS[preset.id] ?? preset.label)}
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            className="text-area"
            placeholder={t("rewrite.customPlaceholder")}
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
          />
          <div className="rewrite-options">
            <label className="field-label inline">
              {t("rewrite.beatCount")}
              <select
                className="text-input compact-select"
                value={beatCount}
                onChange={(event) => setBeatCount(Number(event.target.value))}
              >
                {[2, 3, 4].map((count) => (
                  <option key={count} value={count}>
                    {t("rewrite.beatCountOption", { count })}
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
              {t("rewrite.withAudio")}
            </label>
            <button
              type="button"
              className="primary-button small"
              onClick={() => void generate()}
              disabled={loading || applying}
            >
              {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              {loading ? t("rewrite.generating") : result ? t("rewrite.regenerate") : t("rewrite.generate")}
            </button>
          </div>
          {error && <p className="inline-note is-error">{error}</p>}
        </div>

        {result ? (
          <div className="rewrite-diff">
            <div className="rewrite-diff-head">
              <span>{t("rewrite.currentScene")}</span>
              <span>{t("rewrite.aiRewrite")}</span>
            </div>
            <div className={`diff-row ${changed(scene.title, result.title) ? "is-changed" : ""}`}>
              <div>
                <small>{t("rewrite.titleLabel")}</small>
                <strong>{scene.title}</strong>
              </div>
              <div>
                <small>{t("rewrite.titleLabel")}</small>
                <strong>{result.title}</strong>
              </div>
            </div>
            <div
              className={`diff-row ${changed(scene.subtitle, result.subtitle) ? "is-changed" : ""}`}
            >
              <div>
                <small>{t("rewrite.summaryLabel")}</small>
                <p>{scene.subtitle}</p>
              </div>
              <div>
                <small>{t("rewrite.summaryLabel")}</small>
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
                    <small>{t("rewrite.beat", { beat: index + 1 })}</small>
                    {before ? (
                      <>
                        <strong>{before.label}</strong>
                        <span>{before.desc}</span>
                        <p>“{before.narration}”</p>
                      </>
                    ) : (
                      <span className="diff-empty">{t("rewrite.empty")}</span>
                    )}
                  </div>
                  <div>
                    <small>{t("rewrite.beat", { beat: index + 1 })}</small>
                    {after ? (
                      <>
                        <strong>{after.label}</strong>
                        <span>{after.desc}</span>
                        <p>“{after.narration}”</p>
                      </>
                    ) : (
                      <span className="diff-empty">{t("rewrite.empty")}</span>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="rewrite-apply">
              <button type="button" className="mini-button" onClick={onClose} disabled={applying}>
                {t("rewrite.cancel")}
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
                    ? t("rewrite.applyingWithAudio")
                    : t("rewrite.applying")
                  : withAudio
                    ? t("rewrite.applyWithAudio")
                    : t("rewrite.apply")}
              </button>
            </div>
            {!withAudio && scene.audioSource !== "none" && (
              <p className="editor-note">
                {t("rewrite.audioNote")}
              </p>
            )}
          </div>
        ) : (
          <div className="rewrite-empty">
            <RotateCcw size={22} />
            <p>{t("rewrite.emptyState")}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
