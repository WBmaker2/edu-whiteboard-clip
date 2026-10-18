import type { Scene, ThemePalette, VisualStyle } from "../../types/project";
import { clamp, easeOutCubic } from "../time";
import { CANVAS_WIDTH, strokeUnderline, text } from "./core";

export function drawSceneHeader(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  time: number,
  theme: ThemePalette,
  style: VisualStyle,
): void {
  const titleProgress = easeOutCubic(clamp(time / 0.9));
  const underlineProgress = easeOutCubic(clamp((time - 0.45) / 0.7));
  text(ctx, scene.title, CANVAS_WIDTH / 2, 100, {
    size: 52,
    weight: 900,
    color: theme.title,
    alpha: titleProgress,
  });
  strokeUnderline(
    ctx,
    CANVAS_WIDTH / 2,
    146,
    260,
    underlineProgress,
    theme.accent,
    5,
    style,
    0.95,
  );
  text(ctx, scene.subtitle, CANVAS_WIDTH / 2, 196, {
    size: 25,
    weight: 600,
    color: theme.subtitle,
    alpha: easeOutCubic(clamp((time - 0.6) / 0.8)),
  });
}
