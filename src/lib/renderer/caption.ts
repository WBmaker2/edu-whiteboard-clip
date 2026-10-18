import type { ThemePalette } from "../../types/project";
import { CANVAS_HEIGHT, CANVAS_WIDTH, roundedPath, text, wrapLines } from "./core";

export interface CaptionLayout {
  centerX?: number;
  canvasHeight?: number;
  boxWidth?: number;
  textMaxWidth?: number;
  bottomOffset?: number;
  fontSize?: number;
  lineStep?: number;
}

export function drawCaption(
  ctx: CanvasRenderingContext2D,
  theme: ThemePalette,
  value: string,
  alpha: number,
  layout: CaptionLayout = {},
): void {
  const centerX = layout.centerX ?? CANVAS_WIDTH / 2;
  const canvasHeight = layout.canvasHeight ?? CANVAS_HEIGHT;
  const boxWidth = layout.boxWidth ?? 1560;
  const textMaxWidth = layout.textMaxWidth ?? 1500;
  const bottomOffset = layout.bottomOffset ?? 36;
  const fontSize = layout.fontSize ?? 30;
  const lineStep = layout.lineStep ?? 40;
  const lines = wrapLines(ctx, value, textMaxWidth, fontSize, 600, 2);
  const height = 46 + lines.length * lineStep;
  const x = centerX - boxWidth / 2;
  const y = canvasHeight - height - bottomOffset;
  const path = roundedPath(x, y, boxWidth, height, 18);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = theme.subtitleBarBg;
  ctx.fill(path);
  ctx.restore();
  lines.forEach((line, index) => {
    text(ctx, line, centerX, y + 40 + index * lineStep, {
      size: fontSize,
      weight: 600,
      color: theme.subtitleText,
      alpha,
    });
  });
}
