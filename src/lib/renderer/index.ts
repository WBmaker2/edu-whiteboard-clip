import type { AspectRatio, LayoutStyle, Scene, SceneLayout, ThemeId, VisualStyle } from "../../types/project";
import { activeBeatIndex, clamp, easeOutCubic } from "../time";
import {
  beginSketchFrame,
  canvasProfile,
  drawBeatVisual,
  drawPenNib,
  takeSketchTip,
  themeOf,
  type DecodedVisual,
  type VisualSlot,
} from "./core";
import { drawGrid, fillGridPattern } from "./background";
import { drawCaption } from "./caption";
import { drawSceneHeader } from "./header";
import { drawComparison } from "./layouts/comparison";
import { drawFlow } from "./layouts/flow";
import { drawInfographic } from "./layouts/infographic";
import { drawIntro } from "./layouts/intro";
import { drawMindmap } from "./layouts/mindmap";
import { drawOutro } from "./layouts/outro";
import { drawTimeline } from "./layouts/timeline";
import { drawCycle } from "./layouts/cycle";
import { drawHierarchy } from "./layouts/hierarchy";
import { drawChart } from "./layouts/chart";
import { drawVenn } from "./layouts/venn";
import { cardLayout, nodeLayout } from "./layouts/shared";
import { drawVerticalCaption, drawVerticalScene, renderVerticalPoster } from "./vertical";
import { renderPoster as renderHorizontalPoster } from "./poster";

export interface SceneRenderOptions {
  themeId: ThemeId;
  visualStyle: VisualStyle;
  layoutStyle: LayoutStyle;
  captions: boolean;
  captionText?: string;
  sceneIndex?: number;
  revealLimit?: number | "all";
  penTip?: boolean;
  aspect?: AspectRatio;
  assetImages?: ReadonlyMap<string, DecodedVisual>;
}

export {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  VERTICAL_HEIGHT,
  VERTICAL_WIDTH,
  canvasProfile,
  clearTextMeasureCache,
  roundedPath,
  themeOf,
  wrapLines,
} from "./core";
export { renderPoster as renderHorizontalPoster } from "./poster";

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

/** Keeps a scene layout sensible for the number of beats it actually has. */
function guardLayout(layout: SceneLayout, beatCount: number): SceneLayout {
  if (layout === "comparison" && beatCount > 4) return "flow";
  if (layout === "venn" && beatCount > 3) return "comparison";
  if (layout === "timeline" && beatCount > 5) return "flow";
  return layout;
}

function resolveLayout(
  layoutStyle: LayoutStyle,
  sceneIndex: number,
  scene: Scene,
): SceneLayout {
  // A manually chosen layout wins; "adaptive" lets each scene decide (AI layout, else heuristic).
  if (layoutStyle !== "adaptive") return guardLayout(layoutStyle, scene.beats.length);
  if (scene.layout) return guardLayout(scene.layout, scene.beats.length);
  const title = scene.title;
  const comparison = scene.beats.length > 4 ? "flow" : "comparison";
  if (sceneIndex <= 1) return "flow";
  if (sceneIndex === 2) return "mindmap";
  if (sceneIndex === 3) return comparison;
  if (title.includes("비교") || title.includes("대조")) return comparison;
  if (title.includes("적용") || title.includes("확장")) return "infographic";
  return "flow";
}

function pickVisual(
  scene: Scene,
  bp: (index: number) => number,
  assetImages: ReadonlyMap<string, DecodedVisual>,
): { beatIndex: number; image: DecodedVisual; progress: number } | null {
  let best: { beatIndex: number; image: DecodedVisual; progress: number } | null = null;
  for (let index = 0; index < scene.beats.length; index += 1) {
    const beat = scene.beats[index];
    if (!beat.visual) continue;
    const progress = bp(index);
    if (progress <= 0) continue;
    const image = assetImages.get(beat.visual.assetId);
    if (!image) continue;
    best = { beatIndex: index, image, progress };
  }
  return best;
}

