import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useStudioStore } from "../store/studioStore";
import { useI18n } from "../lib/i18n";

export function Toasts() {
  const { t } = useI18n();
  const toasts = useStudioStore((state) => state.toasts);
  const dismiss = useStudioStore((state) => state.dismissToast);

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.kind}`}>
          {toast.kind === "success" ? (
            <CheckCircle2 size={17} />
          ) : toast.kind === "error" ? (
            <AlertCircle size={17} />
          ) : (
            <Info size={17} />
          )}
          <span>{toast.message}</span>
          <button type="button" onClick={() => dismiss(toast.id)} aria-label={t("toast.dismiss")}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
