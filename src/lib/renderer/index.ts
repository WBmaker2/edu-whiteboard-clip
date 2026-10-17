import type {
  LayoutStyle,
  Scene,
  ThemePalette,
  ThemeId,
  VisualStyle,
} from "../../types/project";
import { activeBeatIndex, clamp, easeOutCubic } from "../time";
import { drawIcon } from "./icons";
import { THEMES } from "../../data/presets";

export interface SceneRenderOptions {
  themeId: ThemeId;
  visualStyle: VisualStyle;
  layoutStyle: LayoutStyle;
  captions: boolean;
  captionText?: string;
  sceneIndex?: number;
  revealLimit?: number | "all";
}

export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;

export function themeOf(id: ThemeId): ThemePalette {
  return THEMES[id] ?? THEMES.paper;
}

function font(weight: number | string, size: number): string {
  return `${weight} ${size}px Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
}

export function roundedPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): Path2D {
  const path = new Path2D();
  const radius = Math.min(r, w / 2, h / 2);
  path.moveTo(x + radius, y);
  path.arcTo(x + w, y, x + w, y + h, radius);
  path.arcTo(x + w, y + h, x, y + h, radius);
  path.arcTo(x, y + h, x, y, radius);
  path.arcTo(x, y, x + w, y, radius);
  path.closePath();
  return path;
}

function strokeSketch(
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

function linePath(x1: number, y1: number, x2: number, y2: number): Path2D {
  const path = new Path2D();
  path.moveTo(x1, y1);
  path.lineTo(x2, y2);
  return path;
}

function arrowPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { line: Path2D; head: Path2D } {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 18;
  const line = linePath(x1, y1, x2, y2);
  const head = new Path2D();
  head.moveTo(x2 - size * Math.cos(angle - 0.5), y2 - size * Math.sin(angle - 0.5));
  head.lineTo(x2, y2);
  head.lineTo(x2 - size * Math.cos(angle + 0.5), y2 - size * Math.sin(angle + 0.5));
  return { line, head };
}

function underlinePath(cx: number, y: number, halfWidth: number): Path2D {
  const path = new Path2D();
  path.moveTo(cx - halfWidth, y);
  path.quadraticCurveTo(cx, y + 9, cx + halfWidth, y - 3);
  return path;
}

function text(
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
  const words = String(value ?? "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
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

function drawGrid(ctx: CanvasRenderingContext2D, theme: ThemePalette): void {
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.save();
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  for (let x = 40; x < CANVAS_WIDTH; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let y = 40; y < CANVAS_HEIGHT; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  theme: ThemePalette,
  label: string,
  cy: number,
  progress: number,
): void {
  const width = Math.max(280, label.length * 24 + 80);
  const path = roundedPath(CANVAS_WIDTH / 2 - width / 2, cy - 24, width, 48, 24);
  ctx.save();
  ctx.globalAlpha = progress;
  ctx.fillStyle = theme.badgeBg;
  ctx.fill(path);
  strokeSketch(ctx, path, progress, theme.badgeBorder, 2, "diagram", 0.9);
  ctx.restore();
  text(ctx, label, CANVAS_WIDTH / 2, cy, {
    size: 20,
    weight: 700,
    color: theme.badgeText,
    alpha: progress,
  });
}

function beatProgress(
  scene: Scene,
  index: number,
  time: number,
  revealLimit?: number | "all",
): number {
  if (revealLimit !== undefined) {
    if (revealLimit === "all") return 1;
    return index < revealLimit ? 1 : 0;
  }
  const window = scene.windows[index];
  if (!window) return 1;
  const [start, end] = window;
  if (time < start - 0.05) return 0;
  const raw = clamp((time - start) / Math.max(0.35, Math.min(0.9, (end - start) * 0.5)));
  return easeOutCubic(raw);
}

function drawCaption(
  ctx: CanvasRenderingContext2D,
  theme: ThemePalette,
  value: string,
  alpha: number,
): void {
  const lines = wrapLines(ctx, value, 1500, 30, 600, 2);
  const height = 46 + lines.length * 40;
  const width = 1560;
  const x = CANVAS_WIDTH / 2 - width / 2;
  const y = CANVAS_HEIGHT - height - 36;
  const path = roundedPath(x, y, width, height, 18);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = theme.subtitleBarBg;
  ctx.fill(path);
  ctx.restore();
  lines.forEach((line, index) => {
    text(ctx, line, CANVAS_WIDTH / 2, y + 40 + index * 40, {
      size: 30,
      weight: 600,
      color: theme.subtitleText,
      alpha,
    });
  });
}

function drawSceneHeader(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  time: number,
  theme: ThemePalette,
  style: VisualStyle,
): void {
  const titleProgress = easeOutCubic(clamp(time / 0.9));
  const underlineProgress = easeOutCubic(clamp((time - 0.45) / 0.7));
  text(ctx, scene.title, CANVAS_WIDTH / 2, 100, {
    size: 52,
    weight: 900,
    color: theme.title,
    alpha: titleProgress,
  });
  strokeSketch(
    ctx,
    underlinePath(CANVAS_WIDTH / 2, 146, 260),
    underlineProgress,
    theme.accent,
    5,
    style,
    0.95,
  );
  text(ctx, scene.subtitle, CANVAS_WIDTH / 2, 196, {
    size: 25,
    weight: 600,
    color: theme.subtitle,
    alpha: easeOutCubic(clamp((time - 0.6) / 0.8)),
  });
}


interface NodeSlot {
  x: number;
  radius: number;
  iconSize: number;
  labelSize: number;
  descSize: number;
  slot: number;
}

function nodeLayout(count: number): NodeSlot[] {
  const safe = Math.max(1, count);
  const slot = 1680 / safe;
  return Array.from({ length: safe }, (_, index) => ({
    x: 120 + slot / 2 + index * slot,
    radius: safe <= 3 ? 60 : safe === 4 ? 48 : 42,
    iconSize: safe <= 3 ? 76 : safe === 4 ? 60 : 52,
    labelSize: safe <= 3 ? 34 : safe === 4 ? 29 : 25,
    descSize: safe <= 3 ? 23 : safe === 4 ? 20 : 18,
    slot,
  }));
}

function cardLayout(count: number): { width: number; gap: number; centers: number[] } {
  const width = count <= 2 ? 520 : count === 3 ? 420 : count === 4 ? 380 : 310;
  const gap = count <= 2 ? 80 : count === 3 ? 40 : count === 4 ? 28 : 20;
  const total = count * width + Math.max(0, count - 1) * gap;
  const start = (CANVAS_WIDTH - total) / 2;
  const centers = Array.from(
    { length: count },
    (_, index) => start + width / 2 + index * (width + gap),
  );
  return { width, gap, centers };
}

function drawIntro(
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
  strokeSketch(
    ctx,
    underlinePath(CANVAS_WIDTH / 2, 252, 310),
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
    const ring = new Path2D();
    ring.arc(slot.x, 530, slot.radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.85);
    strokeSketch(ctx, ring, progress, color, 3.5, style);
    drawIcon(ctx, beat.iconType, {
      cx: slot.x,
      cy: 530,
      size: slot.iconSize,
      color,
      lineWidth: 2,
      progress,
      glow: style === "illustration",
    });
    text(ctx, beat.label, slot.x, 664, {
      size: slot.labelSize,
      weight: 800,
      color: theme.title,
      alpha: progress,
      maxWidth: slot.slot - 26,
    });
    strokeSketch(
      ctx,
      underlinePath(slot.x, 694, Math.min(92, slot.radius * 1.5)),
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
      const arrow = arrowPath(
        slot.x + slot.radius + 16,
        530,
        next.x - next.radius - 16,
        530,
      );
      const arrowProgress = clamp((progress - 0.65) / 0.35);
      strokeSketch(ctx, arrow.line, arrowProgress, theme.cardBorderActive, 4, style, 0.85);
      strokeSketch(ctx, arrow.head, arrowProgress, theme.cardBorderActive, 4, style, 0.85);
    }
  }

  text(ctx, "세 가지 핵심 장면을 순서대로 따라가 봅니다", CANVAS_WIDTH / 2, 872, {
    size: 24,
    weight: 700,
    color: theme.accent,
    alpha: easeOutCubic(clamp((time - 1.4) / 1)),
  });
}

function drawOutro(
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
  strokeSketch(
    ctx,
    underlinePath(CANVAS_WIDTH / 2, 246, 280),
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
    const ring = new Path2D();
    ring.arc(slot.x, 505, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.85);
    strokeSketch(ctx, ring, progress, color, 3.5, style);
    drawIcon(ctx, beat.iconType, {
      cx: slot.x,
      cy: 505,
      size: slot.iconSize - 8,
      color,
      lineWidth: 2,
      progress,
      glow: style === "illustration",
    });
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
    strokeSketch(
      ctx,
      underlinePath(slot.x, 676, Math.min(90, radius * 1.5)),
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

function drawFlow(
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
    ctx.save();
    ctx.globalAlpha = Math.min(1, progress * 1.2);
    ctx.fillStyle = theme.cardBg;
    ctx.fill(card);
    ctx.restore();
    strokeSketch(ctx, card, progress, color, 3, style, 0.85);

    const iconRadius = count <= 3 ? 56 : 48;
    const ring = new Path2D();
    ring.arc(cx, 420, iconRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.85);
    strokeSketch(ctx, ring, progress, color, 3.5, style);
    drawIcon(ctx, beat.iconType, {
      cx,
      cy: 420,
      size: count <= 3 ? 68 : 56,
      color,
      lineWidth: 2,
      progress,
      glow: style === "illustration",
    });
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
    strokeSketch(
      ctx,
      underlinePath(cx, 592, Math.min(90, width * 0.24)),
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
      const arrow = arrowPath(cx + width / 2 + 8, 520, next - width / 2 - 8, 520);
      const arrowProgress = clamp((progress - 0.6) / 0.4);
      strokeSketch(ctx, arrow.line, arrowProgress, theme.cardBorderActive, 4, style, 0.8);
      strokeSketch(ctx, arrow.head, arrowProgress, theme.cardBorderActive, 4, style, 0.8);
    }
  }
}

function drawMindmap(
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
    strokeSketch(
      ctx,
      linePath(centerX, centerY, anchor.x, anchor.y),
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
    const ring = new Path2D();
    ring.arc(centerX, centerY, count >= 4 ? 100 : 112, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.85);
    strokeSketch(ctx, ring, centerProgress, theme.accent, 5, style);
    drawIcon(ctx, scene.beats[middleIndex]?.iconType ?? "Lightbulb", {
      cx: centerX,
      cy: centerY - 12,
      size: count >= 4 ? 82 : 96,
      color: theme.accent,
      lineWidth: 2.2,
      progress: centerProgress,
      glow: style === "illustration",
    });
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
    const radius = count >= 4 ? 48 : 58;
    const ring = new Path2D();
    ring.arc(anchor.x, anchor.y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.85);
    strokeSketch(ctx, ring, progress, color, 3.5, style);
    drawIcon(ctx, beat.iconType, {
      cx: anchor.x,
      cy: anchor.y,
      size: count >= 4 ? 56 : 66,
      color,
      lineWidth: 2,
      progress,
      glow: style === "illustration",
    });
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

function drawComparison(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  theme: ThemePalette,
  style: VisualStyle,
  bp: (index: number) => number,
): void {
  const count = scene.beats.length;
  if (count >= 4) {
    strokeSketch(
      ctx,
      linePath(960, 280, 960, 850),
      easeOutCubic(clamp(bp(0) * 1.1)),
      theme.cardBorder,
      2,
      "diagram",
      0.75,
    );
    const vs = new Path2D();
    vs.arc(960, 560, 42, 0, Math.PI * 2);
    strokeSketch(ctx, vs, bp(0), theme.accent, 3.5, style);
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
      const ring = new Path2D();
      ring.arc(spot.x, spot.y, 58, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.85);
      strokeSketch(ctx, ring, progress, color, 3.5, style);
      drawIcon(ctx, beat.iconType, {
        cx: spot.x,
        cy: spot.y,
        size: 64,
        color,
        lineWidth: 2,
        progress,
        glow: style === "illustration",
      });
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

  strokeSketch(
    ctx,
    linePath(960, 270, 960, 830),
    easeOutCubic(clamp(bp(0) * 1.1)),
    theme.cardBorder,
    3,
    "diagram",
    0.9,
  );
  const vs = new Path2D();
  vs.arc(960, 540, 48, 0, Math.PI * 2);
  strokeSketch(ctx, vs, bp(0), theme.accent, 3.5, style);
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
    const ring = new Path2D();
    ring.arc(side.x, 500, 92, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.85);
    strokeSketch(ctx, ring, progress, side.color, 4, style);
    drawIcon(ctx, beat.iconType, {
      cx: side.x,
      cy: 500,
      size: 108,
      color: side.color,
      lineWidth: 2.2,
      progress,
      glow: style === "illustration",
    });
    const badgePath = roundedPath(side.x - 130, 620, 260, 42, 21);
    ctx.save();
    ctx.globalAlpha = progress;
    ctx.fillStyle = side.color;
    ctx.fill(badgePath);
    ctx.restore();
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
      ctx.save();
      ctx.globalAlpha = progress;
      ctx.fillStyle = theme.cardBg;
      ctx.fill(strip);
      ctx.restore();
      strokeSketch(ctx, strip, progress, theme.accent, 2.5, style, 0.8);
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

function drawInfographic(
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
    ctx.save();
    ctx.globalAlpha = Math.min(1, panelProgress * 1.2);
    ctx.fillStyle = theme.cardBg;
    ctx.fill(panel);
    ctx.restore();
    strokeSketch(ctx, panel, panelProgress, theme.cardBorderActive, 3, style, 0.8);

    const halo = new Path2D();
    halo.arc(480, 500, 150, 0, Math.PI * 2);
    strokeSketch(ctx, halo, panelProgress * 0.9, theme.cardBorder, 2, "diagram", 0.7);
    const ring = new Path2D();
    ring.arc(480, 500, 112, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.85);
    strokeSketch(ctx, ring, panelProgress, theme.accent, 5, style);
    drawIcon(ctx, scene.beats[0]?.iconType ?? "Lightbulb", {
      cx: 480,
      cy: 500,
      size: 128,
      color: theme.accent,
      lineWidth: 2.4,
      progress: panelProgress,
      glow: style === "illustration",
    });
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
      strokeSketch(
        ctx,
        linePath(1160, y + 58, 1160, rows[index + 1] - 58),
        progress,
        theme.cardBorder,
        2,
        "diagram",
        0.7,
      );
    }
    const numberRing = new Path2D();
    numberRing.arc(1080, y, count <= 3 ? 40 : 34, 0, Math.PI * 2);
    strokeSketch(ctx, numberRing, progress, color, 3, style);
    text(ctx, `0${index + 1}`, 1080, y, {
      size: count <= 3 ? 26 : 22,
      weight: 900,
      color,
      alpha: progress,
    });
    drawIcon(ctx, beat.iconType, {
      cx: 1250,
      cy: y,
      size: count <= 3 ? 62 : 50,
      color,
      lineWidth: 2,
      progress,
      glow: style === "illustration",
    });
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

function resolveLayout(
  layoutStyle: LayoutStyle,
  sceneIndex: number,
  scene: Scene,
): Exclude<LayoutStyle, "adaptive"> {
  if (layoutStyle !== "adaptive") {
    if (layoutStyle === "comparison" && scene.beats.length > 4) return "flow";
    return layoutStyle;
  }
  const title = scene.title;
  const comparison = scene.beats.length > 4 ? "flow" : "comparison";
  if (sceneIndex <= 1) return "flow";
  if (sceneIndex === 2) return "mindmap";
  if (sceneIndex === 3) return comparison;
  if (title.includes("비교") || title.includes("대조")) return comparison;
  if (title.includes("적용") || title.includes("확장")) return "infographic";
  return "flow";
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  time: number,
  options: SceneRenderOptions,
): void {
  const theme = themeOf(options.themeId);
  const style = options.visualStyle;
  drawGrid(ctx, theme);
  const bp = (index: number) =>
    beatProgress(scene, index, time, options.revealLimit);

  if (scene.type === "intro") {
    drawIntro(ctx, scene, time, theme, style, bp);
  } else if (scene.type === "outro") {
    drawOutro(ctx, scene, time, theme, style, bp);
  } else {
    drawSceneHeader(ctx, scene, time, theme, style);
    const layout = resolveLayout(options.layoutStyle, options.sceneIndex ?? 0, scene);
    if (layout === "mindmap") drawMindmap(ctx, scene, theme, style, bp);
    else if (layout === "comparison") drawComparison(ctx, scene, theme, style, bp);
    else if (layout === "infographic") drawInfographic(ctx, scene, theme, style, bp);
    else drawFlow(ctx, scene, theme, style, bp);
  }

  if (options.captions) {
    const index = options.revealLimit === undefined
      ? activeBeatIndex(scene, time)
      : options.revealLimit === "all"
        ? scene.beats.length - 1
        : Math.max(0, Math.min(scene.beats.length - 1, options.revealLimit - 1));
    const caption =
      options.captionText ?? scene.beats[index]?.narration ?? "";
    if (caption) drawCaption(ctx, theme, caption, 1);
  }
}

export function renderPoster(
  ctx: CanvasRenderingContext2D,
  themeId: ThemeId = "paper",
): void {
  const theme = themeOf(themeId);
  drawGrid(ctx, theme);
  drawBadge(ctx, theme, "판서랩 AI 화이트보드 스튜디오", 110, 1);
  text(ctx, "교육용 화이트보드 영상 만들기", CANVAS_WIDTH / 2, 205, {
    size: 62,
    weight: 900,
    color: theme.title,
  });
  strokeSketch(
    ctx,
    underlinePath(CANVAS_WIDTH / 2, 252, 360),
    1,
    theme.accent,
    6,
    "diagram",
  );
  text(
    ctx,
    "수업 주제만 입력하면 5단계 스토리보드와 손그림 판서가 자동으로 완성됩니다",
    CANVAS_WIDTH / 2,
    300,
    { size: 27, weight: 600, color: theme.subtitle },
  );

  const nodes = [
    { x: 420, icon: "BookOpen", label: "1. 개념 원리 탐구", desc: "기초 개념과 배경 시각화" },
    { x: 960, icon: "Lightbulb", label: "2. 심층 메커니즘", desc: "작동 원리와 상호작용 규명" },
    { x: 1500, icon: "Check", label: "3. 핵심 정리 & 복습", desc: "학습 성과 확인과 요약 정리" },
  ];
  nodes.forEach((node, index) => {
    const color = theme.stepColors[index % theme.stepColors.length];
    const ring = new Path2D();
    ring.arc(node.x, 540, 58, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.85);
    strokeSketch(ctx, ring, 1, color, 4, "diagram");
    drawIcon(ctx, node.icon, {
      cx: node.x,
      cy: 540,
      size: 74,
      color,
      lineWidth: 2,
      progress: 1,
    });
    text(ctx, node.label, node.x, 680, {
      size: 36,
      weight: 800,
      color: theme.title,
    });
    strokeSketch(ctx, underlinePath(node.x, 712, 110), 1, color, 3.5, "diagram", 0.9);
    text(ctx, node.desc, node.x, 754, {
      size: 23,
      weight: 500,
      color: theme.subtitle,
    });
  });
  text(
    ctx,
    "예시 프로젝트를 불러오거나 왼쪽에서 주제를 입력해 시작하세요",
    CANVAS_WIDTH / 2,
    880,
    { size: 26, weight: 700, color: theme.accent },
  );
}
