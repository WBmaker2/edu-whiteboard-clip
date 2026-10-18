import type { Scene, ThemeId, ThemePalette, VisualStyle } from "../../types/project";
import { clamp, easeOutCubic } from "../time";
import {
  VERTICAL_HEIGHT,
  VERTICAL_WIDTH,
  drawBadge,
  drawBeatIcon,
  roundedPath,
  strokeLine,
  strokeRing,
  strokeUnderline,
  text,
  themeOf,
  wrapLines,
} from "./core";
import { fillGridPattern } from "./background";

const CENTER_X = VERTICAL_WIDTH / 2;

interface VerticalHeader {
  badgeCy: number | null;
  titleY: number;
  underlineY: number;
  subtitleY: number;
}

function headerFor(scene: Scene): VerticalHeader {
  if (scene.type === "intro" || scene.type === "outro") {
    return { badgeCy: 150, titleY: 270, underlineY: 326, subtitleY: 372 };
  }
  return { badgeCy: null, titleY: 250, underlineY: 306, subtitleY: 352 };
}

export function rowPositions(count: number, compact = false): number[] {
  const safe = Math.max(1, count);
  if (safe === 1) return [compact ? 700 : 760];
  const start = 540;
  const end = compact ? 1310 : 1450;
  return Array.from({ length: safe }, (_, index) => start + ((end - start) / (safe - 1)) * index);
}

function drawVerticalHeader(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  time: number,
  theme: ThemePalette,
  style: VisualStyle,
): void {
  const header = headerFor(scene);
  if (header.badgeCy !== null) {
    drawBadge(
      ctx,
      theme,
      scene.type === "intro" ? "오늘의 핵심 학습 주제" : "핵심 요약 & 학습 정리",
      header.badgeCy,
      easeOutCubic(clamp(time / 0.7)),
      CENTER_X,
    );
  }
  text(ctx, scene.title, CENTER_X, header.titleY, {
    size: 50,
    weight: 900,
    color: theme.title,
    alpha: easeOutCubic(clamp(time / 1)),
    maxWidth: 920,
  });
  strokeUnderline(
    ctx,
    CENTER_X,
    header.underlineY,
    240,
    easeOutCubic(clamp((time - 0.5) / 0.8)),
    theme.accent,
    5,
    style,
  );
  text(ctx, scene.subtitle, CENTER_X, header.subtitleY, {
    size: 24,
    weight: 600,
    color: theme.subtitle,
    alpha: easeOutCubic(clamp((time - 0.7) / 0.8)),
    maxWidth: 900,
  });
}

export function drawVerticalScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  time: number,
  theme: ThemePalette,
  style: VisualStyle,
  bp: (index: number) => number,
): void {
  drawVerticalHeader(ctx, scene, time, theme, style);

  const count = scene.beats.length;
  const rows = rowPositions(count, scene.type !== "body");
  const ringX = 128;
  const ringRadius = 46;

  for (let index = 0; index < count - 1; index += 1) {
    const progress = bp(index);
    if (progress <= 0) continue;
    strokeLine(
      ctx,
      ringX,
      rows[index] + ringRadius + 12,
      ringX,
      rows[index + 1] - ringRadius - 12,
      progress,
      theme.cardBorder,
      2.5,
      "diagram",
      0.65,
    );
  }

  for (let index = 0; index < count; index += 1) {
    const beat = scene.beats[index];
    const progress = bp(index);
    if (progress <= 0) continue;
    const y = rows[index];
    const color = theme.stepColors[index % theme.stepColors.length];
    strokeRing(ctx, {
      cx: ringX,
      cy: y,
      radius: ringRadius,
      progress,
      color,
      lineWidth: 3.5,
      style,
    });
    drawBeatIcon(ctx, beat.iconType, ringX, y, 50, color, 2, progress, style);
    text(ctx, beat.label, 214, y - 18, {
      size: 29,
      weight: 800,
      color: theme.title,
      align: "left",
      alpha: progress,
      maxWidth: 780,
    });
    strokeUnderline(ctx, 340, y + 12, 118, progress, color, 3, style, 0.9);
    text(ctx, beat.desc, 214, y + 44, {
      size: 19,
      weight: 500,
      color: theme.subtitle,
      align: "left",
      alpha: progress,
      maxWidth: 760,
    });
    if (scene.type === "body") {
      const lines = wrapLines(ctx, beat.narration, 760, 17, 500, 1);
      lines.forEach((line, lineIndex) => {
        text(ctx, line, 214, y + 74 + lineIndex * 22, {
          size: 17,
          weight: 500,
          color: theme.subtitle,
          align: "left",
          alpha: progress * 0.85,
        });
      });
    }
  }

  if (scene.type !== "body") {
    const footer =
      scene.type === "intro"
        ? "핵심 장면을 순서대로 따라가 봅니다"
        : "오늘 배운 원리를 한 문장으로 정리해 봅시다";
    text(ctx, footer, CENTER_X, 1472, {
      size: 24,
      weight: 700,
      color: theme.accent,
      alpha: easeOutCubic(clamp((time - 1.4) / 1)),
    });
  }
}

