import { CheckCircle2, Clapperboard, Download, Loader2 } from "lucide-react";
import { Modal } from "./Modal";
import { useStudioStore } from "../store/studioStore";
import { useI18n } from "../lib/i18n";

interface VideoExportModalProps {
  open: boolean;
  progress: number;
  message: string;
  result: { url: string; filename: string; size: number } | null;
  error: string;
  converting: boolean;
  canConvert: boolean;
  onConvert: () => void;
  onCancel: () => void;
  onClose: () => void;
}

export function VideoExportModal({
  open,
  progress,
  message,
  result,
  error,
  converting,
  canConvert,
  onConvert,
  onCancel,
  onClose,
}: VideoExportModalProps) {
  const { t } = useI18n();
  const exportFormat = useStudioStore((state) => state.exportFormat);
  const formatLabel = exportFormat === "mp4" ? "MP4 (H.264/AAC)" : "WebM (VP9/Opus)";
  const inProgress = !result && !error;

  return (
    <Modal
      open={open}
      title={t("export.title")}
      subtitle={`${formatLabel} · ${
        exportFormat === "mp4"
          ? t("export.subtitleMp4")
          : t("export.subtitleWebm")
      }`}
      icon={<Clapperboard size={19} />}
      onClose={inProgress ? onCancel : onClose}
    >
      {result ? (
        converting ? (
          <div className="export-progress">
            <div className="export-spinner">
              <Loader2 size={30} className="spin" />
              <strong>{progress}%</strong>
            </div>
            <p>{message}</p>
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
            <small>{t("export.convertingNote")}</small>
            <button type="button" className="secondary-button" onClick={onCancel}>
              {t("export.cancelConvert")}
            </button>
          </div>
        ) : (
        <div className="export-success">
          <CheckCircle2 size={40} />
          <h3>{t("export.ready")}</h3>
          <p>{message}</p>
          <div className="export-actions">
            <a className="primary-button" href={result.url} download={result.filename}>
              <Download size={15} />
              {t("export.downloadAgain")}
            </a>
            {canConvert && /\.webm$/i.test(result.filename) && (
              <button type="button" className="secondary-button" onClick={onConvert}>
                {t("export.convertToMp4")}
              </button>
            )}
            <button type="button" className="secondary-button" onClick={onClose}>
              {t("export.close")}
            </button>
          </div>
          <small>
            {(result.size / 1024 / 1024).toFixed(1)} MB · {result.filename}
            {canConvert && /\.webm$/i.test(result.filename)
              ? t("export.webmFallbackNote")
              : ""}
          </small>
        </div>
        )
      ) : error ? (
        <div className="export-error">
          <strong>{t("export.failed")}</strong>
          <p>{error}</p>
          <button type="button" className="secondary-button" onClick={onClose}>
            {t("export.close")}
          </button>
        </div>
      ) : (
        <div className="export-progress">
          <div className="export-spinner">
            <Loader2 size={30} className="spin" />
            <strong>{progress}%</strong>
          </div>
          <p>{message}</p>
          <div className="progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
          <small>
            {exportFormat === "mp4"
              ? t("export.mp4Hint")
              : t("export.webmHint")}
          </small>
          <button type="button" className="secondary-button" onClick={onCancel}>
            {t("export.cancel")}
          </button>
        </div>
      )}
    </Modal>
  );
}
