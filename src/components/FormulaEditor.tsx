import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useI18n } from "../lib/i18n";

interface FormulaEditorProps {
  initialLatex?: string;
  onCancel: () => void;
  onSave: (
    latex: string,
    png: Blob,
    width: number,
    height: number,
  ) => void | Promise<void>;
}

type KatexModule = typeof import("katex");

let katexPromise: Promise<KatexModule> | null = null;
function loadKatex(): Promise<KatexModule> {
  if (!katexPromise) {
    katexPromise = (async () => {
      await import("katex/dist/katex.min.css");
      return import("katex");
    })();
  }
  return katexPromise;
}

export function FormulaEditor({ initialLatex, onCancel, onSave }: FormulaEditorProps) {
  const { t } = useI18n();
  const [latex, setLatex] = useState(initialLatex ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadKatex().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void loadKatex().then((katex) => {
      if (cancelled) return;
      const target = previewRef.current;
      if (!target) return;
      if (!latex.trim()) {
        target.innerHTML = "";
        setError("");
        return;
      }
      try {
        katex.default.render(latex, target, { throwOnError: true, displayMode: true });
        setError("");
      } catch (caught) {
        target.innerHTML = "";
        const message =
          caught instanceof Error ? caught.message : t("formula.parseFailed");
        setError(message.split("\n")[0] ?? message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [latex, ready, t]);

  const save = async () => {
    if (!latex.trim() || error) return;
    setBusy(true);
    try {
      const katex = await loadKatex();
      const stage = stageRef.current;
      if (!stage) throw new Error(t("formula.stageMissing"));
      katex.default.render(latex, stage, { throwOnError: true, displayMode: true });
      await document.fonts.ready;
      const { toBlob } = await import("html-to-image");
      const originalError = console.error;
      console.error = () => undefined;
      let blob: Blob | null = null;
      try {
        blob = await toBlob(stage, { pixelRatio: 2, cacheBust: true });
      } finally {
        console.error = originalError;
      }
      if (!blob) throw new Error(t("formula.imageFailed"));
      const rect = stage.getBoundingClientRect();
      await onSave(
        latex,
        blob,
        Math.max(1, Math.round(rect.width * 2)),
        Math.max(1, Math.round(rect.height * 2)),
      );
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : t("formula.imageFailed");
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="formula-editor">
      <label className="field-label">
        {t("formula.label")}
        <textarea
          rows={2}
          className="text-area compact-area"
          value={latex}
          onChange={(event) => setLatex(event.target.value)}
          placeholder={t("formula.placeholder")}
          autoFocus
        />
      </label>
      <div className="formula-preview" ref={previewRef} aria-label={t("formula.preview")}>
        {!ready && <span className="formula-loading">{t("formula.loading")}</span>}
      </div>
      <div className="formula-stage-clip" aria-hidden="true">
        <div ref={stageRef} className="formula-stage" />
      </div>
      {error && <p className="inline-note is-error">{t("formula.error", { message: error })}</p>}
      <div className="formula-actions">
        <button type="button" className="mini-button" onClick={onCancel} disabled={busy}>
          {t("formula.cancel")}
        </button>
        <button
          type="button"
          className="mini-button is-primary"
          onClick={() => void save()}
          disabled={busy || !latex.trim() || Boolean(error)}
        >
          {busy ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
          {busy ? t("formula.saving") : t("formula.save")}
        </button>
      </div>
    </div>
  );
}
