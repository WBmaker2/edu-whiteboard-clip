import type { AspectRatio, ThemeId, ThemePalette, VisualStyle } from "../../types/project";
import { clamp, easeOutCubic } from "../time";
import { THEMES } from "../../data/presets";
import { drawIcon } from "./icons";

export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;
export const VERTICAL_WIDTH = 1080;
export const VERTICAL_HEIGHT = 1920;

export interface CanvasProfile {
  width: number;
  height: number;
  base: number;
}

export function canvasProfile(aspect: AspectRatio = "16:9"): CanvasProfile {
  return aspect === "9:16"
    ? { width: VERTICAL_WIDTH, height: VERTICAL_HEIGHT, base: VERTICAL_WIDTH }
    : { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, base: CANVAS_WIDTH };
}

export function themeOf(id: ThemeId): ThemePalette {
  return THEMES[id] ?? THEMES.paper;
}

export function font(weight: number | string, size: number): string {
  return `${weight} ${size}px Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
}

const CACHE_LIMIT = 4000;
const measureCache = new Map<string, number>();
const pathCache = new Map<string, Path2D>();
const arrowCache = new Map<string, { line: Path2D; head: Path2D }>();

function cacheSet<K, V>(map: Map<K, V>, key: K, value: V): V {
  if (map.size >= CACHE_LIMIT) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
  return value;
}

export function clearTextMeasureCache(): void {
  measureCache.clear();
}

if (typeof document !== "undefined" && document.fonts) {
  document.fonts.addEventListener?.("loadingdone", () => clearTextMeasureCache());
}

export interface SketchTip {
  x: number;
  y: number;
  angle: number;
}

let currentTip: SketchTip | null = null;

export function beginSketchFrame(): void {
  currentTip = null;
}

export function takeSketchTip(): SketchTip | null {
  return currentTip;
}

function markTip(
  x: number,
  y: number,
  progress: number,
  alpha: number,
  angle = 0,
): void {
  if (progress > 0 && progress < 1 && alpha > 0) {
    currentTip = { x, y, angle };
  }
}

export function roundedPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): Path2D {
  const key = `r|${x}|${y}|${w}|${h}|${r}`;
  const hit = pathCache.get(key);
  if (hit) return hit;
  const path = new Path2D();
  const radius = Math.min(r, w / 2, h / 2);
  path.moveTo(x + radius, y);
  path.arcTo(x + w, y, x + w, y + h, radius);
  path.arcTo(x + w, y + h, x, y + h, radius);
  path.arcTo(x, y + h, x, y, radius);
  path.arcTo(x, y, x + w, y, radius);
  path.closePath();
  return cacheSet(pathCache, key, path);
}

function roundedPathTip(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  progress: number,
): SketchTip {
  const radius = Math.min(r, w / 2, h / 2);
  const straightW = Math.max(0, w - 2 * radius);
  const straightH = Math.max(0, h - 2 * radius);
  const arcLen = (Math.PI * radius) / 2;
  const segments = [
    straightW,
    arcLen,
    straightH,
    arcLen,
    straightW,
    arcLen,
    straightH,
    arcLen,
  ];
  const total = segments.reduce((sum, value) => sum + value, 0);
  let remaining = total * clamp(progress);
  const atLine = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    length: number,
  ): SketchTip | null => {
    if (remaining <= length) {
      const t = length > 0 ? remaining / length : 0;
      return {
        x: fromX + (toX - fromX) * t,
        y: fromY + (toY - fromY) * t,
        angle: Math.atan2(toY - fromY, toX - fromX),
      };
    }
    remaining -= length;
    return null;
  };
  const atArc = (
    centerX: number,
    centerY: number,
    startAngle: number,
  ): SketchTip | null => {
    if (remaining <= arcLen) {
      const t = arcLen > 0 ? remaining / arcLen : 0;
      const angle = startAngle + (Math.PI / 2) * t;
      return {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        angle: angle + Math.PI / 2,
      };
    }
    remaining -= arcLen;
    return null;
  };

  let tip: SketchTip | null;
  tip = atLine(x + radius, y, x + w - radius, y, straightW);
  if (tip) return tip;
  tip = atArc(x + w - radius, y + radius, -Math.PI / 2);
  if (tip) return tip;
  tip = atLine(x + w, y + radius, x + w, y + h - radius, straightH);
  if (tip) return tip;
  tip = atArc(x + w - radius, y + h - radius, 0);
  if (tip) return tip;
  tip = atLine(x + w - radius, y + h, x + radius, y + h, straightW);
  if (tip) return tip;
  tip = atArc(x + radius, y + h - radius, Math.PI / 2);
  if (tip) return tip;
  tip = atLine(x, y + h - radius, x, y + radius, straightH);
  if (tip) return tip;
  tip = atArc(x + radius, y + radius, Math.PI);
  if (tip) return tip;
  return { x: x + radius, y, angle: 0 };
}

export function linePath(x1: number, y1: number, x2: number, y2: number): Path2D {
  const key = `l|${x1}|${y1}|${x2}|${y2}`;
  const hit = pathCache.get(key);
  if (hit) return hit;
  const path = new Path2D();
  path.moveTo(x1, y1);
  path.lineTo(x2, y2);
  return cacheSet(pathCache, key, path);
}

export function arrowPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { line: Path2D; head: Path2D } {
  const key = `a|${x1}|${y1}|${x2}|${y2}`;
  const hit = arrowCache.get(key);
  if (hit) return hit;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 18;
  const line = linePath(x1, y1, x2, y2);
  const head = new Path2D();
  head.moveTo(x2 - size * Math.cos(angle - 0.5), y2 - size * Math.sin(angle - 0.5));
  head.lineTo(x2, y2);
  head.lineTo(x2 - size * Math.cos(angle + 0.5), y2 - size * Math.sin(angle + 0.5));
  return cacheSet(arrowCache, key, { line, head });
}

export function underlinePath(cx: number, y: number, halfWidth: number): Path2D {
  const key = `u|${cx}|${y}|${halfWidth}`;
  const hit = pathCache.get(key);
  if (hit) return hit;
  const path = new Path2D();
  path.moveTo(cx - halfWidth, y);
  path.quadraticCurveTo(cx, y + 9, cx + halfWidth, y - 3);
  return cacheSet(pathCache, key, path);
}

export function strokeSketch(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  progress: number,
  color: string,
  lineWidth: number,
  style: VisualStyle = "diagram",
  alpha = 1,
): void {
  const p = clamp(progress);
  if (p <= 0 || alpha <= 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const width = style === "marker" ? lineWidth * 1.45 : lineWidth;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (style === "illustration") {
    ctx.shadowColor = color;
    ctx.shadowBlur = width * 2.2;
  }
  const dash = 6000;
  ctx.setLineDash([dash, dash]);
  ctx.lineDashOffset = dash * (1 - p);
  ctx.stroke(path);
  if (style === "marker") {
    ctx.shadowBlur = 0;
    ctx.globalAlpha = alpha * 0.32;
    ctx.lineDashOffset = 0;
    ctx.translate(2.2, -1.4);
    ctx.stroke(path);
  }
  ctx.restore();
}

export interface RingOptions {
  cx: number;
  cy: number;
  radius: number;
  progress: number;
  color: string;
  lineWidth: number;
  style?: VisualStyle;
  alpha?: number;
  startAngle?: number;
  sweep?: number;
  tip?: boolean;
}

export function strokeRing(ctx: CanvasRenderingContext2D, options: RingOptions): void {
  const start = options.startAngle ?? -Math.PI / 2;
  const sweep = options.sweep ?? Math.PI * 1.85;
  const key = `c|${options.cx}|${options.cy}|${options.radius}|${start}|${sweep}`;
  let path = pathCache.get(key);
  if (!path) {
    path = new Path2D();
    path.arc(options.cx, options.cy, options.radius, start, start + sweep);
    cacheSet(pathCache, key, path);
  }
  if (options.tip !== false) {
    const t = clamp(options.progress);
    const angle = start + sweep * t;
    markTip(
      options.cx + options.radius * Math.cos(angle),
      options.cy + options.radius * Math.sin(angle),
      options.progress,
      options.alpha ?? 1,
      angle + Math.PI / 2,
    );
  }
  strokeSketch(
    ctx,
    path,
    options.progress,
    options.color,
    options.lineWidth,
    options.style ?? "diagram",
    options.alpha ?? 1,
  );
}

export function strokeLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  progress: number,
  color: string,
  lineWidth: number,
  style: VisualStyle = "diagram",
  alpha = 1,
): void {
  const path = linePath(x1, y1, x2, y2);
  const p = clamp(progress);
  markTip(
    x1 + (x2 - x1) * p,
    y1 + (y2 - y1) * p,
    progress,
    alpha,
    Math.atan2(y2 - y1, x2 - x1),
  );
  strokeSketch(ctx, path, progress, color, lineWidth, style, alpha);
}

export function strokeUnderline(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  halfWidth: number,
  progress: number,
  color: string,
  lineWidth: number,
  style: VisualStyle = "diagram",
  alpha = 1,
): void {
  const path = underlinePath(cx, y, halfWidth);
  const t = clamp(progress);
  const mt = 1 - t;
  markTip(
    mt * mt * (cx - halfWidth) + 2 * mt * t * cx + t * t * (cx + halfWidth),
    mt * mt * y + 2 * mt * t * (y + 9) + t * t * (y - 3),
    progress,
    alpha,
    Math.atan2(9 - 21 * t, Math.max(1, halfWidth)),
  );
  strokeSketch(ctx, path, progress, color, lineWidth, style, alpha);
}

export function strokeArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  progress: number,
  color: string,
  style: VisualStyle = "diagram",
  alpha = 1,
  lineWidth = 4,
): void {
  const { line, head } = arrowPath(x1, y1, x2, y2);
  const p = clamp(progress);
  markTip(
    x1 + (x2 - x1) * p,
    y1 + (y2 - y1) * p,
    progress,
    alpha,
    Math.atan2(y2 - y1, x2 - x1),
  );
  strokeSketch(ctx, line, progress, color, lineWidth, style, alpha);
  strokeSketch(ctx, head, progress, color, lineWidth, style, alpha);
}

export function strokeCardEdge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  progress: number,
  color: string,
  lineWidth: number,
  style: VisualStyle = "diagram",
  alpha = 1,
): void {
  const path = roundedPath(x, y, w, h, r);
  const tip = roundedPathTip(x, y, w, h, r, progress);
  markTip(tip.x, tip.y, progress, alpha, tip.angle);
  strokeSketch(ctx, path, progress, color, lineWidth, style, alpha);
}

export function fillProgress(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  alpha: number,
  color: string,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill(path);
  ctx.restore();
}

export function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  options: {
    size: number;
    weight?: number | string;
    color: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    alpha?: number;
    maxWidth?: number;
  },
): void {
  ctx.save();
  ctx.font = font(options.weight ?? 500, options.size);
  ctx.fillStyle = options.color;
  ctx.textAlign = options.align ?? "center";
  ctx.textBaseline = options.baseline ?? "middle";
  ctx.globalAlpha = options.alpha ?? 1;
  if (options.maxWidth) ctx.fillText(value, x, y, options.maxWidth);
  else ctx.fillText(value, x, y);
  ctx.restore();
}

export function wrapLines(
  ctx: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  size: number,
  weight: number | string = 500,
  maxLines = 2,
): string[] {
  ctx.save();
  ctx.font = font(weight, size);
  const measure = (textValue: string): number => {
    const key = `${weight}|${size}|${textValue}`;
    const hit = measureCache.get(key);
    if (hit !== undefined) return hit;
    const width = ctx.measureText(textValue).width;
    cacheSet(measureCache, key, width);
    return width;
  };
  const words = String(value ?? "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  ctx.restore();
  return lines.length ? lines : [""];
}

export function drawBeatIcon(
  ctx: CanvasRenderingContext2D,
  iconType: string,
  cx: number,
  cy: number,
  size: number,
  color: string,
  lineWidth: number,
  progress: number,
  style: VisualStyle,
): void {
  drawIcon(ctx, iconType, {
    cx,
    cy,
    size,
    color,
    lineWidth,
    progress,
    glow: style === "illustration",
  });
}

export function drawBadge(
  ctx: CanvasRenderingContext2D,
  theme: ThemePalette,
  label: string,
  cy: number,
  progress: number,
  centerX = CANVAS_WIDTH / 2,
): void {
  const width = Math.max(280, label.length * 24 + 80);
  const x = centerX - width / 2;
  const path = roundedPath(x, cy - 24, width, 48, 24);
  fillProgress(ctx, path, progress, theme.badgeBg);
  const tip = roundedPathTip(x, cy - 24, width, 48, 24, progress);
  markTip(tip.x, tip.y, progress, 1, tip.angle);
  strokeSketch(ctx, path, progress, theme.badgeBorder, 2, "diagram", 0.9);
  text(ctx, label, centerX, cy, {
    size: 20,
    weight: 700,
    color: theme.badgeText,
    alpha: progress,
  });
}

export function drawPenNib(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  angle = 0,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI + 0.38);
  const body = new Path2D();
  body.moveTo(0, 0);
  body.lineTo(7, -26);
  body.lineTo(15, -29);
  body.lineTo(33, -47);
  body.lineTo(55, -25);
  body.lineTo(37, -7);
  body.lineTo(34, 1);
  body.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.92;
  ctx.fill(body);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(6, -22);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(15, -29);
  ctx.lineTo(22, -22);
  ctx.lineTo(37, -7);
  ctx.stroke();
  ctx.restore();
}

export interface DecodedVisual {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export interface VisualSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  rotate?: number;
}

export function drawBeatVisual(
  ctx: CanvasRenderingContext2D,
  visual: DecodedVisual,
  slot: VisualSlot,
  progress: number,
): void {
  const p = clamp(progress);
  if (p <= 0 || visual.width <= 0 || visual.height <= 0) return;
  const appear = easeOutCubic(p);
  const fit = Math.min(slot.width / visual.width, slot.height / visual.height);
  const w = visual.width * fit;
  const h = visual.height * fit;
  const pad = 9;
  const captionSpace = 4;
  const frameW = w + pad * 2;
  const frameH = h + pad * 2 + captionSpace;
  ctx.save();
  ctx.globalAlpha = Math.min(1, appear * 1.25);
  ctx.translate(slot.x, slot.y);
  ctx.rotate(slot.rotate ?? -0.028);
  const scale = 0.9 + 0.1 * appear;
  ctx.scale(scale, scale);
  ctx.shadowColor = "rgba(20, 18, 12, 0.2)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = "#ffffff";
  ctx.fill(roundedPath(-frameW / 2, -frameH / 2, frameW, frameH, 7));
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.save();
  ctx.clip(roundedPath(-w / 2, -h / 2, w, h, 3));
  ctx.drawImage(visual.source, -w / 2, -h / 2, w, h);
  ctx.restore();
  ctx.strokeStyle = "rgba(25, 27, 31, 0.08)";
  ctx.lineWidth = 1;
  ctx.stroke(roundedPath(-frameW / 2, -frameH / 2, frameW, frameH, 7));
  ctx.fillStyle = "rgba(216, 206, 174, 0.78)";
  ctx.save();
  ctx.translate(-frameW / 2 + 18, -frameH / 2 + 2);
  ctx.rotate(-0.55);
  ctx.fillRect(-20, -8, 40, 16);
  ctx.restore();
  ctx.save();
  ctx.translate(frameW / 2 - 18, -frameH / 2 + 2);
  ctx.rotate(0.55);
  ctx.fillRect(-20, -8, 40, 16);
  ctx.restore();
  ctx.restore();
}
