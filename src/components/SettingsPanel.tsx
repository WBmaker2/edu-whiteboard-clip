import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  BookOpen,
  ChevronDown,
  Cpu,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Loader2,
  Languages,
  Lock,
  Mic2,
  Palette,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Trash2,
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
import {
  describeBudget,
  generationBudget,
  getSessionCalls,
  subscribeSessionCalls,
} from "../lib/requestBudget";
import {
  deleteUserTemplate,
  exportTemplateJson,
  importUserTemplate,
  listUserTemplates,
  saveUserTemplate,
  type UserTemplate,
} from "../lib/templates";
import { downloadText, sanitizeFileName } from "../lib/download";
import { GRADE_LEVELS, SUBJECTS } from "../data/curriculum";
import { useI18n } from "../lib/i18n";

interface SettingsPanelProps {
  onGenerate: () => void;
  onDemo: () => void;
  onCancelGenerate?: () => void;
}

type CheckState = { status: "idle" | "checking" | "ok" | "error"; message: string };

export function SettingsPanel({ onGenerate, onDemo, onCancelGenerate }: SettingsPanelProps) {
  const { t, language } = useI18n();
  const store = useStudioStore(
    useShallow((state) => ({
      apiKey: state.apiKey,
      rememberKey: state.rememberKey,
      topic: state.topic,
      themeId: state.themeId,
      visualStyle: state.visualStyle,
      layoutStyle: state.layoutStyle,
      aspect: state.aspect,
      gradeLevel: state.gradeLevel,
      subject: state.subject,
      standards: state.standards,
      model: state.model,
      ttsModel: state.ttsModel,
      voice: state.voice,
      bgmId: state.bgmId,
      generateWithAudio: state.generateWithAudio,
      phase: state.phase,
      progressPercent: state.progressPercent,
      progressMessage: state.progressMessage,
      patch: state.patch,
      setLanguage: state.setLanguage,
      setApiKey: state.setApiKey,
      setRememberKey: state.setRememberKey,
      setTheme: state.setTheme,
      setVisualStyle: state.setVisualStyle,
      setLayoutStyle: state.setLayoutStyle,
      setAspect: state.setAspect,
      pushToast: state.pushToast,
    })),
  );
  const [showKey, setShowKey] = useState(false);
  const [showTts, setShowTts] = useState(false);
  const [templates, setTemplates] = useState<UserTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const templateImportRef = useRef<HTMLInputElement | null>(null);
  const [checkState, setCheckState] = useState<CheckState>({
    status: "idle",
    message: "",
  });

  useEffect(() => {
    void listUserTemplates()
      .then(setTemplates)
      .catch(() => undefined);
  }, []);

  const applyTemplate = (template: UserTemplate) => {
    store.setTheme(template.themeId);
    store.setVisualStyle(template.visualStyle);
    store.setLayoutStyle(template.layoutStyle);
    store.setAspect(template.aspect);
    store.patch({
      topic: template.topic,
      ...(template.voice ? { voice: template.voice } : {}),
      ...(template.bgmId ? { bgmId: template.bgmId } : {}),
    });
    store.pushToast("success", t("settings.templateApplied", { name: template.name }));
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) return;
    try {
      const next = await saveUserTemplate({
        name: templateName.trim(),
        topic: store.topic,
        themeId: store.themeId,
        visualStyle: store.visualStyle,
        layoutStyle: store.layoutStyle,
        aspect: store.aspect,
        voice: store.voice,
        bgmId: store.bgmId,
      });
      setTemplates(next);
      setTemplateName("");
      store.pushToast("success", t("settings.templateSaved"));
    } catch (error) {
      store.pushToast(
        "error",
        error instanceof Error
          ? t("settings.templateSaveFailedReason", { message: error.message })
          : t("settings.templateSaveFailed"),
      );
    }
  };

  const removeTemplate = async (id: string) => {
    try {
      setTemplates(await deleteUserTemplate(id));
      store.pushToast("info", t("settings.templateDeleted"));
    } catch {
      store.pushToast("error", t("settings.templateDeleteFailed"));
    }
  };

  const exportTemplate = (template: UserTemplate) => {
    downloadText(
      `${sanitizeFileName(template.name, "template")}.panseolab-template.json`,
      exportTemplateJson(template),
      "application/json;charset=utf-8",
    );
    store.pushToast("success", t("settings.templateDownloaded"));
  };

  const handleTemplateImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const next = await importUserTemplate(await file.text());
      setTemplates(next);
      store.pushToast("success", t("settings.templateImported", { name: file.name }));
    } catch (error) {
      store.pushToast(
        "error",
        error instanceof Error ? error.message : t("settings.templateImportFailed"),
      );
    }
  };
  const sessionCalls = useSyncExternalStore(subscribeSessionCalls, getSessionCalls);
  const budget = generationBudget(5, store.generateWithAudio);

  const isBusy = store.phase === "generating" || store.phase === "exporting";
  const canGenerate = Boolean(store.apiKey.trim() && store.topic.trim()) && !isBusy;

  const selectedModel = useMemo(
    () => MODELS.find((model) => model.id === store.model) ?? MODELS[0],
    [store.model],
  );

  const handleCheckKey = async () => {
    setCheckState({ status: "checking", message: t("settings.checkingKey") });
    const { checkApiKey } = await import("../lib/gemini");
    const result = await checkApiKey(store.apiKey);
    setCheckState({ status: result.ok ? "ok" : "error", message: result.message });
    store.pushToast(result.ok ? "success" : "error", result.message);
  };

  return (
    <div className="settings-panel">
      <input
        ref={templateImportRef}
        type="file"
        accept=".json,application/json"
        data-testid="template-import"
        hidden
        onChange={(event) => void handleTemplateImport(event)}
      />
      <section className="panel-card">
        <div className="panel-heading">
          <span className="panel-label">
            <KeyRound size={15} />
            {t("settings.apiKeyTitle")}
          </span>
          <div className="panel-heading-actions">
            <label className="select-pill" title={t("app.language")}>
              <Languages size={13} />
              <select
                value={language}
                onChange={(event) => store.setLanguage(event.target.value as "ko" | "en")}
                aria-label={t("app.language")}
              >
                <option value="ko">{t("app.language.ko")}</option>
                <option value="en">{t("app.language.en")}</option>
              </select>
            </label>
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
              {t("settings.checkKey")}
            </button>
            <a
              className="text-link"
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
            >
              {t("settings.getKey")}
            </a>
          </div>
        </div>
        <div className="key-input-wrap">
          <input
            type={showKey ? "text" : "password"}
            className="text-input key-input"
            placeholder={t("settings.keyPlaceholder")}
            value={store.apiKey}
            onChange={(event) => store.setApiKey(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-label={t("settings.apiKeyTitle")}
          />
          <button
            type="button"
            className="input-icon-button"
            onClick={() => setShowKey((value) => !value)}
            aria-label={showKey ? t("settings.hideKey") : t("settings.showKey")}
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
            <span>{t("settings.rememberKey")}</span>
          </label>
          <span className="security-note">
            <Lock size={13} />
            {t("settings.noServer")}
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
            {t("settings.topicTitle")}
          </span>
          <span className="panel-hint">{t("settings.topicHint")}</span>
        </div>
        <textarea
          rows={3}
          className="text-area"
          placeholder={t("settings.topicPlaceholder")}
          value={store.topic}
          onChange={(event) => store.patch({ topic: event.target.value })}
          disabled={isBusy}
        />
        <div className="template-block">
          <span className="small-label">{t("settings.templates")}</span>
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
        <div className="user-template-block">
          <span className="small-label">{t("settings.myTemplates")}</span>
          <div className="user-template-save">
            <input
              className="text-input compact-input"
              placeholder={t("settings.templateNamePlaceholder")}
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              maxLength={40}
            />
            <button
              type="button"
              className={`mini-button ${templateName.trim() ? "btn-pulse" : ""}`}
              onClick={() => void saveTemplate()}
              disabled={!templateName.trim()}
            >
              {t("settings.saveTemplate")}
            </button>
            <button type="button" className="mini-button" onClick={() => templateImportRef.current?.click()}>
              {t("settings.importTemplate")}
            </button>
          </div>
          {templates.length > 0 ? (
            <div className="user-template-list">
              {templates.map((template) => (
                <div className="user-template-chip" key={template.id}>
                  <button
                    type="button"
                    className="user-template-apply"
                    onClick={() => applyTemplate(template)}
                    title={template.topic}
                  >
                    <strong>{template.name}</strong>
                    <small>
                      {template.aspect === "9:16"
                        ? t("settings.aspectPortraitShort")
                        : t("settings.aspectLandscapeShort")}{" "}
                      ·{" "}
                      {THEMES[template.themeId]?.name ?? template.themeId}
                    </small>
                  </button>
                  <button
                    type="button"
                    className="icon-button tiny"
                    onClick={() => exportTemplate(template)}
                    aria-label={t("settings.exportTemplateAria", { name: template.name })}
                    title={t("settings.exportTemplateTitle")}
                  >
                    <Download size={12} />
                  </button>
                  <button
                    type="button"
                    className="icon-button tiny is-danger"
                    onClick={() => void removeTemplate(template.id)}
                    aria-label={t("settings.deleteTemplateAria", { name: template.name })}
                    title={t("storyboard.deleteShort")}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="helper-note">
              {t("settings.templateEmptyHint")}
            </p>
          )}
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <span className="panel-label">
            <BookOpen size={15} />
            {t("settings.curriculumTitle")}
          </span>
          <span className="panel-hint">{t("settings.curriculumHint")}</span>
        </div>
        <div className="editor-row">
          <label className="field-label">
            {t("settings.gradeLevel")}
            <select
              className="text-input"
              value={store.gradeLevel}
              onChange={(event) => store.patch({ gradeLevel: event.target.value })}
            >
              {GRADE_LEVELS.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            {t("settings.subject")}
            <select
              className="text-input"
              value={store.subject}
              onChange={(event) => store.patch({ subject: event.target.value })}
            >
              {SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>
                  {subject || t("settings.noSubject")}
                </option>
              ))}
            </select>
          </label>
        </div>
        <textarea
          rows={2}
          className="text-area compact-area"
          placeholder={t("settings.standardsPlaceholder")}
          value={store.standards}
          onChange={(event) => store.patch({ standards: event.target.value })}
          disabled={isBusy}
        />
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <span className="panel-label">
            <Layers size={15} />
            {t("settings.visualTitle")}
          </span>
          <span className="panel-hint">{t("settings.visualHint")}</span>
        </div>
        <div className="option-grid three">
          {VISUAL_STYLES.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`option-card ${store.visualStyle === option.id ? "is-selected" : ""}`}
              onClick={() => store.setVisualStyle(option.id)}
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
            {t("settings.layoutTitle")}
          </span>
          <span className="panel-hint">{t("settings.layoutHint")}</span>
        </div>
        <div className="option-grid two">
          {LAYOUT_STYLES.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`option-card ${store.layoutStyle === option.id ? "is-selected" : ""}`}
              onClick={() => store.setLayoutStyle(option.id)}
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
            {t("settings.themeTitle")}
          </span>
          <span className="panel-hint">Color Theme</span>
        </div>
        <div className="option-grid two">
          {Object.values(THEMES).map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`theme-card ${store.themeId === theme.id ? "is-selected" : ""}`}
              onClick={() => store.setTheme(theme.id)}
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
            <LayoutGridIcon />
            {t("settings.aspectTitle")}
          </span>
          <span className="panel-hint">{t("settings.aspectHint")}</span>
        </div>
        <div className="option-grid two">
          <button
            type="button"
            className={`option-card ${store.aspect === "16:9" ? "is-selected" : ""}`}
            onClick={() => store.setAspect("16:9")}
          >
            <span className="option-top">
              <span className="option-title">{t("settings.aspectLandscape")}</span>
              <span className="option-desc">{t("settings.aspectLandscapeDesc")}</span>
            </span>
            <span className="radio-dot" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`option-card ${store.aspect === "9:16" ? "is-selected" : ""}`}
            onClick={() => store.setAspect("9:16")}
          >
            <span className="option-top">
              <span className="option-title-with-badge">
                <span className="option-title">{t("settings.aspectVertical")}</span>
                <span className="tiny-badge">9:16</span>
              </span>
              <span className="option-desc">{t("settings.aspectVerticalDesc")}</span>
            </span>
            <span className="radio-dot" aria-hidden="true" />
          </button>
        </div>
        {store.aspect === "9:16" && (
          <p className="model-note">
            {t("settings.aspectVerticalNote")}
          </p>
        )}
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <span className="panel-label">
            <Cpu size={15} />
            {t("settings.modelTitle")}
          </span>
          <button
            type="button"
            className="text-link-button"
            onClick={() => setShowTts((value) => !value)}
            aria-expanded={showTts}
          >
            {t("settings.ttsModel")}
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
          {t("settings.modelNote")}
          <span className="mono">{selectedModel.id}</span>
        </p>
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <span className="panel-label">
            <Mic2 size={15} />
            {t("settings.voiceTitle")}
          </span>
          <span className="panel-hint">{t("settings.voiceHint")}</span>
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
              {t("settings.generating")}
            </>
          ) : (
            <>
              <Wand2 size={17} />
              {t("settings.generate")}
            </>
          )}
        </button>
        <button type="button" className="demo-link" onClick={onDemo} disabled={isBusy}>
          <PlayCircle size={15} />
          {t("settings.demoLink")}
        </button>
        {store.phase === "generating" && (
          <div className="progress-block" aria-live="polite">
            <div className="progress-head">
              <span>
                <Sparkles size={13} />
                {store.progressMessage || t("settings.generatingPrep")}
              </span>
              <strong>{store.progressPercent}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${store.progressPercent}%` }} />
            </div>
            {onCancelGenerate && (
              <button type="button" className="mini-button progress-cancel" onClick={onCancelGenerate}>
                {t("settings.cancelGenerate")}
              </button>
            )}
          </div>
        )}
        <label className="checkbox-row generate-audio-toggle">
          <input
            type="checkbox"
            checked={store.generateWithAudio}
            onChange={(event) => store.patch({ generateWithAudio: event.target.checked })}
          />
          {t("settings.generateWithAudio")}
        </label>
        <p className="helper-note budget-note">
          {t("settings.budgetNote", { budget: describeBudget(budget, t), calls: sessionCalls })}
        </p>
        {!store.apiKey.trim() && (
          <p className="helper-note">
            {t("settings.needKey")}
          </p>
        )}
        {store.apiKey.trim() && !store.topic.trim() && (
          <p className="helper-note is-error">{t("settings.needTopic")}</p>
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
