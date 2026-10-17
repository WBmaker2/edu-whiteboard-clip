import { useMemo, useState, useSyncExternalStore } from "react";
import {
  BookOpen,
  ChevronDown,
  Cpu,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Mic2,
  Palette,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useStudioStore } from "../store/studioStore";
import {
  LAYOUT_STYLES,
  MODELS,
  THEMES,
  TOPIC_TEMPLATES,
  TTS_MODELS,
  VISUAL_STYLES,
  VOICES,
} from "../data/presets";
import { checkApiKey } from "../lib/gemini";
import {
  describeBudget,
  generationBudget,
  getSessionCalls,
  subscribeSessionCalls,
} from "../lib/requestBudget";

interface SettingsPanelProps {
  onGenerate: () => void;
  onDemo: () => void;
}

type CheckState = { status: "idle" | "checking" | "ok" | "error"; message: string };

export function SettingsPanel({ onGenerate, onDemo }: SettingsPanelProps) {
  const store = useStudioStore();
  const [showKey, setShowKey] = useState(false);
  const [showTts, setShowTts] = useState(false);
  const [checkState, setCheckState] = useState<CheckState>({
    status: "idle",
    message: "",
  });
  const sessionCalls = useSyncExternalStore(subscribeSessionCalls, getSessionCalls);
  const budget = generationBudget(5, store.generateWithAudio);

  const isBusy = store.phase === "generating" || store.phase === "exporting";
  const canGenerate = Boolean(store.apiKey.trim() && store.topic.trim()) && !isBusy;

  const selectedModel = useMemo(
    () => MODELS.find((model) => model.id === store.model) ?? MODELS[0],
    [store.model],
  );

  const handleCheckKey = async () => {
    setCheckState({ status: "checking", message: "키를 확인하는 중..." });
    const result = await checkApiKey(store.apiKey);
    setCheckState({ status: result.ok ? "ok" : "error", message: result.message });
    store.pushToast(result.ok ? "success" : "error", result.message);
  };

  return (
    <div className="settings-panel">
      <section className="panel-card">
        <div className="panel-heading">
          <span className="panel-label">
            <KeyRound size={15} />
            GEMINI API KEY
          </span>
          <div className="panel-heading-actions">
            <button
              type="button"
              className="mini-button"
              onClick={handleCheckKey}
              disabled={!store.apiKey.trim() || checkState.status === "checking"}
            >
              {checkState.status === "checking" ? (
                <Loader2 size={13} className="spin" />
              ) : (
                <ShieldCheck size={13} />
              )}
              키 확인
            </button>
            <a
              className="text-link"
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
            >
              무료 키 받기
            </a>
          </div>
        </div>
        <div className="key-input-wrap">
          <input
            type={showKey ? "text" : "password"}
            className="text-input key-input"
            placeholder="AIzaSy... (Gemini API Key)"
            value={store.apiKey}
            onChange={(event) => store.setApiKey(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-label="Gemini API 키"
          />
          <button
            type="button"
            className="input-icon-button"
            onClick={() => setShowKey((value) => !value)}
            aria-label={showKey ? "API 키 숨기기" : "API 키 표시"}
          >
            {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        <div className="key-meta">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={store.rememberKey}
              onChange={(event) => store.setRememberKey(event.target.checked)}
            />
            <span>이 브라우저에만 키 저장</span>
          </label>
          <span className="security-note">
            <Lock size={13} />
            서버로 전송되지 않습니다
          </span>
        </div>
        {checkState.message && (
          <p className={`inline-note ${checkState.status === "error" ? "is-error" : "is-ok"}`}>
            {checkState.message}
          </p>
        )}
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <span className="panel-label">
            <BookOpen size={15} />
            수업 주제 및 학습 목표
          </span>
          <span className="panel-hint">5단계 교수설계</span>
        </div>
        <textarea
          rows={3}
          className="text-area"
          placeholder="수업이나 교육 영상으로 설명할 개념, 과학 원리, 학습 주제를 입력하세요."
          value={store.topic}
          onChange={(event) => store.patch({ topic: event.target.value })}
          disabled={isBusy}
        />
        <div className="template-block">
          <span className="small-label">추천 교육 주제 템플릿</span>
          <div className="template-grid">
            {TOPIC_TEMPLATES.map((template) => (
              <button
                key={template.title}
                type="button"
                className="template-button"
                onClick={() => store.patch({ topic: template.title })}
                disabled={isBusy}
              >
                <span className="template-dot" style={{ backgroundColor: template.dotColor }} />
                <span>
                  <strong>{template.title}</strong>
                  <small>{template.tag}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <span className="panel-label">
            <Layers size={15} />
            그래픽 표현 모드
          </span>
          <span className="panel-hint">선택 즉시 캔버스 반영</span>
        </div>
        <div className="option-grid three">
          {VISUAL_STYLES.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`option-card ${store.visualStyle === option.id ? "is-selected" : ""}`}
              onClick={() => store.patch({ visualStyle: option.id })}
            >
              <span className="option-top">
                <span className="option-title">{option.name}</span>
                <span className="option-desc">{option.desc}</span>
              </span>
              <span className="radio-dot" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <span className="panel-label">
            <LayoutGridIcon />
            영상 연출 스타일
          </span>
          <span className="panel-hint">5가지 연출 모드</span>
        </div>
        <div className="option-grid two">
          {LAYOUT_STYLES.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`option-card ${store.layoutStyle === option.id ? "is-selected" : ""}`}
              onClick={() => store.patch({ layoutStyle: option.id })}
            >
              <span className="option-top">
                <span className="option-title-with-badge">
                  <span className="option-title">{option.name}</span>
                  {option.badge && <span className="tiny-badge">{option.badge}</span>}
                </span>
                <span className="option-desc">{option.desc}</span>
              </span>
              <span className="radio-dot" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <span className="panel-label">
            <Palette size={15} />
            디자인 색상 템플릿
          </span>
          <span className="panel-hint">Color Theme</span>
        </div>
        <div className="option-grid two">
          {Object.values(THEMES).map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`theme-card ${store.themeId === theme.id ? "is-selected" : ""}`}
              onClick={() => store.patch({ themeId: theme.id })}
            >
              <span
                className="theme-swatch"
                style={{
                  background: theme.bg,
                  borderColor: theme.cardBorder,
                  color: theme.accent,
                }}
              >
                <span style={{ background: theme.accent }} />
              </span>
              <span className="theme-meta">
                <span className="option-title">{theme.name}</span>
                <span className="option-desc">{theme.desc}</span>
              </span>
              <span className="radio-dot" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <span className="panel-label">
            <Cpu size={15} />
            Gemini 모델
          </span>
          <button
            type="button"
            className="text-link-button"
            onClick={() => setShowTts((value) => !value)}
            aria-expanded={showTts}
          >
            TTS 음성 모델
            <ChevronDown size={13} className={showTts ? "rotate" : ""} />
          </button>
        </div>
        <div className="option-grid two">
          {MODELS.map((model) => (
            <button
              key={model.id}
              type="button"
              className={`option-card ${store.model === model.id ? "is-selected" : ""}`}
              onClick={() => store.patch({ model: model.id })}
            >
              <span className="option-top">
                <span className="option-title-with-badge">
                  <span className="option-title">{model.name}</span>
                  {model.badge && <span className="tiny-badge">{model.badge}</span>}
                </span>
                <span className="option-desc">{model.desc}</span>
              </span>
              <span className="radio-dot" aria-hidden="true" />
            </button>
          ))}
        </div>
        {showTts && (
          <div className="sub-options">
            {TTS_MODELS.map((model) => (
              <button
                key={model.id}
                type="button"
                className={`option-card compact ${store.ttsModel === model.id ? "is-selected" : ""}`}
                onClick={() => store.patch({ ttsModel: model.id })}
              >
                <span className="option-top">
                  <span className="option-title-with-badge">
                    <span className="option-title">{model.name}</span>
                    {model.badge && <span className="tiny-badge">{model.badge}</span>}
                  </span>
                  <span className="option-desc">{model.desc}</span>
                </span>
                <span className="radio-dot" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
        <p className="model-note">
          선택한 모델을 사용할 수 없으면 자동으로 대체 모델을 시도합니다.
          <span className="mono">{selectedModel.id}</span>
        </p>
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <span className="panel-label">
            <Mic2 size={15} />
            한국어 나레이션 음성
          </span>
          <span className="panel-hint">TTS 보이스</span>
        </div>
        <div className="segmented">
          {VOICES.map((voice) => (
            <button
              key={voice.id}
              type="button"
              className={`segment ${store.voice === voice.id ? "is-active" : ""}`}
              onClick={() => store.patch({ voice: voice.id })}
            >
              <strong>{voice.name}</strong>
              <small>{voice.desc}</small>
            </button>
          ))}
        </div>
      </section>

      <div className="generate-block">
        <button
          type="button"
          className={`primary-button generate-button ${
            canGenerate ? "btn-pulse" : ""
          }`}
          onClick={onGenerate}
          disabled={isBusy}
        >
          {store.phase === "generating" ? (
            <>
              <Loader2 size={17} className="spin" />
              스토리보드와 나레이션을 만드는 중...
            </>
          ) : (
            <>
              <Wand2 size={17} />
              화이트보드 교육 영상 생성하기
            </>
          )}
        </button>
        <button type="button" className="demo-link" onClick={onDemo} disabled={isBusy}>
          <PlayCircle size={15} />
          API 키 없이 예시 프로젝트로 먼저 둘러보기
        </button>
        {store.phase === "generating" && (
          <div className="progress-block" aria-live="polite">
            <div className="progress-head">
              <span>
                <Sparkles size={13} />
                {store.progressMessage || "생성 준비 중..."}
              </span>
              <strong>{store.progressPercent}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${store.progressPercent}%` }} />
            </div>
          </div>
        )}
        <label className="checkbox-row generate-audio-toggle">
          <input
            type="checkbox"
            checked={store.generateWithAudio}
            onChange={(event) => store.patch({ generateWithAudio: event.target.checked })}
          />
          나레이션 음성도 함께 생성 (무료 한도 절약은 해제)
        </label>
        <p className="helper-note budget-note">
          예상 Gemini 호출: {describeBudget(budget)} · 이번 세션 {sessionCalls}회 사용
        </p>
        {!store.apiKey.trim() && (
          <p className="helper-note">
            AI 생성에는 Gemini API 키가 필요합니다. 예시 프로젝트는 키 없이도 모든 기능을
            체험할 수 있습니다.
          </p>
        )}
        {store.apiKey.trim() && !store.topic.trim() && (
          <p className="helper-note is-error">수업 주제를 먼저 입력해 주세요.</p>
        )}
      </div>
    </div>
  );
}

function LayoutGridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
