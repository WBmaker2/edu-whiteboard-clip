import { AlertTriangle, Download, RotateCcw } from "lucide-react";
import { useI18n } from "../lib/i18n";

interface CrashScreenProps {
  error: Error;
  downloading: boolean;
  draftMessage: string;
  onReload: () => void;
  onDownloadDraft: () => void;
}

export function CrashScreen({
  error,
  downloading,
  draftMessage,
  onReload,
  onDownloadDraft,
}: CrashScreenProps) {
  const { t } = useI18n();
  return (
    <div className="crash-screen" role="alert">
      <div className="crash-card">
        <span className="crash-icon">
          <AlertTriangle size={26} />
        </span>
        <h1>{t("crash.title")}</h1>
        <p>{t("crash.body")}</p>
        <div className="crash-actions">
          <button type="button" className="primary-button btn-pulse" onClick={onReload}>
            <RotateCcw size={16} />
            {t("crash.reload")}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={onDownloadDraft}
            disabled={downloading}
          >
            <Download size={16} />
            {downloading ? t("crash.downloading") : t("crash.downloadDraft")}
          </button>
        </div>
        {draftMessage && <p className="crash-note">{draftMessage}</p>}
        <details className="crash-details">
          <summary>{t("crash.details")}</summary>
          <pre>{error.message}</pre>
        </details>
      </div>
    </div>
  );
}
