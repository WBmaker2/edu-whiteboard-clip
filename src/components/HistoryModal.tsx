import { useEffect, useState } from "react";
import { Clock3, Database, History, Loader2, RotateCcw, Trash2 } from "lucide-react";
import type { DraftSnapshot } from "../types/project";
import { useShallow } from "zustand/react/shallow";
import { useStudioStore } from "../store/studioStore";
import {
  deleteSnapshot,
  estimateStorage,
  listSnapshots,
  restoreSnapshot,
} from "../lib/storage";
import { Modal } from "./Modal";
import { useI18n } from "../lib/i18n";

interface HistoryModalProps {
  open: boolean;
  projectId?: string;
  onClose: () => void;
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

export function HistoryModal({ open, projectId, onClose }: HistoryModalProps) {
  const { t, te } = useI18n();
  const store = useStudioStore(
    useShallow((state) => ({
      loadProject: state.loadProject,
      pushToast: state.pushToast,
    })),
  );
  const [snapshots, setSnapshots] = useState<DraftSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void Promise.all([listSnapshots(projectId), estimateStorage()])
      .then(([items, estimate]) => {
        setSnapshots(items);
        setStorage(estimate);
      })
      .finally(() => setLoading(false));
  }, [open, projectId]);

  const restore = async (id: string) => {
    setRestoring(id);
    try {
      const project = await restoreSnapshot(projectId, id);
      if (!project) {
        store.pushToast("error", t("history.notFound"));
        return;
      }
      store.loadProject(project);
      store.pushToast("success", t("history.restored"));
      onClose();
    } catch (error) {
      store.pushToast(
        "error",
        error instanceof Error
          ? t("history.restoreFailedReason", { message: te(error.message) })
          : t("history.restoreFailed"),
      );
    } finally {
      setRestoring(null);
    }
  };

  const remove = async (id: string) => {
    const next = await deleteSnapshot(projectId, id);
    setSnapshots(next);
    store.pushToast("info", t("history.deleted"));
  };

  const usagePercent =
    storage && storage.quota > 0
      ? Math.min(100, Math.round((storage.usage / storage.quota) * 100))
      : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("history.title")}
      subtitle={t("history.subtitle")}
      icon={<History size={19} />}
      actions={
        <span className="budget-chip" title={t("history.usageTitle")}>
          <Database size={12} />
          {usagePercent !== null
            ? t("history.usage", { percent: usagePercent })
            : t("history.savedInBrowser")}
        </span>
      }
    >
      <div className="history-shell">
        {loading ? (
          <div className="history-empty">
            <Loader2 size={22} className="spin" />
            <p>{t("history.loading")}</p>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="history-empty">
            <Clock3 size={22} />
            <p>{t("history.empty")}</p>
          </div>
        ) : (
          <div className="history-list">
            {snapshots.map((snapshot) => (
              <article className="history-item" key={snapshot.id}>
                <span className="history-icon">
                  <Clock3 size={15} />
                </span>
                <div className="history-meta">
                  <strong>{snapshot.label}</strong>
                  <small>
                    {relativeTime(snapshot.savedAt, t)} · {t("history.scenes", { count: snapshot.sceneCount })}
                    {snapshot.includesAudio ? ` · ${t("history.withAudio")}` : ` · ${t("history.withoutAudio")}`}
                  </small>
                </div>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => void restore(snapshot.id)}
                  disabled={restoring === snapshot.id}
                >
                  {restoring === snapshot.id ? (
                    <Loader2 size={12} className="spin" />
                  ) : (
                    <RotateCcw size={12} />
                  )}
                  {t("history.restore")}
                </button>
                <button
                  type="button"
                  className="icon-button tiny is-danger"
                  onClick={() => void remove(snapshot.id)}
                  aria-label={t("history.delete")}
                >
                  <Trash2 size={13} />
                </button>
              </article>
            ))}
          </div>
        )}
        <p className="editor-note">{t("history.note")}</p>
      </div>
    </Modal>
  );
}
