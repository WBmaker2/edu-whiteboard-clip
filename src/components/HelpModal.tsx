import { Keyboard } from "lucide-react";
import { Modal } from "./Modal";
import { useI18n } from "../lib/i18n";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: "Space", labelKey: "help.sc.space" },
  { keys: "← / →", labelKey: "help.sc.arrows" },
  { keys: "1 / 2 / 3", labelKey: "help.sc.steps" },
  { keys: "L", labelKey: "help.sc.laser" },
  { keys: "P", labelKey: "help.sc.pen" },
  { keys: "H", labelKey: "help.sc.highlighter" },
  { keys: "C", labelKey: "help.sc.clear" },
  { keys: "Esc", labelKey: "help.sc.exit" },
];

export function HelpModal({ open, onClose }: HelpModalProps) {
  const { t } = useI18n();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("help.title")}
      subtitle={t("help.subtitle")}
      icon={<Keyboard size={19} />}
    >
      <div className="help-grid">
        <section>
          <h3>{t("help.startTitle")}</h3>
          <ol>
            <li>{t("help.start1")}</li>
            <li>{t("help.start2")}</li>
            <li>{t("help.start3")}</li>
            <li>{t("help.start4")}</li>
          </ol>
        </section>
        <section>
          <h3>{t("help.shortcutsTitle")}</h3>
          <ul className="shortcut-list">
            {SHORTCUTS.map((item) => (
              <li key={item.keys}>
                <kbd>{item.keys}</kbd>
                <span>{t(item.labelKey)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="help-note">{t("help.note")}</div>
    </Modal>
  );
}
