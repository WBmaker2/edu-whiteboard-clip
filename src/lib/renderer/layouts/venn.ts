import type { Scene, ThemePalette, VisualStyle } from "../../../types/project";
import { clamp } from "../../time";
import {
  drawBeatIcon,
  strokeRing,
  text,
} from "../core";

function fillCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  alpha: number,
): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawVenn(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  theme: ThemePalette,
  style: VisualStyle,
  bp: (index: number) => number,
): void {
  const leftColor = theme.stepColors[0];
  const rightColor = theme.stepColors[1];
  const overlapColor = theme.accent;
  const cy = 560;
  const radius = scene.beats.length >= 3 ? 270 : 300;
  const leftX = 960 - radius * 0.55;
  const rightX = 960 + radius * 0.55;

  const leftProgress = bp(0);
  const rightProgress = bp(1);
  const overlapProgress = scene.beats[2] ? bp(2) : 0;

  fillCircle(ctx, leftX, cy, radius, leftColor, leftProgress * 0.16);
  strokeRing(ctx, {
    cx: leftX,
    cy,
    radius,
    progress: leftProgress,
    color: leftColor,
    lineWidth: 4,
    style,
    startAngle: 0,
    sweep: Math.PI * 2,
  });
  fillCircle(ctx, rightX, cy, radius, rightColor, rightProgress * 0.16);
  strokeRing(ctx, {
    cx: rightX,
    cy,
    radius,
    progress: rightProgress,
    color: rightColor,
    lineWidth: 4,
    style,
    startAngle: 0,
    sweep: Math.PI * 2,
  });

  const left = scene.beats[0];
  const right = scene.beats[1];
  const overlap = scene.beats[2];

  if (left && leftProgress > 0) {
    drawBeatIcon(ctx, left.iconType, leftX - radius * 0.5, cy - 60, 58, leftColor, 2, leftProgress, style);
    text(ctx, left.label, leftX - radius * 0.5, cy + 40, {
      size: 30,
      weight: 800,
      color: theme.title,
      alpha: leftProgress,
      maxWidth: 300,
    });
    text(ctx, left.desc, leftX - radius * 0.5, cy + 78, {
      size: 18,
      weight: 500,
      color: theme.subtitle,
      alpha: leftProgress,
      maxWidth: 300,
    });
  }

  if (right && rightProgress > 0) {
    drawBeatIcon(ctx, right.iconType, rightX + radius * 0.5, cy - 60, 58, rightColor, 2, rightProgress, style);
    text(ctx, right.label, rightX + radius * 0.5, cy + 40, {
      size: 30,
      weight: 800,
      color: theme.title,
      alpha: rightProgress,
      maxWidth: 300,
    });
    text(ctx, right.desc, rightX + radius * 0.5, cy + 78, {
      size: 18,
      weight: 500,
      color: theme.subtitle,
      alpha: rightProgress,
      maxWidth: 300,
    });
  }

  if (overlap && overlapProgress > 0) {
    strokeRing(ctx, {
      cx: 960,
      cy: cy - 30,
      radius: 46,
      progress: clamp(overlapProgress * 1.2),
      color: overlapColor,
      lineWidth: 3.5,
      style,
      startAngle: 0,
      sweep: Math.PI * 2,
    });
    drawBeatIcon(ctx, overlap.iconType, 960, cy - 30, 50, overlapColor, 2, overlapProgress, style);
    text(ctx, overlap.label, 960, cy + 52, {
      size: 22,
      weight: 800,
      color: theme.title,
      alpha: overlapProgress,
      maxWidth: 240,
    });
    text(ctx, overlap.desc, 960, cy + 82, {
      size: 16,
      weight: 500,
      color: theme.subtitle,
      alpha: overlapProgress,
      maxWidth: 240,
    });
  }

  if (!overlap && left && right) {
    text(ctx, "공통점", 960, cy, {
      size: 22,
      weight: 800,
      color: theme.muted,
      alpha: Math.min(leftProgress, rightProgress),
    });
  }
}
