import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Check,
  Clock3,
  Copy,
  Database,
  Download,
  FolderOpen,
  Loader2,
  PencilLine,
  Plus,
  Search,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { Project, ProjectSummary } from "../types/project";
import { THEMES } from "../data/presets";
import { backupLibrary, restoreLibrary } from "../lib/backup";
import { downloadProject } from "../lib/export/project";
import { useI18n } from "../lib/i18n";
import { localLabel } from "../lib/labels";
import {
  deleteProject,
  duplicateProject,
  estimateStorage,
  listProjects,
  loadProjectById,
  renameProject,
} from "../lib/storage";
import { useStudioStore } from "../store/studioStore";
import { Modal } from "./Modal";

interface LibraryModalProps {
  open: boolean;
  currentId?: string;
  onClose: () => void;
  onOpen: (project: Project) => Promise<void> | void;
  onNewProject: () => void;
  onDeletedCurrent: () => void;
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

function relativeTime(iso: string, t: Translate): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t("history.justNow");
  if (minutes < 60) return t("history.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("history.hoursAgo", { count: hours });
  return t("history.daysAgo", { count: Math.floor(hours / 24) });
}

function formatDuration(seconds: number, t: Translate): string {
  const safe = Math.max(0, Math.round(seconds));
  return t("library.duration", {
    minutes: Math.floor(safe / 60),
    seconds: String(safe % 60).padStart(2, "0"),
  });
}

export function LibraryModal({
  open,
  currentId,
  onClose,
  onOpen,
  onNewProject,
  onDeletedCurrent,
}: LibraryModalProps) {
  const { t, te, language } = useI18n();
  const pushToast = useStudioStore((state) => state.pushToast);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreText, setRestoreText] = useState<string | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setRenamingId(null);
    setPendingDelete(null);
    void Promise.all([listProjects(), estimateStorage()])
      .then(([items, estimate]) => {
        setProjects(items);
        setStorage(estimate);
      })
      .catch((error) => {
        pushToast(
          "error",
          error instanceof Error ? te(error.message) : t("library.notFound"),
        );
      })
      .finally(() => setLoading(false));
  }, [open, pushToast, t, te]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter(
      (item) =>
        item.title.toLowerCase().includes(needle) ||
        item.topic.toLowerCase().includes(needle),
    );
  }, [projects, query]);

  const refresh = async () => {
    const [items, estimate] = await Promise.all([listProjects(), estimateStorage()]);
    setProjects(items);
    setStorage(estimate);
  };

  const handleOpen = async (id: string) => {
    setBusyId(id);
    try {
      const project = await loadProjectById(id);
      if (!project) {
        pushToast("error", t("library.notFound"));
        return;
      }
      await onOpen(project);
      pushToast("success", t("library.opened"));
      onClose();
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? te(error.message) : t("library.notFound"),
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    setBusyId(id);
    try {
      const created = await duplicateProject(id, t("library.copySuffix"));
      if (!created) {
        pushToast("error", t("library.notFound"));
        return;
      }
      await refresh();
      pushToast("success", t("library.duplicated"));
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? te(error.message) : t("library.duplicated"),
      );
    } finally {
      setBusyId(null);
    }
  };

  const startRename = (item: ProjectSummary) => {
    setPendingDelete(null);
    setRenamingId(item.id);
    setRenameValue(item.title);
  };

  const finishRename = async () => {
    if (!renamingId) return;
    const id = renamingId;
    setBusyId(id);
    try {
      const saved = await renameProject(id, renameValue);
      if (!saved) {
        pushToast("error", t("library.notFound"));
        return;
      }
      await refresh();
      setRenamingId(null);
      pushToast("success", t("library.renamed"));
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? te(error.message) : t("library.renamed"),
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteProject(id);
      if (id === currentId) onDeletedCurrent();
      setPendingDelete(null);
      await refresh();
      pushToast("info", t("library.deleted"));
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? te(error.message) : t("library.deleted"),
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = async (id: string) => {
    setBusyId(id);
    try {
      const project = await loadProjectById(id);
      if (!project) {
        pushToast("error", t("library.notFound"));
        return;
      }
      await downloadProject(project);
      pushToast("success", t("library.exported"));
    } catch (error) {
      pushToast(
        "error",
        error instanceof Error ? te(error.message) : t("library.exportFailed"),
      );
    } finally {
      setBusyId(null);
    }
  };

  const translateError = (error: unknown): string =>
    error instanceof Error ? te(error.message) : t("library.backupFailed");

  const handleBackup = async () => {
    setBackupBusy(true);
    try {
      const result = await backupLibrary(includeMedia);
      pushToast(
        "success",
        t("library.backupDone", {
          count: result.count,
          size: Math.max(1, Math.round(result.bytes / 1024)),
        }),
      );
    } catch (error) {
      pushToast("error", translateError(error));
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRestoreFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setRestoreText(await file.text());
  };

  const confirmRestore = async () => {
    if (restoreText === null) return;
    setBackupBusy(true);
    try {
      const result = await restoreLibrary(restoreText);
      setRestoreText(null);
      await refresh();
      pushToast("success", t("library.restoreDone", { count: result.count }));
    } catch (error) {
      pushToast("error", translateError(error));
    } finally {
      setBackupBusy(false);
    }
  };

  const usagePercent =
    storage && storage.quota > 0
      ? Math.min(100, Math.round((storage.usage / storage.quota) * 100))
      : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      title={t("library.title")}
      subtitle={t("library.subtitle")}
      icon={<FolderOpen size={19} />}
      actions={
        <span className="budget-chip" title={t("library.storageTitle")}>
          <Database size={12} />
          {usagePercent !== null
            ? t("library.storage", { percent: usagePercent })
            : t("library.storageUnknown")}
        </span>
      }
    >
      <div className="library-shell">
        <div className="library-toolbar">
          <label className="library-search">
            <Search size={14} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("library.searchPlaceholder")}
              aria-label={t("library.searchPlaceholder")}
            />
          </label>
          <button
            type="button"
            className="primary-button small btn-pulse"
            onClick={() => {
              onNewProject();
              onClose();
            }}
          >
            <Plus size={14} />
            {t("library.newProject")}
          </button>
        </div>

        {loading ? (
          <div className="history-empty">
            <Loader2 size={22} className="spin" />
            <p>{t("library.loading")}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="history-empty">
            <FolderOpen size={22} />
            <p>{projects.length === 0 ? t("library.empty") : t("library.searchPlaceholder")}</p>
            {projects.length === 0 && <small>{t("library.emptyHint")}</small>}
          </div>
        ) : (
          <div className="library-list">
            {filtered.map((item) => {
              const isCurrent = item.id === currentId;
              const busy = busyId === item.id;
              const theme = THEMES[item.themeId];
              return (
                <article
                  className={`library-card ${isCurrent ? "is-current" : ""}`}
                  key={item.id}
                >
                  <div className="library-card-head">
                    <span
                      className="library-theme-dot"
                      style={{ background: theme?.accent ?? "#2f5bea" }}
                      aria-hidden="true"
                    />
                    <div className="library-meta">
                      {renamingId === item.id ? (
                        <div className="library-rename">
                          <input
                            value={renameValue}
                            onChange={(event) => setRenameValue(event.target.value)}
                            placeholder={t("library.renamePlaceholder")}
                            aria-label={t("library.renamePlaceholder")}
                            autoFocus
                            onKeyDown={(event) => {
                              if (event.key === "Enter") void finishRename();
                              if (event.key === "Escape") setRenamingId(null);
                            }}
                          />
                          <button
                            type="button"
                            className="icon-button tiny"
                            onClick={() => void finishRename()}
                            aria-label={t("library.save")}
                            disabled={busy}
                          >
                            {busy ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
                          </button>
                          <button
                            type="button"
                            className="icon-button tiny"
                            onClick={() => setRenamingId(null)}
                            aria-label={t("library.cancel")}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <strong>
                          {item.title}
                          {isCurrent && <span className="library-current">{t("library.current")}</span>}
                        </strong>
                      )}
                      <small>
                        {relativeTime(item.updatedAt, t)} · {t("library.scenes", { count: item.sceneCount })}
                        {" · "}
                        {formatDuration(item.duration, t)}
                        {" · "}
                        {item.aspect === "9:16" ? "9:16" : "16:9"}
                        {" · "}
                        {localLabel(language, "theme", item.themeId, "name", theme?.name ?? item.themeId)}
                      </small>
                      <small className="library-topic">{item.topic}</small>
                    </div>
                    <span className={`library-audio ${item.hasAudio ? "has-audio" : ""}`}>
                      {item.hasAudio ? <Volume2 size={12} /> : <VolumeX size={12} />}
                      {item.hasAudio ? t("library.audio") : t("library.noAudio")}
                    </span>
                  </div>

                  {pendingDelete === item.id ? (
                    <div className="library-confirm" role="alert">
                      <span>{t("library.deleteConfirm")}</span>
                      <button
                        type="button"
                        className="mini-button is-danger"
                        onClick={() => void handleDelete(item.id)}
                        disabled={busy}
                      >
                        {busy ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
                        {t("library.delete")}
                      </button>
                      <button
                        type="button"
                        className="mini-button"
                        onClick={() => setPendingDelete(null)}
                      >
                        {t("library.deleteNo")}
                      </button>
                    </div>
                  ) : (
                    <div className="library-actions">
                      <button
                        type="button"
                        className="mini-button is-primary"
                        onClick={() => void handleOpen(item.id)}
                        disabled={busy || isCurrent}
                      >
                        {busy ? <Loader2 size={12} className="spin" /> : <FolderOpen size={12} />}
                        {t("library.open")}
                      </button>
                      <button
                        type="button"
                        className="mini-button"
                        onClick={() => startRename(item)}
                        disabled={busy}
                      >
                        <PencilLine size={12} />
                        {t("library.rename")}
                      </button>
                      <button
                        type="button"
                        className="mini-button"
                        onClick={() => void handleDuplicate(item.id)}
                        disabled={busy}
                      >
                        <Copy size={12} />
                        {t("library.duplicate")}
                      </button>
                      <button
                        type="button"
                        className="mini-button"
                        onClick={() => void handleExport(item.id)}
                        disabled={busy}
                      >
                        <Download size={12} />
                        {t("library.export")}
                      </button>
                      <button
                        type="button"
                        className="icon-button tiny is-danger"
                        onClick={() => setPendingDelete(item.id)}
                        disabled={busy}
                        aria-label={`${t("library.delete")}: ${item.title}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
        {restoreText !== null && (
          <div className="library-confirm" role="alert">
            <span>{t("library.restoreConfirm")}</span>
            <button
              type="button"
              className="mini-button is-primary"
              onClick={() => void confirmRestore()}
              disabled={backupBusy}
            >
              {backupBusy ? <Loader2 size={12} className="spin" /> : <Upload size={12} />}
              {t("library.restore")}
            </button>
            <button
              type="button"
              className="mini-button"
              onClick={() => setRestoreText(null)}
            >
              {t("library.deleteNo")}
            </button>
          </div>
        )}

        {usagePercent !== null && usagePercent >= 80 && (
          <div className="library-warning" role="status">
            {t("library.storageWarning")}
          </div>
        )}

        <div className="library-backup">
          <span className="library-backup-title">
            <Archive size={13} />
            {t("library.backupTitle")}
          </span>
          <label className="library-check">
            <input
              type="checkbox"
              checked={includeMedia}
              onChange={(event) => setIncludeMedia(event.target.checked)}
            />
            {t("library.includeMedia")}
          </label>
          <button
            type="button"
            className="mini-button"
            onClick={() => void handleBackup()}
            disabled={backupBusy || projects.length === 0}
          >
            {backupBusy ? <Loader2 size={12} className="spin" /> : <Archive size={12} />}
            {t("library.backup")}
          </button>
          <button
            type="button"
            className="mini-button"
            onClick={() => backupInputRef.current?.click()}
            disabled={backupBusy}
          >
            <Upload size={12} />
            {t("library.restore")}
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            data-testid="library-restore"
            onChange={(event) => void handleRestoreFile(event)}
          />
        </div>

        <p className="editor-note">
          <Clock3 size={12} />
          {storage && storage.quota > 0
            ? t("library.storage", { percent: usagePercent ?? 0 })
            : t("library.storageUnknown")}
        </p>
      </div>
    </Modal>
  );
}
