import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ChevronDown,
  FolderOpen,
  HelpCircle,
  LayoutGrid,
  MonitorPlay,
  PenLine,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from "lucide-react";
import type { Project } from "../types/project";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useI18n } from "../lib/i18n";

export type StudioTab = "settings" | "monitor";

interface HeaderTabsProps {
  tab: StudioTab;
  onTab: (tab: StudioTab) => void;
  project: Project | null;
  onNewProject: () => void;
  onLoadDraft: () => void;
  onImportProject: () => void;
  onShowShortcuts: () => void;
}

export function HeaderTabs({
  tab,
  onTab,
  project,
  onNewProject,
  onLoadDraft,
  onImportProject,
  onShowShortcuts,
}: HeaderTabsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const isOnline = useOnlineStatus();
  const { t } = useI18n();

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const closeMenu = (focusButton = false) => {
    setMenuOpen(false);
    if (focusButton) menuButtonRef.current?.focus();
  };

  const openMenuWithFocus = () => {
    setMenuOpen(true);
    window.requestAnimationFrame(() => itemRefs.current[0]?.focus());
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current.filter(
      (item): item is HTMLButtonElement => Boolean(item),
    );
    if (items.length === 0) return;
    const currentIndex = items.findIndex((item) => item === document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(currentIndex + 1 + items.length) % items.length]?.focus();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]?.focus();
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
      return;
    }
    if (event.key === "Tab") {
      setMenuOpen(false);
    }
  };

  return (
    <header className="site-header">
      <div className="header-top">
        <div className="brand">
          <span className="brand-mark">
            <PenLine size={22} strokeWidth={2.2} />
          </span>
          <span className="brand-text">
            <strong>{t("app.brand")}</strong>
            <span className="brand-badge">{t("app.badge")}</span>
          </span>
        </div>

        <div className="header-actions">
          <span className="chip chip-soft">
            <Sparkles size={13} />
            {t("header.aiChip")}
          </span>
          <span className="chip chip-muted hide-sm">
            <ShieldCheck size={13} />
            {t("header.localChip")}
          </span>
          {!isOnline && (
            <span className="chip chip-warn" role="status">
              <WifiOff size={13} />
              {t("header.offlineChip")}
            </span>
          )}

          <div className="project-menu" ref={menuRef}>
            <button
              ref={menuButtonRef}
              type="button"
              className="ghost-button"
              onClick={() => setMenuOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  openMenuWithFocus();
                }
                if (event.key === "Escape" && menuOpen) {
                  event.preventDefault();
                  closeMenu();
                }
              }}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <FolderOpen size={16} />
              <span>{t("header.project")}</span>
              <ChevronDown size={14} />
            </button>
            {menuOpen && (
              <div className="project-dropdown" role="menu" onKeyDown={onMenuKeyDown}>
                <button
                  ref={(element) => {
                    itemRefs.current[0] = element;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => {
                    setMenuOpen(false);
                    onNewProject();
                  }}
                >
                  <Sparkles size={15} />
                  <span>
                    <strong>{t("header.newProject")}</strong>
                    <small>{t("header.newProjectDesc")}</small>
                  </span>
                </button>
                <button
                  ref={(element) => {
                    itemRefs.current[1] = element;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => {
                    setMenuOpen(false);
                    onLoadDraft();
                  }}
                >
                  <FolderOpen size={15} />
                  <span>
                    <strong>{t("header.loadDraft")}</strong>
                    <small>{t("header.loadDraftDesc")}</small>
                  </span>
                </button>
                <button
                  ref={(element) => {
                    itemRefs.current[2] = element;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => {
                    setMenuOpen(false);
                    onImportProject();
                  }}
                >
                  <LayoutGrid size={15} />
                  <span>
                    <strong>{t("header.importJson")}</strong>
                    <small>{t("header.importJsonDesc")}</small>
                  </span>
                </button>
              </div>
            )}
          </div>

          <button type="button" className="icon-button hide-sm" onClick={onShowShortcuts} aria-label={t("header.help")}>
            <HelpCircle size={17} />
          </button>
        </div>
      </div>

      <div className="tab-bar" role="tablist" aria-label={t("header.tabList")}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "settings"}
          className={`tab-button ${tab === "settings" ? "is-active" : ""}`}
          onClick={() => onTab("settings")}
        >
          <LayoutGrid size={16} />
          {t("header.tabSettings")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "monitor"}
          className={`tab-button ${tab === "monitor" ? "is-active" : ""}`}
          onClick={() => onTab("monitor")}
        >
          <MonitorPlay size={16} />
          {t("header.tabMonitor")}
          {project && <span className="tab-count">{project.scenes.length}</span>}
        </button>
      </div>
    </header>
  );
}