export function renderVerticalPoster(
  ctx: CanvasRenderingContext2D,
  themeId: ThemeId = "paper",
): void {
  const theme = themeOf(themeId);
  fillGridPattern(ctx, VERTICAL_WIDTH, VERTICAL_HEIGHT, theme);
  drawBadge(ctx, theme, "판서랩 AI 화이트보드 스튜디오", 170, 1, CENTER_X);
  text(ctx, "교육용 화이트보드", CENTER_X, 290, {
    size: 52,
    weight: 900,
    color: theme.title,
  });
  text(ctx, "영상 만들기", CENTER_X, 360, {
    size: 52,
    weight: 900,
    color: theme.title,
  });
  strokeUnderline(ctx, CENTER_X, 412, 280, 1, theme.accent, 6, "diagram");
  text(ctx, "수업 주제만 입력하면 5단계 스토리보드와 손그림 판서가 완성됩니다", CENTER_X, 470, {
    size: 23,
    weight: 600,
    color: theme.subtitle,
    maxWidth: 880,
  });

  const nodes = [
    { icon: "BookOpen", label: "1. 개념 원리 탐구", desc: "기초 개념과 배경 시각화" },
    { icon: "Lightbulb", label: "2. 심층 메커니즘", desc: "작동 원리와 상호작용 규명" },
    { icon: "Check", label: "3. 핵심 정리 & 복습", desc: "학습 성과 확인과 요약 정리" },
  ];
  nodes.forEach((node, index) => {
    const color = theme.stepColors[index % theme.stepColors.length];
    const y = 640 + index * 280;
    strokeRing(ctx, {
      cx: 150,
      cy: y,
      radius: 48,
      progress: 1,
      color,
      lineWidth: 4,
      style: "diagram",
    });
    drawBeatIcon(ctx, node.icon, 150, y, 56, color, 2, 1, "diagram");
    text(ctx, node.label, 236, y - 16, {
      size: 30,
      weight: 800,
      color: theme.title,
      align: "left",
      maxWidth: 740,
    });
    strokeUnderline(ctx, 372, y + 14, 120, 1, color, 3, "diagram", 0.9);
    text(ctx, node.desc, 236, y + 46, {
      size: 20,
      weight: 500,
      color: theme.subtitle,
      align: "left",
      maxWidth: 720,
    });
  });
  text(ctx, "예시 프로젝트를 불러오거나 주제를 입력해 시작하세요", CENTER_X, 1560, {
    size: 23,
    weight: 700,
    color: theme.accent,
    maxWidth: 880,
  });
}

export function drawVerticalCaption(
  ctx: CanvasRenderingContext2D,
  theme: ThemePalette,
  value: string,
  alpha: number,
): void {
  const lines = wrapLines(ctx, value, 900, 28, 600, 2);
  const height = 44 + lines.length * 38;
  const y = VERTICAL_HEIGHT - height - 42;
  const path = roundedPath(52, y, VERTICAL_WIDTH - 104, height, 16);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = theme.subtitleBarBg;
  ctx.fill(path);
  ctx.restore();
  lines.forEach((line, index) => {
    text(ctx, line, VERTICAL_WIDTH / 2, y + 38 + index * 38, {
      size: 28,
      weight: 600,
      color: theme.subtitleText,
      alpha,
    });
  });
}
