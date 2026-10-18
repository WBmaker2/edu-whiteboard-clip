import type { Scene, ThemePalette, VisualStyle } from "../../../types/project";
import { clamp, easeOutCubic } from "../../time";
import {
  drawBeatIcon,
  fillProgress,
  roundedPath,
  strokeCardEdge,
  strokeLine,
  strokeRing,
  text,
} from "../core";

export function drawComparison(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  theme: ThemePalette,
  style: VisualStyle,
  bp: (index: number) => number,
): void {
  const count = scene.beats.length;
  if (count >= 4) {
    strokeLine(
      ctx,
      960,
      280,
      960,
      850,
      easeOutCubic(clamp(bp(0) * 1.1)),
      theme.cardBorder,
      2,
      "diagram",
      0.75,
    );
    strokeRing(ctx, {
      cx: 960,
      cy: 560,
      radius: 42,
      progress: bp(0),
      color: theme.accent,
      lineWidth: 3.5,
      style,
      startAngle: 0,
      sweep: Math.PI * 2,
    });
    text(ctx, "VS", 960, 560, {
      size: 23,
      weight: 900,
      color: theme.accent,
      alpha: bp(0),
    });
    const quadrants = [
      { x: 500, y: 400, tag: "A · 작용 전" },
      { x: 1420, y: 400, tag: "B · 작용 후" },
      { x: 500, y: 740, tag: "A · 추가 근거" },
      { x: 1420, y: 740, tag: "B · 추가 근거" },
    ];
    for (let index = 0; index < count && index < 4; index += 1) {
      const beat = scene.beats[index];
      const spot = quadrants[index];
      const progress = bp(index);
      if (progress <= 0) continue;
      const color = theme.stepColors[index % theme.stepColors.length];
      strokeRing(ctx, {
        cx: spot.x,
        cy: spot.y,
        radius: 58,
        progress,
        color,
        lineWidth: 3.5,
        style,
      });
      drawBeatIcon(ctx, beat.iconType, spot.x, spot.y, 64, color, 2, progress, style);
      text(ctx, spot.tag, spot.x, spot.y + 86, {
        size: 16,
        weight: 800,
        color,
        alpha: progress,
      });
      text(ctx, beat.label, spot.x, spot.y + 116, {
        size: 26,
        weight: 800,
        color: theme.title,
        alpha: progress,
        maxWidth: 300,
      });
      text(ctx, beat.desc, spot.x, spot.y + 146, {
        size: 18,
        weight: 500,
        color: theme.subtitle,
        alpha: progress,
        maxWidth: 300,
      });
    }
    return;
  }

  strokeLine(
    ctx,
    960,
    270,
    960,
    830,
    easeOutCubic(clamp(bp(0) * 1.1)),
    theme.cardBorder,
    3,
    "diagram",
    0.9,
  );
  strokeRing(ctx, {
    cx: 960,
    cy: 540,
    radius: 48,
    progress: bp(0),
    color: theme.accent,
    lineWidth: 3.5,
    style,
    startAngle: 0,
    sweep: Math.PI * 2,
  });
  text(ctx, "VS", 960, 540, {
    size: 26,
    weight: 900,
    color: theme.accent,
    alpha: bp(0),
  });

  const sides = [
    { x: 500, badge: "작용 전 (상태 A)", color: theme.stepColors[0] },
    { x: 1420, badge: "작용 후 (상태 B)", color: theme.stepColors[1] },
  ];
  for (let index = 0; index < 2 && index < scene.beats.length; index += 1) {
    const beat = scene.beats[index];
    const side = sides[index];
    const progress = bp(index);
    if (progress <= 0) continue;
    strokeRing(ctx, {
      cx: side.x,
      cy: 500,
      radius: 92,
      progress,
      color: side.color,
      lineWidth: 4,
      style,
    });
    drawBeatIcon(ctx, beat.iconType, side.x, 500, 108, side.color, 2.2, progress, style);
    const badgePath = roundedPath(side.x - 130, 620, 260, 42, 21);
    fillProgress(ctx, badgePath, progress, side.color);
    text(ctx, side.badge, side.x, 641, {
      size: 19,
      weight: 700,
      color: "#ffffff",
      alpha: progress,
    });
    text(ctx, beat.label, side.x, 700, {
      size: 33,
      weight: 800,
      color: theme.title,
      alpha: progress,
      maxWidth: 380,
    });
    text(ctx, beat.desc, side.x, 742, {
      size: 22,
      weight: 500,
      color: theme.subtitle,
      alpha: progress,
      maxWidth: 380,
    });
  }

  if (scene.beats[2]) {
    const progress = bp(2);
    if (progress > 0) {
      const strip = roundedPath(320, 800, 1280, 88, 20);
      fillProgress(ctx, strip, progress, theme.cardBg);
      strokeCardEdge(ctx, 320, 800, 1280, 88, 20, progress, theme.accent, 2.5, style, 0.8);
      text(ctx, `핵심 포인트 · ${scene.beats[2].label}`, 960, 830, {
        size: 25,
        weight: 800,
        color: theme.title,
        alpha: progress,
        maxWidth: 1100,
      });
      text(ctx, scene.beats[2].desc, 960, 864, {
        size: 20,
        weight: 500,
        color: theme.subtitle,
        alpha: progress,
        maxWidth: 1100,
      });
    }
  }
}
