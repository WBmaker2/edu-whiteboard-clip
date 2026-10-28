import { AlertTriangle, Check, Copy, Mic, PencilLine, Sparkles, Volume2, X } from "lucide-react";
import type { Scene } from "../../types/project";
import { useI18n } from "../../lib/i18n";

interface SceneHeaderProps {
  scene: Scene;
  index: number;
  isActive: boolean;
  isEditing: boolean;
  isStale: boolean;
  audioBadge: { label: string; tone: string };
  onSelect: () => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDuplicate: () => void;
  onRecord: () => void;
  onRegenerate: () => void;
  onRewrite: () => void;
  onDelete: () => void;
  canRegenerate: boolean;
  regenerating: boolean;
  recorderState: string;
}

export function SceneHeader({
  scene,
  index,
  isActive,
  isEditing,
  isStale,
  audioBadge,
  onSelect,
  onEdit,
  onSave,
  onCancel,
  onDuplicate,
  onRecord,
  onRegenerate,
  onRewrite,
  onDelete,
  canRegenerate,
  regenerating,
  recorderState,
}: SceneHeaderProps) {
  const { t } = useI18n();
  return (
    <div className="storyboard-scene-header" onClick={onSelect}>
      <div className="storyboard-scene-title-row">
        <span className="storyboard-scene-index">{index + 1}</span>
        {isEditing ? (
          <input
            className="storyboard-edit-input"
            value={scene.title}
            onChange={() => {}}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="storyboard-scene-title-group">
            <span className="storyboard-scene-title">{scene.title}</span>
            {isStale && (
              <span className="storyboard-stale-badge">
                <AlertTriangle size={12} />
                {t("storyboard.audioStale")}
              </span>
            )}
            <span className={`storyboard-audio-badge ${audioBadge.tone}`}>
              {audioBadge.label}
            </span>
          </div>
        )}
        <div className="storyboard-scene-actions" onClick={(e) => e.stopPropagation()}>
          {isEditing ? (
            <>
              <button className="storyboard-icon-btn" onClick={onSave} title={t("common.save")}>
                <Check size={16} />
              </button>
              <button className="storyboard-icon-btn" onClick={onCancel} title={t("common.cancel")}>
                <X size={16} />
              </button>
            </>
          ) : (
            <>
              <button className="storyboard-icon-btn" onClick={onEdit} title={t("storyboard.edit")}>
                <PencilLine size={16} />
              </button>
              <button className="storyboard-icon-btn" onClick={onDuplicate} title={t("storyboard.duplicate")}>
                <Copy size={16} />
              </button>
              <button
                className="storyboard-icon-btn"
                onClick={onRecord}
                title={recorderState === "recording" ? t("storyboard.stopRecord") : t("storyboard.record")}
              >
                <Mic size={16} />
              </button>
              <button
                className="storyboard-icon-btn"
                onClick={onRegenerate}
                disabled={!canRegenerate || regenerating}
                title={t("storyboard.regenAudio")}
              >
                {regenerating ? <span className="spinner-dot" /> : <Volume2 size={16} />}
              </button>
              <button className="storyboard-icon-btn" onClick={onRewrite} title={t("storyboard.rewrite")}>
                <Sparkles size={16} />
              </button>
              <button className="storyboard-icon-btn danger" onClick={onDelete} title={t("storyboard.delete")}>
                <X size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
