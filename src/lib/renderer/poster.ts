import type { ThemeId } from "../../types/project";
import {
  CANVAS_WIDTH,
  drawBadge,
  drawBeatIcon,
  strokeRing,
  strokeUnderline,
  text,
  themeOf,
} from "./core";
import { drawGrid } from "./background";

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
  strokeUnderline(ctx, CANVAS_WIDTH / 2, 252, 360, 1, theme.accent, 6, "diagram");
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
    strokeRing(ctx, {
      cx: node.x,
      cy: 540,
      radius: 58,
      progress: 1,
      color,
      lineWidth: 4,
      style: "diagram",
    });
    drawBeatIcon(ctx, node.icon, node.x, 540, 74, color, 2, 1, "diagram");
    text(ctx, node.label, node.x, 680, {
      size: 36,
      weight: 800,
      color: theme.title,
    });
    strokeUnderline(ctx, node.x, 712, 110, 1, color, 3.5, "diagram", 0.9);
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
