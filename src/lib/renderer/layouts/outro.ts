import type { Scene, ThemePalette, VisualStyle } from "../../../types/project";
import { clamp, easeOutCubic } from "../../time";
import {
  CANVAS_WIDTH,
  drawBadge,
  drawBeatIcon,
  strokeRing,
  strokeUnderline,
  text,
} from "../core";
import { nodeLayout } from "./shared";

export function drawOutro(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  time: number,
  theme: ThemePalette,
  style: VisualStyle,
  bp: (index: number) => number,
): void {
  drawBadge(ctx, theme, "핵심 요약 & 학습 정리", 108, easeOutCubic(clamp(time / 0.7)));
  text(ctx, scene.title, CANVAS_WIDTH / 2, 200, {
    size: 56,
    weight: 900,
    color: theme.title,
    alpha: easeOutCubic(clamp(time / 1)),
    maxWidth: 1560,
  });
  strokeUnderline(
    ctx,
    CANVAS_WIDTH / 2,
    246,
    280,
    easeOutCubic(clamp((time - 0.5) / 0.8)),
    theme.accent,
    5,
    style,
  );
  text(ctx, scene.subtitle, CANVAS_WIDTH / 2, 296, {
    size: 26,
    weight: 600,
    color: theme.subtitle,
    alpha: easeOutCubic(clamp((time - 0.7) / 0.8)),
    maxWidth: 1480,
  });

  const slots = nodeLayout(scene.beats.length);
  for (let index = 0; index < slots.length; index += 1) {
    const beat = scene.beats[index];
    const slot = slots[index];
    const progress = bp(index);
    if (progress <= 0) continue;
    const color = theme.stepColors[index % theme.stepColors.length];
    const radius = Math.max(38, slot.radius - 6);
    strokeRing(ctx, {
      cx: slot.x,
      cy: 505,
      radius,
      progress,
      color,
      lineWidth: 3.5,
      style,
    });
    drawBeatIcon(
      ctx,
      beat.iconType,
      slot.x,
      505,
      slot.iconSize - 8,
      color,
      2,
      progress,
      style,
    );
    text(ctx, `핵심 포인트 0${index + 1}`, slot.x, 596, {
      size: slots.length <= 3 ? 21 : 18,
      weight: 800,
      color,
      alpha: progress,
    });
    text(ctx, beat.label, slot.x, 646, {
      size: slot.labelSize,
      weight: 800,
      color: theme.title,
      alpha: progress,
      maxWidth: slot.slot - 26,
    });
    strokeUnderline(
      ctx,
      slot.x,
      676,
      Math.min(90, radius * 1.5),
      progress,
      color,
      3.5,
      style,
      0.9,
    );
    text(ctx, beat.desc, slot.x, 716, {
      size: slot.descSize,
      weight: 500,
      color: theme.subtitle,
      alpha: progress,
      maxWidth: slot.slot - 34,
    });
  }

  text(ctx, "오늘 배운 원리를 한 문장으로 정리해 봅시다", CANVAS_WIDTH / 2, 872, {
    size: 27,
    weight: 800,
    color: theme.accent,
    alpha: easeOutCubic(clamp((time - 1.4) / 1)),
  });
}
