import { useEffect, useRef } from "react";
import {
  Camera,
  Captions,
  Clapperboard,
  FileJson,
  Image,
  LayoutList,
  Loader2,
  MonitorUp,
  PlayCircle,
  Presentation,
  Redo2,
  Save,
  Sparkles,
  ClipboardList,
  History,
  ListChecks,
  Plus,
  Undo2,
} from "lucide-react";
import type { Project } from "../types/project";
import { useStudioStore } from "../store/studioStore";
import { usePlayback } from "../hooks/usePlayback";
import { PlayerControls } from "./PlayerControls";
import { StoryboardList } from "./StoryboardList";
import { renderPoster, CANVAS_HEIGHT, CANVAS_WIDTH } from "../lib/renderer";
import { THEMES } from "../data/presets";
import type { RecordedResult } from "../hooks/useRecorder";

interface MonitorPanelProps {
  project: Project | null;
  active: boolean;
  onDemo: () => void;
  onSaveDraft: () => void;
  onExportJson: () => void;
  onSnapshot: (canvas: HTMLCanvasElement, sceneIndex: number) => void;
  onExportSrt: () => void;
  onOpenPresentation: () => void;
  onOpenWorksheet: () => void;
  onOpenQuiz: () => void;
  onOpenMaterials: () => void;
  onExportVideo: () => void;
  onRegenerate: (index: number) => Promise<void>;
  onRecorded: (index: number, result: RecordedResult) => void;
  onLanguageChange: (code: string) => void;
  onSelectScene?: (index: number) => void;
}

