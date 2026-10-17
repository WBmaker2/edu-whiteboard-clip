import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useStudioStore } from "../store/studioStore";

export function Toasts() {
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
          <button type="button" onClick={() => dismiss(toast.id)} aria-label="알림 닫기">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
