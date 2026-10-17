import { useEffect, useState } from "react";
import { Download, Image, Loader2, Sparkles } from "lucide-react";
import type { Project } from "../types/project";
import { Modal } from "./Modal";
import { buildMaterials, type MaterialImage } from "../lib/export/materials";
import { downloadBlob } from "../lib/export/image";
import { useStudioStore } from "../store/studioStore";

interface MaterialsModalProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
}

export function MaterialsModal({ open, project, onClose }: MaterialsModalProps) {
  const store = useStudioStore();
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
            error instanceof Error ? error.message : "자료 이미지를 만들지 못했습니다.",
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
      title="썸네일 & 카드뉴스"
      subtitle="유튜브용 16:9 썸네일과 SNS 배포용 1:1 카드뉴스를 만듭니다."
      icon={<Image size={19} />}
      actions={
        <button type="button" className="primary-button small" onClick={downloadAll} disabled={loading || !thumbnail}>
          <Download size={14} />
          전체 다운로드
        </button>
      }
    >
      {loading ? (
        <div className="materials-loading">
          <Loader2 size={26} className="spin" />
          <strong>이미지를 그리는 중...</strong>
          <p>현재 테마와 스토리보드를 캔버스에 렌더링합니다.</p>
        </div>
      ) : (
        <div className="materials-shell">
          {thumbnail && (
            <section className="material-section">
              <div className="material-heading">
                <span className="panel-label">
                  <Sparkles size={14} />
                  16:9 유튜브 썸네일
                </span>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => downloadBlob(thumbnail.blob, "panseolab_thumbnail.png")}
                >
                  <Download size={13} />
                  PNG 저장
                </button>
              </div>
              <img src={thumbnail.dataUrl} alt="프로젝트 썸네일 미리보기" className="material-thumbnail" />
            </section>
          )}

          <section className="material-section">
            <div className="material-heading">
              <span className="panel-label">1:1 카드뉴스 {cards.length}장</span>
              <span className="panel-hint">장면별 핵심 포인트를 한 장에 담았습니다</span>
            </div>
            <div className="card-grid">
              {cards.map((card, index) => (
                <article className="card-preview" key={card.id}>
                  <img src={card.dataUrl} alt={`${index + 1}번째 카드뉴스`} />
                  <div className="card-preview-meta">
                    <span>카드 {index + 1}</span>
                    <button
                      type="button"
                      className="mini-button"
                      onClick={() => downloadBlob(card.blob, `panseolab_card_${index + 1}.png`)}
                    >
                      <Download size={12} />
                      저장
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
