import type { Scene, ThemePalette, VisualStyle } from "../../../types/project";
import {
  drawBeatIcon,
  fillProgress,
  roundedPath,
  strokeCardEdge,
  strokeLine,
  strokeRing,
  text,
} from "../core";

export function drawHierarchy(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  theme: ThemePalette,
  style: VisualStyle,
  bp: (index: number) => number,
): void {
  const root = scene.beats[0];
  const children = scene.beats.slice(1);
  const childCount = Math.max(1, children.length);

  const rootX = 960;
  const rootY = 330;
  const childY = 690;

  const rootProgress = bp(0);
  if (rootProgress > 0) {
    const boxW = 460;
    const boxH = 168;
    const path = roundedPath(rootX - boxW / 2, rootY - boxH / 2, boxW, boxH, 22);
    fillProgress(ctx, path, Math.min(1, rootProgress * 1.2), theme.cardBg);
    strokeCardEdge(ctx, rootX - boxW / 2, rootY - boxH / 2, boxW, boxH, 22, rootProgress, theme.cardBorderActive, 3, style, 0.85);
    drawBeatIcon(ctx, root.iconType, rootX, rootY - 24, 52, theme.accent, 2, rootProgress, style);
    text(ctx, root.label, rootX, rootY + 34, {
      size: 30,
      weight: 900,
      color: theme.title,
      alpha: rootProgress,
      maxWidth: boxW - 40,
    });
    text(ctx, root.desc, rootX, rootY + 68, {
      size: 18,
      weight: 500,
      color: theme.subtitle,
      alpha: rootProgress,
      maxWidth: boxW - 40,
    });
  }

  const startX = 300;
  const endX = 1620;
  const step = childCount > 1 ? (endX - startX) / (childCount - 1) : 0;

  for (let index = 0; index < children.length; index += 1) {
    const beat = children[index];
    const progress = bp(index + 1);
    if (progress <= 0) continue;
    const x = childCount > 1 ? startX + step * index : 960;
    const color = theme.stepColors[(index + 1) % theme.stepColors.length];
    const boxW = childCount <= 2 ? 440 : childCount === 3 ? 380 : 300;
    const boxH = 190;
    const top = childY - boxH / 2;

    const midY = (rootY + 84 + top) / 2;
    strokeLine(ctx, rootX, rootY + 84, rootX, midY, Math.min(1, progress * 1.3), color, 2.5, style, 0.6);
    strokeLine(ctx, rootX, midY, x, midY, Math.min(1, progress * 1.3), color, 2.5, style, 0.6);
    strokeLine(ctx, x, midY, x, top, Math.min(1, progress * 1.3), color, 2.5, style, 0.6);

    const path = roundedPath(x - boxW / 2, top, boxW, boxH, 20);
    fillProgress(ctx, path, Math.min(1, progress * 1.2), theme.cardBg);
    strokeCardEdge(ctx, x - boxW / 2, top, boxW, boxH, 20, progress, color, 3, style, 0.85);

    strokeRing(ctx, {
      cx: x,
      cy: top + 52,
      radius: 30,
      progress,
      color,
      lineWidth: 3,
      style,
      startAngle: 0,
      sweep: Math.PI * 2,
    });
    drawBeatIcon(ctx, beat.iconType, x, top + 52, 38, color, 2, progress, style);
    text(ctx, beat.label, x, top + 112, {
      size: childCount <= 2 ? 26 : childCount === 3 ? 23 : 20,
      weight: 800,
      color: theme.title,
      alpha: progress,
      maxWidth: boxW - 32,
    });
    text(ctx, beat.desc, x, top + 146, {
      size: childCount <= 3 ? 18 : 16,
      weight: 500,
      color: theme.subtitle,
      alpha: progress,
      maxWidth: boxW - 32,
    });
  }
}