export function MonitorPanel({
  project,
  active,
  onDemo,
  onSaveDraft,
  onExportJson,
  onSnapshot,
  onExportSrt,
  onOpenPresentation,
  onOpenWorksheet,
  onOpenQuiz,
  onOpenMaterials,
  onExportVideo,
  onRegenerate,
  onRecorded,
  onLanguageChange,
}: MonitorPanelProps) {
  const store = useStudioStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const options = {
    themeId: store.themeId,
    visualStyle: store.visualStyle,
    layoutStyle: store.layoutStyle,
    captions: store.captions,
    captionLang: store.captionLang,
    translations: store.translations,
    bgmId: store.bgmId,
    bgmVolume: store.bgmVolume,
    sfx: store.sfx,
  };
  const playback = usePlayback(project, options, canvasRef);
  const theme = THEMES[store.themeId] ?? THEMES.paper;
  const isGenerating = store.phase === "generating";
  const canUndo = store.history.past.length > 0;
  const canRedo = store.history.future.length > 0;

  useEffect(() => {
    if (project) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderPoster(ctx, store.themeId);
  }, [project, store.themeId]);

  useEffect(() => {
    if (useStudioStore.getState().activeSceneIndex !== playback.activeScene) {
      useStudioStore.getState().patch({ activeSceneIndex: playback.activeScene });
    }
  }, [playback.activeScene]);

  const togglePlayback = playback.toggle;

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (document.querySelector(".modal-backdrop, .presentation-root")) return;
      if (!project) return;
      event.preventDefault();
      togglePlayback();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, togglePlayback, project]);

  const replay = () => {
    playback.seek(0);
    if (!playback.isPlaying) void playback.play();
  };

  return (
    <div className="monitor-panel">
      <section className="panel-card monitor-card">
        <div className="monitor-heading">
          <div className="monitor-title">
            <span className="panel-label">
              <MonitorUp size={15} />
              교육 영상 모니터
            </span>
            <span className="soft-chip">{theme.name}</span>
            {project && (
              <span className="soft-chip is-blue">
                {project.scenes.length}씬 · {formatRuntime(playback.duration)}
              </span>
            )}
          </div>
          <div className="monitor-tools">
            <div className="resolution-toggle" aria-label="내보내기 해상도">
              <button
                type="button"
                className={store.resolution === "fhd" ? "is-active" : ""}
                onClick={() => store.patch({ resolution: "fhd" })}
              >
                FHD 1080p
              </button>
              <button
                type="button"
                className={store.resolution === "hd" ? "is-active" : ""}
                onClick={() => store.patch({ resolution: "hd" })}
              >
                <Sparkles size={12} />
                고속 720p
              </button>
            </div>
            <button type="button" className="tool-button compact" onClick={() => canvasRef.current && onSnapshot(canvasRef.current, playback.activeScene)} disabled={!project} title="현재 장면을 PNG로 저장">
              <Camera size={15} />
              <span>스냅샷</span>
            </button>
            <button type="button" className="tool-button compact" onClick={onExportSrt} disabled={!project} title="SRT 자막 저장">
              <Captions size={15} />
              <span>SRT</span>
            </button>
            <button type="button" className="tool-button compact" onClick={onExportJson} disabled={!project} title="프로젝트 JSON 저장">
              <FileJson size={15} />
              <span>JSON</span>
            </button>
            <button type="button" className="tool-button" onClick={onOpenMaterials} disabled={!project} title="썸네일과 카드뉴스 만들기">
              <Image size={15} />
              <span>썸네일/카드</span>
            </button>
            <button type="button" className="tool-button" onClick={onOpenPresentation} disabled={!project} title="교사용 발표 모드">
              <Presentation size={15} />
              <span>발표 모드</span>
            </button>
            <button type="button" className="tool-button" onClick={onOpenWorksheet} disabled={!project} title="A4 학습지">
              <ClipboardList size={15} />
              <span>A4 학습지</span>
            </button>
            <button type="button" className="tool-button" onClick={onOpenQuiz} disabled={!project} title="AI 웹 퀴즈">
              <ListChecks size={15} />
              <span>AI 퀴즈</span>
            </button>
            <label className="select-pill format-pill" title="내보내기 파일 형식">
              <Clapperboard size={14} />
              <select
                value={store.exportFormat}
                onChange={(event) =>
                  store.patch({ exportFormat: event.target.value as "webm" | "mp4" })
                }
                aria-label="내보내기 파일 형식"
              >
                <option value="webm">WebM</option>
                <option value="mp4">MP4</option>
              </select>
            </label>
            <button type="button" className="tool-button is-accent" onClick={onExportVideo} disabled={!project} title="영상 파일로 내보내기">
              <Clapperboard size={15} />
              <span>비디오 내보내기</span>
            </button>
          </div>
        </div>

        <div className="canvas-frame">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="stage-canvas"
            aria-label="화이트보드 영상 미리보기"
          />
          {isGenerating && (
            <div className="canvas-overlay">
              <Loader2 size={28} className="spin" />
              <strong>{store.progressPercent}%</strong>
              <span>{store.progressMessage}</span>
            </div>
          )}
          {!project && !isGenerating && (
            <div className="poster-actions">
              <button type="button" className="primary-button poster-demo-button" onClick={onDemo}>
                <PlayCircle size={16} />
                예시 프로젝트로 시작하기
              </button>
            </div>
          )}
        </div>

        {project ? (
          <>
            <div className="scene-tabs" role="tablist" aria-label="씬 선택">
              {project.scenes.map((scene, index) => (
                <button
                  key={scene.id}
                  type="button"
                  role="tab"
                  aria-selected={playback.activeScene === index}
                  className={`scene-tab ${playback.activeScene === index ? "is-active" : ""}`}
                  onClick={() => playback.selectScene(index)}
                >
                  <span className="scene-tab-dot" />
                  {index + 1}. {scene.type === "intro" ? "도입" : scene.type === "outro" ? "정리" : `전개 ${index}`}
                </button>
              ))}
              <button
                type="button"
                className="scene-tab scene-tab-add"
                onClick={() => store.addScene(playback.activeScene)}
                disabled={project.scenes.length >= 10}
                title="장면 추가"
              >
                <Plus size={12} />
                장면
              </button>
            </div>

            <PlayerControls
              time={playback.time}
              duration={playback.duration}
              isPlaying={playback.isPlaying}
              rate={playback.rate}
              activeScene={playback.activeScene}
              sceneDurations={project.scenes.map((scene) => scene.duration)}
              onToggle={playback.toggle}
              onSeek={playback.seek}
              onSetRate={playback.setRate}
              onLanguageChange={onLanguageChange}
              onReplay={replay}
            />

            <div className="monitor-footer">
              <span className="scene-counter">
                씬 <strong>{playback.activeScene + 1}</strong> / {project.scenes.length}
              </span>
              <div className="monitor-footer-actions">
                <span className={`autosave-status is-${store.autosaveState}`}>
                  {store.autosaveState === "saving"
                    ? "저장 중..."
                    : store.autosaveState === "error"
                      ? "저장 실패"
                      : store.lastSavedAt
                        ? `자동 저장됨 ${formatSavedTime(store.lastSavedAt)}`
                        : "자동 저장 대기"}
                </span>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => store.openModal("history", true)}
                  title="저장 기록"
                >
                  <History size={13} />
                  기록
                </button>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => store.undo()}
                  disabled={!canUndo}
                  title="실행 취소 (Ctrl/Cmd+Z)"
                >
                  <Undo2 size={13} />
                </button>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => store.redo()}
                  disabled={!canRedo}
                  title="다시 실행 (Shift+Ctrl/Cmd+Z)"
                >
                  <Redo2 size={13} />
                </button>
                <button type="button" className="mini-button" onClick={onSaveDraft}>
                  <Save size={13} />
                  초안 저장
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-monitor-note">
            <span className="empty-icon">
              <LayoutList size={18} />
            </span>
            <div>
              <strong>아직 만든 영상이 없습니다.</strong>
              <p>왼쪽 스튜디오 설정에서 주제를 입력하거나 예시 프로젝트를 불러와 보세요.</p>
            </div>
          </div>
        )}
      </section>

      {!project && !isGenerating && (
        <section className="panel-card studio-tip-card">
          <div className="panel-heading">
            <span className="panel-label">
              <Sparkles size={15} />
              이렇게 만들어져요
            </span>
            <span className="panel-hint">3단계 제작 흐름</span>
          </div>
          <div className="tip-flow">
            <span><b>1</b> 수업 주제 입력</span>
            <i />
            <span><b>2</b> AI 스토리보드</span>
            <i />
            <span><b>3</b> 판서 영상 완성</span>
          </div>
          <div className="tip-grid">
            <div>
              <strong>AI 스토리보드</strong>
              <p>5개 장면과 3개의 핵심 비트를 자동으로 설계합니다.</p>
            </div>
            <div>
              <strong>손그림 판서</strong>
              <p>4가지 테마와 5가지 연출로 캔버스에 애니메이션을 그립니다.</p>
            </div>
            <div>
              <strong>수업 자료</strong>
              <p>영상, 자막, 학습지, 퀴즈, 카드뉴스까지 한 번에 만듭니다.</p>
            </div>
          </div>
        </section>
      )}

      {project && (
        <StoryboardList
          project={project}
          activeScene={playback.activeScene}
          onSelectScene={playback.selectScene}
          onRegenerate={onRegenerate}
          onRecorded={onRecorded}
          onSaveDraft={onSaveDraft}
          onExportJson={onExportJson}
        />
      )}
    </div>
  );
}

function formatSavedTime(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatRuntime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
