import type { Project } from "../../types/project";
import { THEMES } from "../../data/presets";
import { roundedPath, wrapLines } from "../renderer";
import { text } from "../renderer/core";
import { fillGridPattern } from "../renderer/background";
import { drawIcon } from "../renderer/icons";
import { ensureExportFonts } from "../fonts";

export interface MaterialImage {
  id: string;
  title: string;
  subtitle: string;
  width: number;
  height: number;
  dataUrl: string;
  blob: Blob;
}

function label(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  weight: number | string,
  color: string,
  align: CanvasTextAlign = "left",
) {
  text(ctx, value, x, y, { size, weight, color, align });
}

function badge(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  palette: (typeof THEMES)[string],
) {
  ctx.save();
  ctx.font = `700 18px Pretendard, sans-serif`;
  const width = ctx.measureText(value).width + 44;
  const path = roundedPath(x, y, width, 40, 20);
  ctx.fillStyle = palette.badgeBg;
  ctx.fill(path);
  ctx.strokeStyle = palette.badgeBorder;
  ctx.lineWidth = 2;
  ctx.stroke(path);
  ctx.fillStyle = palette.badgeText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(value, x + width / 2, y + 21);
  ctx.restore();
  return width;
}

function canvasToImage(
  canvas: HTMLCanvasElement,
  id: string,
  title: string,
  subtitle: string,
): Promise<MaterialImage> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("이미지를 생성하지 못했습니다."));
        return;
      }
      resolve({
        id,
        title,
        subtitle,
        width: canvas.width,
        height: canvas.height,
        dataUrl: canvas.toDataURL("image/png"),
        blob,
      });
    }, "image/png");
  });
}

export async function buildMaterials(project: Project): Promise<{
  thumbnail: MaterialImage;
  cards: MaterialImage[];
}> {
  await ensureExportFonts();
  const palette = THEMES[project.themeId] ?? THEMES.paper;
  const thumbnailCanvas = document.createElement("canvas");
  thumbnailCanvas.width = 1280;
  thumbnailCanvas.height = 720;
  const thumb = thumbnailCanvas.getContext("2d");
  if (!thumb) throw new Error("썸네일 캔버스를 초기화하지 못했습니다.");
  fillGridPattern(thumb, 1280, 720, palette);
  badge(thumb, "판서랩 5분 특강", 76, 64, palette);
  label(thumb, project.topic, 78, 180, 52, 900, palette.title);
  label(
    thumb,
    project.scenes[0]?.subtitle ?? "핵심 개념을 손그림으로 정리하는 수업",
    78,
    246,
    24,
    600,
    palette.subtitle,
  );
  project.scenes.slice(0, 3).forEach((scene, index) => {
    const x = 78 + index * 260;
    const beat = scene.beats[0];
    const path = roundedPath(x, 330, 230, 112, 16);
    thumb.fillStyle = palette.cardBg;
    thumb.fill(path);
    thumb.strokeStyle = palette.stepColors[index];
    thumb.lineWidth = 2;
    thumb.stroke(path);
    drawIcon(thumb, beat?.iconType ?? "Lightbulb", {
      cx: x + 46,
      cy: 386,
      size: 44,
      color: palette.stepColors[index],
      lineWidth: 2,
    });
    label(thumb, beat?.label ?? "핵심 개념", x + 88, 366, 19, 800, palette.title);
    label(thumb, beat?.desc ?? "", x + 88, 398, 15, 500, palette.subtitle);
  });
  label(thumb, "STEP 01  개념", 78, 526, 20, 800, palette.stepColors[0]);
  label(thumb, "STEP 02  원리", 78, 562, 20, 800, palette.stepColors[1]);
  label(thumb, "STEP 03  적용", 78, 598, 20, 800, palette.stepColors[2]);
  const stepPanel = roundedPath(890, 316, 310, 310, 28);
  thumb.fillStyle = palette.cardBg;
  thumb.fill(stepPanel);
  thumb.strokeStyle = palette.cardBorderActive;
  thumb.lineWidth = 3;
  thumb.stroke(stepPanel);
  thumb.fillStyle = palette.accent;
  thumb.beginPath();
  thumb.arc(1045, 440, 68, 0, Math.PI * 2);
  thumb.fill();
  label(thumb, "5", 1045, 438, 54, 900, "#ffffff", "center");
  label(thumb, "STEP", 1045, 490, 18, 800, "#ffffff", "center");
  label(thumb, project.scenes.length + "개 장면", 1045, 548, 22, 800, palette.title, "center");
  label(thumb, "한 편의 수업 영상", 1045, 582, 16, 500, palette.subtitle, "center");

  const thumbnail = await canvasToImage(
    thumbnailCanvas,
    "thumbnail",
    project.topic,
    "16:9 유튜브 썸네일",
  );

  const cards: MaterialImage[] = [];
  for (let index = 0; index < project.scenes.length; index += 1) {
    const scene = project.scenes[index];
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    fillGridPattern(ctx, 1080, 1080, palette);
    badge(ctx, `SCENE 0${index + 1}`, 72, 72, palette);
    label(ctx, `${index + 1} / ${project.scenes.length}`, 1008, 92, 18, 700, palette.subtitle, "right");
    const titleLines = wrapLines(ctx, scene.title, 900, 56, 900, 2);
    titleLines.forEach((line, lineIndex) => {
      label(ctx, line, 72, 230 + lineIndex * 68, 56, 900, palette.title);
    });
    const subtitleY = 230 + titleLines.length * 68 + 18;
    const subtitleLines = wrapLines(ctx, scene.subtitle, 900, 24, 500, 2);
    subtitleLines.forEach((line, lineIndex) => {
      label(ctx, line, 72, subtitleY + lineIndex * 34, 24, 500, palette.subtitle);
    });
    const rows = Math.max(1, scene.beats.length);
    const rowStart = subtitleY + 130;
    const rowStep = Math.min(140, (960 - rowStart) / rows);
    scene.beats.forEach((beat, beatIndex) => {
      const y = rowStart + beatIndex * rowStep;
      const radius = rows >= 4 ? 32 : 38;
      ctx.save();
      ctx.strokeStyle = palette.stepColors[beatIndex % palette.stepColors.length];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(112, y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      drawIcon(ctx, beat.iconType, {
        cx: 112,
        cy: y,
        size: rows >= 4 ? 36 : 42,
        color: palette.stepColors[beatIndex % palette.stepColors.length],
        lineWidth: 2,
      });
      label(ctx, beat.label, 172, y - 14, rows >= 4 ? 24 : 28, 800, palette.title);
      label(ctx, beat.desc, 172, y + 20, 19, 500, palette.subtitle);
    });
    label(
      ctx,
      "판서랩 · 교육용 화이트보드 영상 만들기",
      72,
      1008,
      18,
      600,
      palette.muted,
    );
    const card = await canvasToImage(canvas, `card_${index}`, scene.title, `카드뉴스 ${index + 1}장`);
    cards.push(card);
  }

  return { thumbnail, cards };
}
