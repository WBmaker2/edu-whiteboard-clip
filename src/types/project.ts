export type SceneType = "intro" | "body" | "outro";

export type ThemeId = "paper" | "blueprint" | "editorial" | "midnight";

export type VisualStyle = "diagram" | "illustration" | "marker";

export type LayoutStyle =
  | "adaptive"
  | "flow"
  | "mindmap"
  | "comparison"
  | "infographic";

export interface Beat {
  id: string;
  label: string;
  desc: string;
  narration: string;
  iconType: string;
}

export interface Scene {
  id: string;
  type: SceneType;
  title: string;
  subtitle: string;
  beats: Beat[];
  duration: number;
  windows: [number, number][];
  audioBlob?: Blob;
  audioUrl?: string;
  audioSource?: "tts" | "recorded" | "none";
  /** Hash of the beats when the current narration audio was generated. */
  audioTextHash?: string;
  updatedAt?: string;
}

export interface DraftSnapshot {
  id: string;
  savedAt: string;
  label: string;
  sceneCount: number;
  includesAudio: boolean;
  project: Project;
}

export interface Project {
  version: 1;
  topic: string;
  themeId: ThemeId;
  visualStyle: VisualStyle;
  layoutStyle: LayoutStyle;
  voice: string;
  model: string;
  ttsModel: string;
  bgmId: string;
  scenes: Scene[];
  savedAt: string;
}

export interface ThemePalette {
  id: ThemeId;
  name: string;
  desc: string;
  bg: string;
  grid: string;
  title: string;
  subtitle: string;
  cardBg: string;
  cardBorder: string;
  cardBorderActive: string;
  accent: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  stepColors: [string, string, string, string];
  subtitleBarBg: string;
  subtitleText: string;
  surface: string;
  muted: string;
}

export interface PresetOption<T extends string = string> {
  id: T;
  name: string;
  desc: string;
  badge?: string;
}

export interface CaptionTranslation {
  lang: string;
  narrations: string[][];
}
