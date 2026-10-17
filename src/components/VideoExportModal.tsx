import { createPortal } from "react-dom";
import { CheckCircle2, Clapperboard, Download, Loader2, X } from "lucide-react";
import { useStudioStore } from "../store/studioStore";

interface VideoExportModalProps {
  open: boolean;
  progress: number;
  message: string;
  result: { url: string; filename: string; size: number } | null;
  error: string;
  onCancel: () => void;
  onClose: () => void;
}

export function VideoExportModal({
  open,
  progress,
  message,
  result,
  error,
  onCancel,
  onClose,
}: VideoExportModalProps) {
  const exportFormat = useStudioStore((state) => state.exportFormat);
  if (!open) return null;
  const formatLabel = exportFormat === "mp4" ? "MP4 (H.264/AAC)" : "WebM (VP9/Opus)";
  return createPortal(
    <div className="modal-backdrop">
      <div className="modal-dialog export-dialog" role="dialog" aria-modal="true" aria-label="비디오 내보내기">
        <div className="modal-head">
          <div className="modal-title-group">
            <span className="modal-icon">
              <Clapperboard size={19} />
            </span>
            <div>
              <h2>비디오 내보내기</h2>
              <p>
                {formatLabel} ·{" "}
                {exportFormat === "mp4"
                  ? "오프라인으로 빠르게 인코딩합니다."
                  : "캔버스를 실시간으로 인코딩합니다. 탭을 닫지 말아 주세요."}
              </p>
            </div>
          </div>
          {!result && !error && (
            <button type="button" className="icon-button" onClick={onCancel} aria-label="내보내기 취소">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="modal-body">
          {result ? (
            <div className="export-success">
              <CheckCircle2 size={40} />
              <h3>영상 파일이 준비되었습니다</h3>
              <p>{message}</p>
              <div className="export-actions">
                <a className="primary-button" href={result.url} download={result.filename}>
                  <Download size={15} />
                  파일 다시 받기
                </a>
                <button type="button" className="secondary-button" onClick={onClose}>
                  닫기
                </button>
              </div>
              <small>{(result.size / 1024 / 1024).toFixed(1)} MB · {result.filename}</small>
            </div>
          ) : error ? (
            <div className="export-error">
              <strong>내보내기에 실패했습니다.</strong>
              <p>{error}</p>
              <button type="button" className="secondary-button" onClick={onClose}>
                닫기
              </button>
            </div>
          ) : (
            <div className="export-progress">
              <div className="export-spinner">
                <Loader2 size={30} className="spin" />
                <strong>{progress}%</strong>
              </div>
              <p>{message}</p>
              <div className="progress-track">
                <span style={{ width: `${progress}%` }} />
              </div>
              <small>
                {exportFormat === "mp4"
                  ? "MP4는 재생 시간보다 빠르게 인코딩되지만, 완료될 때까지 탭을 닫지 마세요."
                  : "WebM은 실제 재생 시간만큼 걸립니다. 다른 탭으로 전환하면 인코딩이 느려질 수 있습니다."}
              </small>
              <button type="button" className="secondary-button" onClick={onCancel}>
                취소
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
