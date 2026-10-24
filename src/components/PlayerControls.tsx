import { useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  Captions,
  Languages,
  Music2,
  Pause,
  PenTool,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Wand2,
} from "lucide-react";
import { useStudioStore } from "../store/studioStore";
import { BGM_PRESETS, CAPTION_LANGUAGES } from "../data/presets";
import { formatClock } from "../lib/time";
import { useI18n } from "../lib/i18n";
import { localLabel } from "../lib/labels";

interface PlayerControlsProps {
  time: number;
  duration: number;
  isPlaying: boolean;
  rate: number;
  activeScene: number;
  sceneDurations: number[];
  onToggle: () => void;
  onSeek: (time: number) => void;
  onSetRate: (rate: number) => void;
  onLanguageChange: (code: string) => void;
  onReplay: () => void;
}

export function PlayerControls({
  time,
  duration,
  isPlaying,
  rate,
  activeScene,
  sceneDurations,
  onToggle,
  onSeek,
  onSetRate,
  onLanguageChange,
  onReplay,
}: PlayerControlsProps) {
  const { t, language } = useI18n();
  const store = useStudioStore(
    useShallow((state) => ({
      captions: state.captions,
      captionLang: state.captionLang,
      bgmId: state.bgmId,
      bgmVolume: state.bgmVolume,
      penTip: state.penTip,
      sfx: state.sfx,
      patch: state.patch,
      setBgmId: state.setBgmId,
    })),
  );
  const trackRef = useRef<HTMLDivElement | null>(null);

  const markers = useMemo(() => {
    const total = sceneDurations.reduce((sum, value) => sum + value, 0) || 1;
    let cursor = 0;
    return sceneDurations.map((sceneDuration) => {
      const start = cursor / total;
      cursor += sceneDuration;
      return { start, end: cursor / total };
    });
  }, [sceneDurations]);

  const seekFromEvent = (clientX: number) => {
    const element = trackRef.current;
    if (!element || duration <= 0) return;
    const rect = element.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <div className="player-controls">
      <div
        className="seek-track"
        ref={trackRef}
        onClick={(event) => seekFromEvent(event.clientX)}
        role="slider"
        aria-label={t("player.position")}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") onSeek(Math.min(duration, time + 2));
          if (event.key === "ArrowLeft") onSeek(Math.max(0, time - 2));
        }}
      >
        {markers.map((marker, index) => (
          <span
            key={index}
            className={`seek-segment ${index === activeScene ? "is-active" : ""}`}
            style={{ left: `${marker.start * 100}%`, width: `${(marker.end - marker.start) * 100}%` }}
          />
        ))}
        <span className="seek-fill" style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
        <span
          className="seek-thumb"
          style={{ left: `${duration ? (time / duration) * 100 : 0}%` }}
        />
      </div>

      <div className="controls-row">
        <div className="controls-group">
          <button type="button" className="control-button play-button" onClick={onToggle} aria-label={isPlaying ? t("player.pause") : t("player.play")}>
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button type="button" className="control-icon" onClick={onReplay} aria-label={t("player.replay")}>
            <RotateCcw size={16} />
          </button>
          <span className="time-readout">
            <strong>{formatClock(time)}</strong>
            <span>/ {formatClock(duration)}</span>
          </span>
        </div>

        <div className="controls-group rate-group" aria-label={t("player.rate")}>
          {[0.75, 1, 1.25, 1.5].map((value) => (
            <button
              key={value}
              type="button"
              className={`rate-button ${rate === value ? "is-active" : ""}`}
              onClick={() => onSetRate(value)}
            >
              {value}x
            </button>
          ))}
        </div>

        <div className="controls-group">
          <button
            type="button"
            className={`pill-toggle ${store.captions ? "is-active" : ""}`}
            onClick={() => store.patch({ captions: !store.captions })}
            aria-pressed={store.captions}
            title={t("player.captions")}
          >
            <Captions size={15} />
            CC
          </button>

          <label className="select-pill" title={t("player.captionLang")}>
            <Languages size={15} />
            <select
              value={store.captionLang}
              onChange={(event) => onLanguageChange(event.target.value)}
              aria-label={t("player.captionLang")}
            >
              {CAPTION_LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.flag} {language.nativeName}
                </option>
              ))}
            </select>
          </label>

          <label className="select-pill" title={t("player.bgm")}>
            <Music2 size={15} />
            <select
              value={store.bgmId}
              onChange={(event) => {
                store.setBgmId(event.target.value);
              }}
              aria-label={t("player.bgm")}
            >
              {BGM_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {localLabel(language, "bgm", preset.id, "name", preset.name)}
                </option>
              ))}
            </select>
          </label>

          {store.bgmId !== "none" && (
            <label className="volume-pill" title={`${t("player.bgmVolume")} ${Math.round(store.bgmVolume * 100)}%`}>
              {store.bgmVolume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={store.bgmVolume}
                onChange={(event) => store.patch({ bgmVolume: Number(event.target.value) })}
                aria-label={t("player.bgmVolume")}
              />
            </label>
          )}

          <button
            type="button"
            className={`pill-toggle ${store.penTip ? "is-active" : ""}`}
            onClick={() => store.patch({ penTip: !store.penTip })}
            aria-pressed={store.penTip}
            title={t("player.penTip")}
          >
            <PenTool size={14} />
            {t("player.penTipLabel")}
          </button>

          <button
            type="button"
            className={`pill-toggle ${store.sfx ? "is-active" : ""}`}
            onClick={() => store.patch({ sfx: !store.sfx })}
            aria-pressed={store.sfx}
            title={t("player.sfx")}
          >
            <Wand2 size={14} />
            {t("player.sfxLabel")}
          </button>
        </div>
      </div>
    </div>
  );
}