function visualSlotFor(
  scene: Scene,
  layout: SceneLayout,
  beatIndex: number,
): VisualSlot {
  if (scene.type === "intro" || scene.type === "outro") {
    const slots = nodeLayout(scene.beats.length);
    const slot = slots[beatIndex];
    return {
      x: slot?.x ?? 960,
      y: scene.type === "intro" ? 390 : 380,
      width: 132,
      height: 84,
    };
  }
  if (layout === "flow") {
    const { centers } = cardLayout(Math.min(5, scene.beats.length));
    return { x: centers[beatIndex] ?? 960, y: 282, width: 120, height: 70 };
  }
  if (layout === "mindmap") {
    return { x: 205, y: 835, width: 150, height: 88, rotate: -0.05 };
  }
  if (layout === "comparison") {
    return scene.beats.length >= 4
      ? { x: 960, y: 356, width: 150, height: 96 }
      : { x: 205, y: 838, width: 150, height: 88, rotate: -0.04 };
  }
  if (layout === "timeline") {
    return { x: 960, y: 300, width: 150, height: 92 };
  }
  if (layout === "cycle") {
    return { x: 960, y: 235, width: 150, height: 90 };
  }
  if (layout === "hierarchy") {
    return { x: 960, y: 500, width: 150, height: 92 };
  }
  if (layout === "chart") {
    return { x: 1490, y: 460, width: 170, height: 108 };
  }
  if (layout === "venn") {
    return { x: 960, y: 358, width: 140, height: 88, rotate: -0.04 };
  }
  return { x: 955, y: 490, width: 150, height: 96 };
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  time: number,
  options: SceneRenderOptions,
): void {
  const theme = themeOf(options.themeId);
  const style = options.visualStyle;
  const aspect = options.aspect ?? "16:9";
  beginSketchFrame();
  const bp = (index: number) =>
    beatProgress(scene, index, time, options.revealLimit);
  const captionBeatIndex =
    options.revealLimit === undefined
      ? activeBeatIndex(scene, time)
      : options.revealLimit === "all"
        ? scene.beats.length - 1
        : Math.max(0, Math.min(scene.beats.length - 1, options.revealLimit - 1));
  const captionText =
    options.captionText ?? scene.beats[captionBeatIndex]?.narration ?? "";

  if (aspect === "9:16") {
    const profile = canvasProfile("9:16");
    fillGridPattern(ctx, profile.width, profile.height, theme);
    drawVerticalScene(ctx, scene, time, theme, style, bp);
    if (options.assetImages && options.assetImages.size > 0) {
      const visual = pickVisual(scene, bp, options.assetImages);
      if (visual) {
        drawBeatVisual(
          ctx,
          visual.image,
          { x: 540, y: 1630, width: 320, height: 190 },
          visual.progress,
        );
      }
    }
    if (options.penTip) {
      const tip = takeSketchTip();
      if (tip) drawPenNib(ctx, tip.x, tip.y, theme.title, tip.angle);
    }
    if (options.captions && captionText) {
      drawVerticalCaption(ctx, theme, captionText, 1);
    }
    return;
  }

  drawGrid(ctx, theme);
  const layout =
    scene.type === "intro" || scene.type === "outro"
      ? "flow"
      : resolveLayout(options.layoutStyle, options.sceneIndex ?? 0, scene);

  if (scene.type === "intro") {
    drawIntro(ctx, scene, time, theme, style, bp);
  } else if (scene.type === "outro") {
    drawOutro(ctx, scene, time, theme, style, bp);
  } else {
    drawSceneHeader(ctx, scene, time, theme, style);
    if (layout === "mindmap") drawMindmap(ctx, scene, theme, style, bp);
    else if (layout === "comparison") drawComparison(ctx, scene, theme, style, bp);
    else if (layout === "infographic") drawInfographic(ctx, scene, theme, style, bp);
    else if (layout === "timeline") drawTimeline(ctx, scene, theme, style, bp);
    else if (layout === "cycle") drawCycle(ctx, scene, theme, style, bp);
    else if (layout === "hierarchy") drawHierarchy(ctx, scene, theme, style, bp);
    else if (layout === "chart") drawChart(ctx, scene, theme, style, bp);
    else if (layout === "venn") drawVenn(ctx, scene, theme, style, bp);
    else drawFlow(ctx, scene, theme, style, bp);
  }

  if (options.assetImages && options.assetImages.size > 0) {
    const visual = pickVisual(scene, bp, options.assetImages);
    if (visual) {
      drawBeatVisual(
        ctx,
        visual.image,
        visualSlotFor(scene, layout, visual.beatIndex),
        visual.progress,
      );
    }
  }

  if (options.penTip) {
    const tip = takeSketchTip();
    if (tip) drawPenNib(ctx, tip.x, tip.y, theme.title, tip.angle);
  }

  if (options.captions && captionText) {
    drawCaption(ctx, theme, captionText, 1);
  }
}

export function renderPoster(
  ctx: CanvasRenderingContext2D,
  themeId: ThemeId = "paper",
  aspect: AspectRatio = "16:9",
): void {
  if (aspect === "9:16") {
    renderVerticalPoster(ctx, themeId);
    return;
  }
  renderHorizontalPoster(ctx, themeId);
}
