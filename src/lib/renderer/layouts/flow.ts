import type { Scene, ThemePalette, VisualStyle } from "../../../types/project";
import { clamp } from "../../time";
import {
  drawBeatIcon,
  fillProgress,
  roundedPath,
  strokeArrow,
  strokeCardEdge,
  strokeRing,
  strokeUnderline,
  text,
  wrapLines,
} from "../core";
import { cardLayout } from "./shared";

export function drawFlow(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  theme: ThemePalette,
  style: VisualStyle,
  bp: (index: number) => number,
): void {
  const count = Math.min(5, scene.beats.length);
  const { width, centers } = cardLayout(count);
  for (let index = 0; index < count; index += 1) {
    const beat = scene.beats[index];
    const cx = centers[index];
    const progress = bp(index);
    if (progress <= 0) continue;
    const color = theme.stepColors[index % theme.stepColors.length];
    const card = roundedPath(cx - width / 2, 320, width, 430, 22);
    fillProgress(ctx, card, Math.min(1, progress * 1.2), theme.cardBg);
    strokeCardEdge(
      ctx,
      cx - width / 2,
      320,
      width,
      430,
      22,
      progress,
      color,
      3,
      style,
      0.85,
    );

    const iconRadius = count <= 3 ? 56 : 48;
    strokeRing(ctx, {
      cx,
      cy: 420,
      radius: iconRadius,
      progress,
      color,
      lineWidth: 3.5,
      style,
    });
    drawBeatIcon(
      ctx,
      beat.iconType,
      cx,
      420,
      count <= 3 ? 68 : 56,
      color,
      2,
      progress,
      style,
    );
    text(ctx, `STEP 0${index + 1}`, cx, 512, {
      size: count <= 3 ? 20 : 17,
      weight: 800,
      color,
      alpha: progress,
    });
    text(ctx, beat.label, cx, 562, {
      size: count <= 3 ? 33 : count === 4 ? 28 : 25,
      weight: 800,
      color: theme.title,
      alpha: progress,
      maxWidth: width - 36,
    });
    strokeUnderline(
      ctx,
      cx,
      592,
      Math.min(90, width * 0.24),
      progress,
      color,
      3.5,
      style,
      0.9,
    );
    text(ctx, beat.desc, cx, 634, {
      size: count <= 3 ? 22 : 18,
      weight: 500,
      color: theme.subtitle,
      alpha: progress,
      maxWidth: width - 36,
    });
    const lines = wrapLines(
      ctx,
      beat.narration,
      width - 54,
      count <= 3 ? 19 : 16,
      500,
      count <= 3 ? 3 : 2,
    );
    lines.forEach((line, lineIndex) => {
      text(ctx, line, cx, 675 + lineIndex * (count <= 3 ? 26 : 22), {
        size: count <= 3 ? 19 : 16,
        weight: 500,
        color: theme.subtitle,
        alpha: progress * 0.92,
      });
    });
    if (index < count - 1 && progress > 0.6) {
      const next = centers[index + 1];
      const arrowProgress = clamp((progress - 0.6) / 0.4);
      strokeArrow(
        ctx,
        cx + width / 2 + 8,
        520,
        next - width / 2 - 8,
        520,
        arrowProgress,
        theme.cardBorderActive,
        style,
        0.8,
      );
    }
  }
}
