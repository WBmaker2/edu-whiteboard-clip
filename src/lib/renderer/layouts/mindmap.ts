import type { Scene, ThemePalette, VisualStyle } from "../../../types/project";
import { drawBeatIcon, strokeLine, strokeRing, text } from "../core";

export function drawMindmap(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  theme: ThemePalette,
  style: VisualStyle,
  bp: (index: number) => number,
): void {
  const centerX = 960;
  const centerY = 520;
  const count = scene.beats.length;
  const anchors =
    count === 3
      ? [
          { x: 400, y: 380 },
          { x: 1520, y: 380 },
          { x: 960, y: 760 },
        ]
      : count === 2
        ? [
            { x: 470, y: 420 },
            { x: 1450, y: 700 },
          ]
        : count === 4
          ? [
              { x: 420, y: 420 },
              { x: 1500, y: 420 },
              { x: 420, y: 720 },
              { x: 1500, y: 720 },
            ]
          : [
              { x: 420, y: 390 },
              { x: 1500, y: 390 },
              { x: 360, y: 660 },
              { x: 1560, y: 660 },
              { x: 960, y: 780 },
            ];

  for (let index = 0; index < count; index += 1) {
    const progress = bp(index);
    if (progress <= 0) continue;
    const anchor = anchors[index];
    const color = theme.stepColors[index % theme.stepColors.length];
    strokeLine(
      ctx,
      centerX,
      centerY,
      anchor.x,
      anchor.y,
      progress,
      color,
      3.5,
      style,
      0.7,
    );
  }

  const middleIndex = Math.floor((count - 1) / 2);
  const centerProgress = bp(middleIndex) > 0 ? 1 : bp(0) > 0 ? 0.8 : 0;
  if (centerProgress > 0) {
    strokeRing(ctx, {
      cx: centerX,
      cy: centerY,
      radius: count >= 4 ? 100 : 112,
      progress: centerProgress,
      color: theme.accent,
      lineWidth: 5,
      style,
    });
    drawBeatIcon(
      ctx,
      scene.beats[middleIndex]?.iconType ?? "Lightbulb",
      centerX,
      centerY - 12,
      count >= 4 ? 82 : 96,
      theme.accent,
      2.2,
      centerProgress,
      style,
    );
    text(ctx, "핵심 메커니즘", centerX, centerY + 68, {
      size: count >= 4 ? 24 : 27,
      weight: 900,
      color: theme.title,
      alpha: centerProgress,
    });
  }

  for (let index = 0; index < count; index += 1) {
    const beat = scene.beats[index];
    const anchor = anchors[index];
    const progress = bp(index);
    if (progress <= 0) continue;
    const color = theme.stepColors[index % theme.stepColors.length];
    strokeRing(ctx, {
      cx: anchor.x,
      cy: anchor.y,
      radius: count >= 4 ? 48 : 58,
      progress,
      color,
      lineWidth: 3.5,
      style,
    });
    drawBeatIcon(
      ctx,
      beat.iconType,
      anchor.x,
      anchor.y,
      count >= 4 ? 56 : 66,
      color,
      2,
      progress,
      style,
    );
    const below = anchor.y > centerY;
    const labelY = below
      ? anchor.y + (count >= 4 ? 78 : 96)
      : anchor.y - (count >= 4 ? 110 : 96);
    const descY = below
      ? anchor.y + (count >= 4 ? 108 : 132)
      : anchor.y - (count >= 4 ? 78 : 60);
    text(ctx, beat.label, anchor.x, labelY, {
      size: count >= 4 ? 26 : 31,
      weight: 800,
      color: theme.title,
      alpha: progress,
      maxWidth: 260,
    });
    text(ctx, beat.desc, anchor.x, descY, {
      size: count >= 4 ? 18 : 21,
      weight: 500,
      color: theme.subtitle,
      alpha: progress,
      maxWidth: 260,
    });
  }
}
