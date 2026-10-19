import type { Scene, ThemePalette, VisualStyle } from "../../../types/project";
import { clamp } from "../../time";
import {
  drawBeatIcon,
  strokeLine,
  strokeRing,
  text,
} from "../core";

export function drawTimeline(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  theme: ThemePalette,
  style: VisualStyle,
  bp: (index: number) => number,
): void {
  const count = Math.max(2, Math.min(5, scene.beats.length));
  const axisY = 600;
  const startX = 280;
  const endX = 1640;
  const step = count > 1 ? (endX - startX) / (count - 1) : 0;

  const axisProgress = clamp(bp(0) * 1.4);
  if (axisProgress > 0) {
    strokeLine(ctx, startX, axisY, endX, axisY, axisProgress, theme.cardBorderActive, 4, style, 0.8);
    strokeLine(ctx, startX, axisY - 12, startX, axisY + 12, axisProgress, theme.cardBorderActive, 3, style, 0.7);
    strokeLine(ctx, endX, axisY - 12, endX, axisY + 12, axisProgress, theme.cardBorderActive, 3, style, 0.7);
  }

  for (let index = 0; index < count; index += 1) {
    const beat = scene.beats[index];
    const progress = bp(index);
    if (progress <= 0) continue;
    const x = startX + step * index;
    const color = theme.stepColors[index % theme.stepColors.length];
    const above = index % 2 === 0;
    const markerY = axisY;

    strokeRing(ctx, {
      cx: x,
      cy: markerY,
      radius: 34,
      progress,
      color,
      lineWidth: 3.5,
      style,
      startAngle: 0,
      sweep: Math.PI * 2,
    });
    drawBeatIcon(ctx, beat.iconType, x, markerY, 42, color, 2, progress, style);

    const cardW = count <= 3 ? 300 : 240;
    const cardH = 150;
    const cardY = above ? axisY - 40 - cardH : axisY + 40;
    const connectY = above ? cardY + cardH : cardY;
    strokeLine(ctx, x, markerY, x, connectY, progress, color, 2.5, style, 0.6);

    const titleY = above ? cardY + 42 : cardY + 44;
    const descY = titleY + 46;
    text(ctx, `STEP 0${index + 1}`, x, above ? cardY + 16 : cardY + 18, {
      size: 15,
      weight: 800,
      color,
      alpha: progress,
    });
    text(ctx, beat.label, x, titleY, {
      size: count <= 3 ? 26 : 22,
      weight: 800,
      color: theme.title,
      alpha: progress,
      maxWidth: cardW,
    });
    text(ctx, beat.desc, x, descY, {
      size: count <= 3 ? 18 : 16,
      weight: 500,
      color: theme.subtitle,
      alpha: progress,
      maxWidth: cardW,
    });
  }
}
