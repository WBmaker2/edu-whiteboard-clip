import type { Scene, ThemePalette, VisualStyle } from "../../../types/project";
import {
  drawBeatIcon,
  fillProgress,
  roundedPath,
  strokeCardEdge,
  strokeLine,
  strokeRing,
  text,
  wrapLines,
} from "../core";

export function drawInfographic(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  theme: ThemePalette,
  style: VisualStyle,
  bp: (index: number) => number,
): void {
  const count = scene.beats.length;
  const panelProgress = bp(0);
  if (panelProgress > 0) {
    const panel = roundedPath(120, 280, 720, 580, 26);
    fillProgress(ctx, panel, Math.min(1, panelProgress * 1.2), theme.cardBg);
    strokeCardEdge(ctx, 120, 280, 720, 580, 26, panelProgress, theme.cardBorderActive, 3, style, 0.8);

    strokeRing(ctx, {
      cx: 480,
      cy: 500,
      radius: 150,
      progress: panelProgress * 0.9,
      color: theme.cardBorder,
      lineWidth: 2,
      style: "diagram",
      alpha: 0.7,
      startAngle: 0,
      sweep: Math.PI * 2,
    });
    strokeRing(ctx, {
      cx: 480,
      cy: 500,
      radius: 112,
      progress: panelProgress,
      color: theme.accent,
      lineWidth: 5,
      style,
    });
    drawBeatIcon(
      ctx,
      scene.beats[0]?.iconType ?? "Lightbulb",
      480,
      500,
      128,
      theme.accent,
      2.4,
      panelProgress,
      style,
    );
    text(ctx, scene.beats[0]?.label ?? "핵심 개념", 480, 680, {
      size: 34,
      weight: 900,
      color: theme.title,
      alpha: panelProgress,
      maxWidth: 620,
    });
    text(ctx, scene.beats[0]?.desc ?? "", 480, 724, {
      size: 22,
      weight: 500,
      color: theme.subtitle,
      alpha: panelProgress,
      maxWidth: 620,
    });
    text(ctx, "BIG PICTURE", 480, 780, {
      size: 18,
      weight: 700,
      color: theme.accent,
      alpha: panelProgress * 0.9,
    });
  }

  const rows =
    count === 3
      ? [330, 550, 770]
      : Array.from({ length: count }, (_, index) =>
          count <= 1 ? 550 : 300 + (500 / (count - 1)) * index,
        );
  for (let index = 0; index < count; index += 1) {
    const beat = scene.beats[index];
    const y = rows[index];
    const progress = bp(index);
    if (progress <= 0) continue;
    const color = theme.stepColors[index % theme.stepColors.length];
    if (index < count - 1) {
      strokeLine(
        ctx,
        1160,
        y + 58,
        1160,
        rows[index + 1] - 58,
        progress,
        theme.cardBorder,
        2,
        "diagram",
        0.7,
      );
    }
    strokeRing(ctx, {
      cx: 1080,
      cy: y,
      radius: count <= 3 ? 40 : 34,
      progress,
      color,
      lineWidth: 3,
      style,
      startAngle: 0,
      sweep: Math.PI * 2,
    });
    text(ctx, `0${index + 1}`, 1080, y, {
      size: count <= 3 ? 26 : 22,
      weight: 900,
      color,
      alpha: progress,
    });
    drawBeatIcon(
      ctx,
      beat.iconType,
      1250,
      y,
      count <= 3 ? 62 : 50,
      color,
      2,
      progress,
      style,
    );
    text(ctx, beat.label, 1310, y - 22, {
      size: count <= 3 ? 30 : 25,
      weight: 800,
      color: theme.title,
      align: "left",
      alpha: progress,
      maxWidth: 480,
    });
    text(ctx, beat.desc, 1310, y + 22, {
      size: count <= 3 ? 21 : 18,
      weight: 500,
      color: theme.subtitle,
      align: "left",
      alpha: progress,
      maxWidth: 480,
    });
    if (count <= 3) {
      const lines = wrapLines(ctx, beat.narration, 480, 18, 500, 2);
      lines.forEach((line, lineIndex) => {
        text(ctx, line, 1310, y + 58 + lineIndex * 24, {
          size: 18,
          weight: 500,
          color: theme.subtitle,
          align: "left",
          alpha: progress * 0.85,
        });
      });
    }
  }
}
