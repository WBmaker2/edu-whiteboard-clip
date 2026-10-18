import { createStore, get, set } from "idb-keyval";
import type { AspectRatio, LayoutStyle, ThemeId, VisualStyle } from "../types/project";
import { DB_NAME, THEMES } from "../data/presets";
import { uid } from "./time";

export interface UserTemplate {
  id: string;
  name: string;
  savedAt: string;
  topic: string;
  themeId: ThemeId;
  visualStyle: VisualStyle;
  layoutStyle: LayoutStyle;
  aspect: AspectRatio;
  voice?: string;
  bgmId?: string;
}

const store = createStore(DB_NAME, "projects");
const KEY = "templates:user";
const TEMPLATE_LIMIT = 20;

const THEME_IDS = Object.keys(THEMES);
const VISUAL_IDS: VisualStyle[] = ["diagram", "illustration", "marker"];
const LAYOUT_IDS: LayoutStyle[] = [
  "adaptive",
  "flow",
  "mindmap",
  "comparison",
  "infographic",
];

export async function listUserTemplates(): Promise<UserTemplate[]> {
  const stored = await get<UserTemplate[]>(KEY, store);
  return Array.isArray(stored) ? stored : [];
}

export async function saveUserTemplate(
  input: Omit<UserTemplate, "id" | "savedAt">,
): Promise<UserTemplate[]> {
  const template: UserTemplate = {
    ...input,
    id: uid("tpl"),
    savedAt: new Date().toISOString(),
  };
  const existing = await listUserTemplates();
  const next = [template, ...existing].slice(0, TEMPLATE_LIMIT);
  await set(KEY, next, store);
  return next;
}

export async function deleteUserTemplate(id: string): Promise<UserTemplate[]> {
  const existing = await listUserTemplates();
  const next = existing.filter((template) => template.id !== id);
  await set(KEY, next, store);
  return next;
}

export async function importUserTemplate(text: string): Promise<UserTemplate[]> {
  return saveUserTemplate(parseTemplateJson(text));
}

export function exportTemplateJson(template: UserTemplate): string {
  return JSON.stringify({ kind: "panseolab-template", ...template }, null, 2);
}

export function parseTemplateJson(
  text: string,
): Omit<UserTemplate, "id" | "savedAt"> {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("템플릿 파일을 읽지 못했습니다. JSON 형식을 확인해 주세요.");
  }
  if (!raw || raw.kind !== "panseolab-template" || typeof raw.topic !== "string") {
    throw new Error("판서랩 템플릿 파일 형식이 아닙니다.");
  }
  return {
    name:
      typeof raw.name === "string" && raw.name.trim()
        ? raw.name.trim().slice(0, 40)
        : "가져온 템플릿",
    topic: raw.topic.slice(0, 300),
    themeId: THEME_IDS.includes(raw.themeId) ? (raw.themeId as ThemeId) : "paper",
    visualStyle: VISUAL_IDS.includes(raw.visualStyle)
      ? (raw.visualStyle as VisualStyle)
      : "diagram",
    layoutStyle: LAYOUT_IDS.includes(raw.layoutStyle)
      ? (raw.layoutStyle as LayoutStyle)
      : "adaptive",
    aspect: raw.aspect === "9:16" ? "9:16" : "16:9",
    voice: typeof raw.voice === "string" ? raw.voice : undefined,
    bgmId: typeof raw.bgmId === "string" ? raw.bgmId : undefined,
  };
}
