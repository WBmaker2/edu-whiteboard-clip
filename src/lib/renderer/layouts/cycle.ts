import type { Scene, ThemePalette, VisualStyle } from "../../../types/project";
import { clamp } from "../../time";
import {
  drawBeatIcon,
  strokeArrow,
  strokeRing,
  text,
} from "../core";

export function drawCycle(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  theme: ThemePalette,
  style: VisualStyle,
  bp: (index: number) => number,
): void {
  const centerX = 960;
  const centerY = 580;
  const count = Math.max(2, Math.min(5, scene.beats.length));
  const radius = count <= 3 ? 300 : 330;

  const points = Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
    return { x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) };
  });

  for (let index = 0; index < count; index += 1) {
    const from = points[index];
    const to = points[(index + 1) % count];
    const progress = bp(index);
    if (progress <= 0) continue;
    const color = theme.cardBorderActive;
    const inset = 66;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    strokeArrow(
      ctx,
      from.x + (dx / len) * inset,
      from.y + (dy / len) * inset,
      to.x - (dx / len) * inset,
      to.y - (dy / len) * inset,
      clamp((progress - 0.35) / 0.65),
      color,
      style,
      0.75,
      3.5,
    );
  }

  const centerProgress = bp(0) > 0 ? clamp(bp(0) * 1.2) : 0;
  if (centerProgress > 0) {
    strokeRing(ctx, {
      cx: centerX,
      cy: centerY,
      radius: 88,
      progress: centerProgress,
      color: theme.accent,
      lineWidth: 4,
      style,
      startAngle: 0,
      sweep: Math.PI * 2,
    });
    text(ctx, "순환 과정", centerX, centerY, {
      size: 25,
      weight: 900,
      color: theme.title,
      alpha: centerProgress,
    });
  }

  for (let index = 0; index < count; index += 1) {
    const beat = scene.beats[index];
    const progress = bp(index);
    if (progress <= 0) continue;
    const point = points[index];
    const color = theme.stepColors[index % theme.stepColors.length];
    strokeRing(ctx, {
      cx: point.x,
      cy: point.y,
      radius: 56,
      progress,
      color,
      lineWidth: 3.5,
      style,
    });
    drawBeatIcon(ctx, beat.iconType, point.x, point.y, 62, color, 2, progress, style);

    const labelY = point.y + (point.y >= centerY ? 92 : 82);
    const descY = labelY + 32;
    text(ctx, beat.label, point.x, labelY, {
      size: count <= 3 ? 28 : 24,
      weight: 800,
      color: theme.title,
      alpha: progress,
      maxWidth: 300,
    });
    text(ctx, beat.desc, point.x, descY, {
      size: count <= 3 ? 19 : 17,
      weight: 500,
      color: theme.subtitle,
      alpha: progress,
      maxWidth: 300,
    });
  }
}
