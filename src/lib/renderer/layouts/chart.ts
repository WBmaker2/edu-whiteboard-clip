import type { Scene, ThemePalette, VisualStyle } from "../../../types/project";
import {
  drawBeatIcon,
  fillProgress,
  roundedPath,
  strokeLine,
  text,
} from "../core";

export function drawChart(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  theme: ThemePalette,
  style: VisualStyle,
  bp: (index: number) => number,
): void {
  const count = Math.max(2, Math.min(5, scene.beats.length));
  const baseY = 856;
  const topY = 320;
  const axisX = 220;
  const endX = 1700;
  const areaW = endX - axisX;
  const slot = areaW / count;
  const barW = Math.min(150, slot * 0.52);

  const weights = scene.beats
    .slice(0, count)
    .map((beat) => `${beat.label}${beat.narration}`.replace(/\s/g, "").length);
  const max = Math.max(1, ...weights);
  const ratios = weights.map((weight) => 0.32 + 0.68 * (weight / max));

  const axisProgress = bp(0);
  if (axisProgress > 0) {
    strokeLine(ctx, axisX, topY, axisX, baseY, axisProgress, theme.cardBorderActive, 3, style, 0.75);
    strokeLine(ctx, axisX, baseY, endX, baseY, axisProgress, theme.cardBorderActive, 3, style, 0.75);
    for (let line = 1; line <= 4; line += 1) {
      const y = baseY - ((baseY - topY) / 4) * line;
      strokeLine(ctx, axisX, y, endX, y, axisProgress, theme.cardBorder, 1.5, "diagram", 0.4);
    }
  }

  for (let index = 0; index < count; index += 1) {
    const beat = scene.beats[index];
    const progress = bp(index);
    if (progress <= 0) continue;
    const color = theme.stepColors[index % theme.stepColors.length];
    const cx = axisX + slot * index + slot / 2;
    const fullH = (baseY - topY) * ratios[index];
    const h = fullH * progress;
    const top = baseY - h;

    const bar = roundedPath(cx - barW / 2, top, barW, Math.max(2, h), 10);
    fillProgress(ctx, bar, 0.9, color);
    strokeLine(ctx, cx - barW / 2, top, cx + barW / 2, top, progress, theme.title, 2.5, style, 0.7);

    drawBeatIcon(ctx, beat.iconType, cx, top - 54, 34, color, 2, progress, style);
    text(ctx, beat.label, cx, baseY + 42, {
      size: slot <= 200 ? 20 : 18,
      weight: 800,
      color: theme.title,
      alpha: progress,
      maxWidth: slot - 24,
    });
    text(ctx, beat.desc, cx, baseY + 74, {
      size: 16,
      weight: 500,
      color: theme.subtitle,
      alpha: progress,
      maxWidth: slot - 24,
    });
  }
}
