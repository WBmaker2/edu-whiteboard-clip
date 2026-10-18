import type { Scene, ThemePalette, VisualStyle } from "../../../types/project";
import { clamp, easeOutCubic } from "../../time";
import {
  CANVAS_WIDTH,
  drawBadge,
  drawBeatIcon,
  strokeArrow,
  strokeRing,
  strokeUnderline,
  text,
} from "../core";
import { nodeLayout } from "./shared";

export function drawIntro(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  time: number,
  theme: ThemePalette,
  style: VisualStyle,
  bp: (index: number) => number,
): void {
  drawBadge(ctx, theme, "오늘의 핵심 학습 주제", 108, easeOutCubic(clamp(time / 0.7)));
  text(ctx, scene.title, CANVAS_WIDTH / 2, 205, {
    size: 62,
    weight: 900,
    color: theme.title,
    alpha: easeOutCubic(clamp(time / 1)),
    maxWidth: 1560,
  });
  strokeUnderline(
    ctx,
    CANVAS_WIDTH / 2,
    252,
    310,
    easeOutCubic(clamp((time - 0.5) / 0.8)),
    theme.accent,
    6,
    style,
  );
  text(ctx, scene.subtitle, CANVAS_WIDTH / 2, 300, {
    size: 28,
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
    strokeRing(ctx, {
      cx: slot.x,
      cy: 530,
      radius: slot.radius,
      progress,
      color,
      lineWidth: 3.5,
      style,
    });
    drawBeatIcon(ctx, beat.iconType, slot.x, 530, slot.iconSize, color, 2, progress, style);
    text(ctx, beat.label, slot.x, 664, {
      size: slot.labelSize,
      weight: 800,
      color: theme.title,
      alpha: progress,
      maxWidth: slot.slot - 26,
    });
    strokeUnderline(
      ctx,
      slot.x,
      694,
      Math.min(92, slot.radius * 1.5),
      progress,
      color,
      3.5,
      style,
      0.9,
    );
    text(ctx, beat.desc, slot.x, 734, {
      size: slot.descSize,
      weight: 500,
      color: theme.subtitle,
      alpha: progress,
      maxWidth: slot.slot - 34,
    });
    if (index < slots.length - 1 && progress > 0.65) {
      const next = slots[index + 1];
      const arrowProgress = clamp((progress - 0.65) / 0.35);
      strokeArrow(
        ctx,
        slot.x + slot.radius + 16,
        530,
        next.x - next.radius - 16,
        530,
        arrowProgress,
        theme.cardBorderActive,
        style,
        0.85,
      );
    }
  }

  const countWord =
    ["", "한", "두", "세", "네", "다섯"][scene.beats.length] ?? String(scene.beats.length);
  text(ctx, `${countWord} 가지 핵심 장면을 순서대로 따라가 봅니다`, CANVAS_WIDTH / 2, 872, {
    size: 24,
    weight: 700,
    color: theme.accent,
    alpha: easeOutCubic(clamp((time - 1.4) / 1)),
  });
}
