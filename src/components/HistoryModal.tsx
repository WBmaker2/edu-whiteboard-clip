import { useEffect, useState } from "react";
import { Clock3, Database, History, Loader2, RotateCcw, Trash2 } from "lucide-react";
import type { DraftSnapshot } from "../types/project";
import { useStudioStore } from "../store/studioStore";
import {
  deleteSnapshot,
  estimateStorage,
  listSnapshots,
  restoreSnapshot,
} from "../lib/storage";
import { Modal } from "./Modal";

interface HistoryModalProps {
  open: boolean;
  onClose: () => void;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function HistoryModal({ open, onClose }: HistoryModalProps) {
  const store = useStudioStore();
  const [snapshots, setSnapshots] = useState<DraftSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void Promise.all([listSnapshots(), estimateStorage()])
      .then(([items, estimate]) => {
        setSnapshots(items);
        setStorage(estimate);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const restore = async (id: string) => {
    setRestoring(id);
    try {
      const project = await restoreSnapshot(id);
      if (!project) {
        store.pushToast("error", "저장 기록을 찾지 못했습니다.");
        return;
      }
      store.loadProject(project);
      store.pushToast("success", "저장 기록을 복원했습니다.");
      onClose();
    } catch (error) {
      store.pushToast(
        "error",
        error instanceof Error ? `복원에 실패했습니다: ${error.message}` : "복원에 실패했습니다.",
      );
    } finally {
      setRestoring(null);
    }
  };

  const remove = async (id: string) => {
    const next = await deleteSnapshot(id);
    setSnapshots(next);
    store.pushToast("info", "저장 기록을 삭제했습니다.");
  };

  const usagePercent =
    storage && storage.quota > 0
      ? Math.min(100, Math.round((storage.usage / storage.quota) * 100))
      : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="저장 기록"
      subtitle="자동 저장본과 수동 스냅샷을 복원할 수 있습니다."
      icon={<History size={19} />}
      actions={
        <span className="budget-chip" title="브라우저 저장 공간 사용량">
          <Database size={12} />
          {usagePercent !== null
            ? `저장 공간 ${usagePercent}% 사용`
            : "브라우저에 저장됨"}
        </span>
      }
    >
      <div className="history-shell">
        {loading ? (
          <div className="history-empty">
            <Loader2 size={22} className="spin" />
            <p>저장 기록을 불러오는 중...</p>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="history-empty">
            <Clock3 size={22} />
            <p>아직 저장 기록이 없습니다. 편집하면 자동 저장되고, 중요한 지점은 스냅샷으로 남길 수 있습니다.</p>
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
                    {relativeTime(snapshot.savedAt)} · {snapshot.sceneCount}씬
                    {snapshot.includesAudio ? " · 오디오 포함" : " · 오디오 제외"}
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
                  복원
                </button>
                <button
                  type="button"
                  className="icon-button tiny is-danger"
                  onClick={() => void remove(snapshot.id)}
                  aria-label="저장 기록 삭제"
                >
                  <Trash2 size={13} />
                </button>
              </article>
            ))}
          </div>
        )}
        <p className="editor-note">
          자동 저장은 편집 후 약 1.5초 뒤에 이루어지며, 중요한 변경 전에는 오디오 포함 스냅샷이 만들어집니다.
        </p>
      </div>
    </Modal>
  );
}
