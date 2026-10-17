import { Keyboard, X } from "lucide-react";
import { createPortal } from "react-dom";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: "Space", label: "영상 재생 / 일시정지 (모니터)" },
  { keys: "← / →", label: "이전 / 다음 씬 (발표 모드)" },
  { keys: "1 / 2 / 3", label: "판서를 1단계, 2단계, 3단계까지 공개" },
  { keys: "L", label: "가상 레이저 포인터" },
  { keys: "P", label: "판서 펜" },
  { keys: "H", label: "형광펜" },
  { keys: "C", label: "현재 씬 필기 지우기" },
  { keys: "Esc", label: "발표 모드 종료" },
];

export function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-dialog help-dialog" role="dialog" aria-modal="true" aria-label="도움말">
        <div className="modal-head">
          <div className="modal-title-group">
            <span className="modal-icon">
              <Keyboard size={19} />
            </span>
            <div>
              <h2>사용 안내</h2>
              <p>API 키 없이도 예시 프로젝트로 전체 흐름을 체험할 수 있습니다.</p>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="help-grid">
            <section>
              <h3>시작하기</h3>
              <ol>
                <li>Gemini API 키를 입력하거나 예시 프로젝트를 불러옵니다.</li>
                <li>수업 주제와 표현 모드, 테마를 고릅니다.</li>
                <li>영상 생성 후 모니터에서 재생하고 대본을 다듬습니다.</li>
                <li>PNG, SRT, JSON, WebM과 수업 자료를 내려받습니다.</li>
              </ol>
            </section>
            <section>
              <h3>발표 모드 단축키</h3>
              <ul className="shortcut-list">
                {SHORTCUTS.map((item) => (
                  <li key={item.keys}>
                    <kbd>{item.keys}</kbd>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <div className="help-note">
            API 키는 선택한 경우에만 이 브라우저에 저장되며, 영상 생성 요청 외에는 사용되지 않습니다.
            공용 컴퓨터에서는 “이 브라우저에만 키 저장”을 해제해 주세요.
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
