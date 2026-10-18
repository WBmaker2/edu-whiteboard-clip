import { useEffect, useState } from "react";
import { Download, Image, Loader2, Sparkles } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import type { Project } from "../types/project";
import { Modal } from "./Modal";
import { buildMaterials, type MaterialImage } from "../lib/export/materials";
import { downloadBlob } from "../lib/download";
import { useStudioStore } from "../store/studioStore";
import { useI18n } from "../lib/i18n";

interface MaterialsModalProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
}

export function MaterialsModal({ open, project, onClose }: MaterialsModalProps) {
  const { t } = useI18n();
  const store = useStudioStore(
    useShallow((state) => ({
      pushToast: state.pushToast,
    })),
  );
  const [loading, setLoading] = useState(false);
  const [thumbnail, setThumbnail] = useState<MaterialImage | null>(null);
  const [cards, setCards] = useState<MaterialImage[]>([]);

  useEffect(() => {
    if (!open || !project) return;
    let cancelled = false;
    setLoading(true);
    setThumbnail(null);
    setCards([]);
    void buildMaterials(project)
      .then((result) => {
        if (cancelled) return;
        setThumbnail(result.thumbnail);
        setCards(result.cards);
      })
      .catch((error) => {
        if (!cancelled) {
          store.pushToast(
            "error",
            error instanceof Error ? error.message : t("materials.buildFailed"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project]);

  const downloadAll = () => {
    if (thumbnail) downloadBlob(thumbnail.blob, "panseolab_thumbnail.png");
    cards.forEach((card, index) => {
      window.setTimeout(() => {
        downloadBlob(card.blob, `panseolab_card_${index + 1}.png`);
      }, 350 * (index + 1));
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      title={t("materials.title")}
      subtitle={t("materials.subtitle")}
      icon={<Image size={19} />}
      actions={
        <button type="button" className="primary-button small" onClick={downloadAll} disabled={loading || !thumbnail}>
          <Download size={14} />
          {t("materials.downloadAll")}
        </button>
      }
    >
      {loading ? (
        <div className="materials-loading">
          <Loader2 size={26} className="spin" />
          <strong>{t("materials.building")}</strong>
          <p>{t("materials.buildingDesc")}</p>
        </div>
      ) : (
        <div className="materials-shell">
          {thumbnail && (
            <section className="material-section">
              <div className="material-heading">
                <span className="panel-label">
                  <Sparkles size={14} />
                  {t("materials.youtubeThumb")}
                </span>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => downloadBlob(thumbnail.blob, "panseolab_thumbnail.png")}
                >
                  <Download size={13} />
                  {t("materials.savePng")}
                </button>
              </div>
              <img src={thumbnail.dataUrl} alt={t("materials.thumbAlt")} className="material-thumbnail" />
            </section>
          )}

          <section className="material-section">
            <div className="material-heading">
              <span className="panel-label">{t("materials.cardsTitle", { count: cards.length })}</span>
              <span className="panel-hint">{t("materials.cardsHint")}</span>
            </div>
            <div className="card-grid">
              {cards.map((card, index) => (
                <article className="card-preview" key={card.id}>
                  <img src={card.dataUrl} alt={t("materials.cardIndexAlt", { index: index + 1 })} />
                  <div className="card-preview-meta">
                    <span>{t("materials.card", { index: index + 1 })}</span>
                    <button
                      type="button"
                      className="mini-button"
                      onClick={() => downloadBlob(card.blob, `panseolab_card_${index + 1}.png`)}
                    >
                      <Download size={12} />
                      {t("materials.save")}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
