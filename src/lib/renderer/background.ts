import type { ThemePalette } from "../../types/project";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./core";

export function fillGridPattern(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: ThemePalette,
): void {
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 1;
  for (let x = 40; x < width; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 40; y < height; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawGrid(ctx: CanvasRenderingContext2D, theme: ThemePalette): void {
  fillGridPattern(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, theme);
}
