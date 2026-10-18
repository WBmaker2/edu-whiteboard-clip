import {
  Atom,
  BatteryCharging,
  BookOpen,
  Brain,
  BrainCircuit,
  ChartLine,
  Check,
  Clock,
  Coffee,
  Cpu,
  Dna,
  Droplets,
  FlaskConical,
  Globe2,
  HeartPulse,
  Leaf,
  Lightbulb,
  Magnet,
  Rocket,
  Scale,
  Settings,
  ShieldCheck,
  Star,
  Sun,
  Target,
  Zap,
} from "lucide";
import { ICON_FALLBACK } from "../../data/presets";

type IconChild = [string, Record<string, string>];
type IconNode = ["svg", Record<string, string>, IconChild[]];

const iconRegistry: Record<string, IconNode> = {
  Atom,
  BatteryCharging,
  BookOpen,
  Brain,
  BrainCircuit,
  ChartLine,
  Check,
  Clock,
  Coffee,
  Cpu,
  Dna,
  Droplets,
  FlaskConical,
  Globe2,
  HeartPulse,
  Leaf,
  Lightbulb,
  Magnet,
  Rocket,
  Scale,
  Settings,
  ShieldCheck,
  Star,
  Sun,
  Target,
  Zap,
} as unknown as Record<string, IconNode>;

function readNumber(value: string | undefined, fallback = 0): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export type LucideIconNode = IconNode;

export function rawIconNode(name: string): IconNode {
  return iconRegistry[name] ?? iconRegistry[ICON_FALLBACK];
}

function traceChild(
  ctx: CanvasRenderingContext2D,
  child: IconChild,
  path: Path2D,
): void {
  const [tag, attrs] = child;
  switch (tag) {
    case "path": {
      if (attrs.d) path.addPath(new Path2D(attrs.d));
      break;
    }
    case "circle": {
      path.moveTo(
        readNumber(attrs.cx) + readNumber(attrs.r),
        readNumber(attrs.cy),
      );
      path.arc(
        readNumber(attrs.cx),
        readNumber(attrs.cy),
        readNumber(attrs.r),
        0,
        Math.PI * 2,
      );
      break;
    }
    case "ellipse": {
      path.moveTo(
        readNumber(attrs.cx) + readNumber(attrs.rx),
        readNumber(attrs.cy),
      );
      path.ellipse(
        readNumber(attrs.cx),
        readNumber(attrs.cy),
        readNumber(attrs.rx),
        readNumber(attrs.ry),
        0,
        0,
        Math.PI * 2,
      );
      break;
    }
    case "line": {
      path.moveTo(readNumber(attrs.x1), readNumber(attrs.y1));
      path.lineTo(readNumber(attrs.x2), readNumber(attrs.y2));
      break;
    }
    case "rect": {
      const x = readNumber(attrs.x);
      const y = readNumber(attrs.y);
      const w = readNumber(attrs.width);
      const h = readNumber(attrs.height);
      const r = readNumber(attrs.rx);
      if (r > 0) {
        path.moveTo(x + r, y);
        path.arcTo(x + w, y, x + w, y + h, r);
        path.arcTo(x + w, y + h, x, y + h, r);
        path.arcTo(x, y + h, x, y, r);
        path.arcTo(x, y, x + w, y, r);
        path.closePath();
      } else {
        path.rect(x, y, w, h);
      }
      break;
    }
    case "polyline":
    case "polygon": {
      const points = (attrs.points ?? "")
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      for (let i = 0; i + 1 < points.length; i += 2) {
        if (i === 0) path.moveTo(points[0], points[1]);
        else path.lineTo(points[i], points[i + 1]);
      }
      if (tag === "polygon") path.closePath();
      break;
    }
    default:
      break;
  }
}

export interface IconDrawOptions {
  cx: number;
  cy: number;
  size: number;
  color: string;
  lineWidth?: number;
  progress?: number;
  alpha?: number;
  glow?: boolean;
  fill?: string | null;
  strokeOnly?: boolean;
}

export function drawIcon(
  ctx: CanvasRenderingContext2D,
  name: string,
  options: IconDrawOptions,
): void {
  const node = iconRegistry[name] ?? iconRegistry[ICON_FALLBACK];
  if (!node) return;
  const progress = options.progress ?? 1;
  if (progress <= 0) return;
  const alpha = (options.alpha ?? 1) * Math.min(1, progress * 1.4);
  const scale = (options.size / 24) * (0.85 + 0.15 * Math.min(1, progress));
  const path = new Path2D();
  for (const child of node[2]) traceChild(ctx, child, path);

  ctx.save();
  ctx.translate(options.cx, options.cy);
  ctx.scale(scale, scale);
  ctx.translate(-12, -12);
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = (options.lineWidth ?? 2) / scale;
  ctx.strokeStyle = options.color;
  if (options.glow) {
    ctx.shadowColor = options.color;
    ctx.shadowBlur = 18 / scale;
  }
  if (options.fill) {
    ctx.fillStyle = options.fill;
    ctx.fill(path);
  }
  if (!options.strokeOnly) ctx.stroke(path);
  ctx.restore();
}

export function hasIcon(name: string): boolean {
  return Boolean(iconRegistry[name]);
}
