import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  FolderOpen,
  HelpCircle,
  LayoutGrid,
  MonitorPlay,
  PenLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Project } from "../types/project";
import { APP_NAME } from "../data/presets";

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

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menuOpen]);

  return (
    <header className="site-header">
      <div className="header-top">
        <div className="brand">
          <span className="brand-mark">
            <PenLine size={22} strokeWidth={2.2} />
          </span>
          <span className="brand-text">
            <strong>{APP_NAME}</strong>
            <span className="brand-badge">AI 스튜디오</span>
          </span>
        </div>

        <div className="header-actions">
          <span className="chip chip-soft">
            <Sparkles size={13} />
            AI 교육자료
          </span>
          <span className="chip chip-muted hide-sm">
            <ShieldCheck size={13} />
            브라우저에서만 처리
          </span>

          <div className="project-menu" ref={menuRef}>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
            >
              <FolderOpen size={16} />
              <span>프로젝트</span>
              <ChevronDown size={14} />
            </button>
            {menuOpen && (
              <div className="project-dropdown" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onNewProject();
                  }}
                >
                  <Sparkles size={15} />
                  <span>
                    <strong>새 프로젝트</strong>
                    <small>현재 작업을 비우고 새로 시작</small>
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onLoadDraft();
                  }}
                >
                  <FolderOpen size={15} />
                  <span>
                    <strong>초안 불러오기</strong>
                    <small>브라우저에 저장한 최근 작업</small>
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onImportProject();
                  }}
                >
                  <LayoutGrid size={15} />
                  <span>
                    <strong>JSON 가져오기</strong>
                    <small>프로젝트 파일 이어서 작업</small>
                  </span>
                </button>
              </div>
            )}
          </div>

          <button type="button" className="icon-button hide-sm" onClick={onShowShortcuts} aria-label="도움말">
            <HelpCircle size={17} />
          </button>
        </div>
      </div>

      <div className="tab-bar" role="tablist" aria-label="스튜디오 화면 전환">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "settings"}
          className={`tab-button ${tab === "settings" ? "is-active" : ""}`}
          onClick={() => onTab("settings")}
        >
          <LayoutGrid size={16} />
          스튜디오 설정
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "monitor"}
          className={`tab-button ${tab === "monitor" ? "is-active" : ""}`}
          onClick={() => onTab("monitor")}
        >
          <MonitorPlay size={16} />
          영상 모니터 &amp; 재생
          {project && <span className="tab-count">{project.scenes.length}</span>}
        </button>
      </div>
    </header>
  );
}
