import { useState } from "react";
import { useStudioStore } from "../../store/studioStore";
import { useI18n } from "../../lib/i18n";
import { redactKey } from "../../lib/gemini";

export function ApiKeySection() {
  const { t } = useI18n();
  const store = useStudioStore((state) => ({
    apiKey: state.apiKey,
    rememberKey: state.rememberKey,
    setApiKey: state.setApiKey,
    setRememberKey: state.setRememberKey,
    pushToast: state.pushToast,
  }));
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    if (!store.apiKey.trim()) {
      store.pushToast("error", t("settings.keyRequired"));
      return;
    }
    setChecking(true);
    try {
      // 간단한 검증 - 키 형식 확인
      if (store.apiKey.trim().startsWith("AIza")) {
        store.pushToast("success", t("settings.keyValid"));
      } else {
        store.pushToast("error", t("settings.keyInvalid", { message: "" }));
      }
    } catch (error) {
      store.pushToast(
        "error",
        error instanceof Error ? t("settings.keyCheckFailed", { message: redactKey(error.message, store.apiKey) }) : t("settings.keyCheckFailedShort"),
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="studio-card">
      <header className="studio-card-header">
        <h2>{t("settings.apiKeyTitle")}</h2>
        <p>{t("settings.apiKeyDesc")}</p>
      </header>
      <div className="studio-field">
        <label htmlFor="api-key">{t("settings.apiKeyLabel")}</label>
        <div className="api-key-row">
          <input
            id="api-key"
            type="password"
            value={store.apiKey}
            onChange={(event) => store.setApiKey(event.target.value)}
            placeholder={t("settings.apiKeyPlaceholder")}
            spellCheck={false}
            autoComplete="off"
          />
          <button className="ghost-btn" onClick={() => void handleCheck()} disabled={checking}>
            {checking ? t("settings.checking") : t("settings.checkKey")}
          </button>
        </div>
      </div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={store.rememberKey}
          onChange={(event) => store.setRememberKey(event.target.checked)}
        />
        <span>{t("settings.rememberKey")}</span>
      </label>
      <p className="studio-hint">
        {t("settings.keyHint")}{" "}
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
          Google AI Studio
        </a>
      </p>
    </section>
  );
}
