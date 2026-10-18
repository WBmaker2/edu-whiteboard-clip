import type { Project, Scene, ThemePalette } from "../../types/project";
import { THEMES } from "../../data/presets";
import { rawIconNode } from "../renderer/icons";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function iconSvgGroup(iconType: string, cx: number, cy: number, size: number): string {
  const node = rawIconNode(iconType);
  const children = node[2] ?? [];
  const scale = size / 24;
  const parts: string[] = [];
  for (const [tag, attrs] of children) {
    const attrText = Object.entries(attrs)
      .filter(([key]) => key !== "key")
      .map(([key, value]) => `${key}="${escapeXml(String(value))}"`)
      .join(" ");
    parts.push(`<${tag} ${attrText} />`);
  }
  return `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${scale})" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">${parts.join("")}</g>`;
}

function gridSvg(theme: ThemePalette, width: number, height: number): string {
  const lines: string[] = [];
  for (let x = 40; x < width; x += 60) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" />`);
  }
  for (let y = 40; y < height; y += 60) {
    lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" />`);
  }
  return `<rect width="${width}" height="${height}" fill="${theme.bg}" /><g stroke="${theme.grid}" stroke-width="1">${lines.join("")}</g>`;
}

/** Builds a simple editable SVG sheet for one scene (approximate vector rendering). */
export function buildSceneSvg(project: Project, scene: Scene, sceneIndex: number): string {
  const theme = THEMES[project.themeId] ?? THEMES.paper;
  const width = project.aspect === "9:16" ? 1080 : 1920;
  const height = project.aspect === "9:16" ? 1920 : 1080;
  const centerX = width / 2;
  const parts: string[] = [];

  parts.push(gridSvg(theme, width, height));
  parts.push(
    `<text x="${centerX}" y="${project.aspect === "9:16" ? 270 : 110}" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="${project.aspect === "9:16" ? 50 : 52}" font-weight="900" fill="${theme.title}">${escapeXml(scene.title)}</text>`,
  );
  parts.push(
    `<path d="M ${centerX - 240} ${project.aspect === "9:16" ? 316 : 146} Q ${centerX} ${project.aspect === "9:16" ? 325 : 155} ${centerX + 240} ${project.aspect === "9:16" ? 313 : 143}" stroke="${theme.accent}" stroke-width="5" fill="none" stroke-linecap="round" />`,
  );
  parts.push(
    `<text x="${centerX}" y="${project.aspect === "9:16" ? 360 : 200}" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="25" font-weight="600" fill="${theme.subtitle}">${escapeXml(scene.subtitle)}</text>`,
  );

  const startY = project.aspect === "9:16" ? 540 : 330;
  const endY = project.aspect === "9:16" ? 1450 : 900;
  const count = Math.max(1, scene.beats.length);
  const step = count === 1 ? 0 : (endY - startY) / (count - 1);
  scene.beats.forEach((beat, index) => {
    const y = startY + step * index;
    const color = theme.stepColors[index % theme.stepColors.length];
    const ringX = project.aspect === "9:16" ? 150 : 260;
    parts.push(
      `<circle cx="${ringX}" cy="${y}" r="46" fill="none" stroke="${color}" stroke-width="3.5" />`,
    );
    parts.push(iconSvgGroup(beat.iconType, ringX, y, 50).replace("<g ", `<g stroke="${color}" `));
    const textX = ringX + 90;
    parts.push(
      `<text x="${textX}" y="${y - 10}" font-family="Pretendard, sans-serif" font-size="29" font-weight="800" fill="${theme.title}">${escapeXml(beat.label)}</text>`,
    );
    parts.push(
      `<path d="M ${textX} ${y + 18} q ${Math.min(120, beat.label.length * 16)} 6 ${Math.min(240, beat.label.length * 32)} -4" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.9" />`,
    );
    parts.push(
      `<text x="${textX}" y="${y + 48}" font-family="Pretendard, sans-serif" font-size="19" font-weight="500" fill="${theme.subtitle}">${escapeXml(beat.desc)}</text>`,
    );
  });

  parts.push(
    `<text x="${centerX}" y="${height - 60}" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="18" font-weight="600" fill="${theme.subtitle}">판서랩 · ${escapeXml(project.topic)} · 장면 ${sceneIndex + 1}/${project.scenes.length}</text>`,
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    parts.join("\n"),
    `</svg>`,
  ].join("\n");
}
