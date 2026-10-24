import { Copy, Link2 } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../lib/i18n";
import { Modal } from "./Modal";

interface CopyLinkDialogProps {
  open: boolean;
  url: string;
  onClose: () => void;
}

export function CopyLinkDialog({ open, url, onClose }: CopyLinkDialogProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("share.copyTitle")}
      icon={<Link2 size={19} />}
    >
      <div className="copy-link-shell">
        <p>{t("share.copyPrompt")}</p>
        <input
          readOnly
          value={url}
          aria-label={t("share.copyTitle")}
          onFocus={(event) => event.currentTarget.select()}
        />
        <div className="confirm-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t("common.close")}
          </button>
          <button type="button" className="primary-button small" onClick={() => void copy()}>
            <Copy size={14} />
            {copied ? t("share.copiedShort") : t("share.copy")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
