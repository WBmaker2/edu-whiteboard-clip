import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      icon={<AlertTriangle size={19} />}
    >
      <div className="confirm-shell">
        <p>{message}</p>
        <div className="confirm-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`primary-button small ${danger ? "is-danger" : ""}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
