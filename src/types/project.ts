export type SceneType = "intro" | "body" | "outro";

export type ThemeId = "paper" | "blueprint" | "editorial" | "midnight";

export type VisualStyle = "diagram" | "illustration" | "marker";

export type LayoutStyle =
  | "adaptive"
  | "flow"
  | "mindmap"
  | "comparison"
  | "infographic"
  | "timeline"
  | "cycle"
  | "hierarchy"
  | "chart"
  | "venn";

/** Concrete scene layout chosen by the storyboard (never "adaptive"). */
export type SceneLayout = Exclude<LayoutStyle, "adaptive">;

/** Settings-level selection: a concrete value or topic-based auto recommendation. */
export type ThemeSelection = ThemeId | "auto";
export type VisualSelection = VisualStyle | "auto";

export type AspectRatio = "16:9" | "9:16";

export type AssetKind = "image" | "formula" | "ai";

export type AssetSource = "upload" | "formula" | "ai";

export interface AssetMeta {
  id: string;
  kind: AssetKind;
  source: AssetSource;
  mime: string;
  blob?: Blob;
  url?: string;
  width?: number;
  height?: number;
  /** Original LaTeX source for formula assets, kept so it can be re-edited. */
  latex?: string;
  name?: string;
}

export interface BeatVisual {
  kind: "image" | "formula" | "ai";
  assetId: string;
  caption?: string;
}

export interface Beat {
  id: string;
  label: string;
  desc: string;
  narration: string;
  iconType: string;
  visual?: BeatVisual;
}

export interface Scene {
  id: string;
  type: SceneType;
  title: string;
  subtitle: string;
  beats: Beat[];
  duration: number;
  windows: [number, number][];
  /** Per-scene layout chosen from the storyboard. Missing means "use the adaptive heuristic". */
  layout?: SceneLayout;
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
  version: 2;
  topic: string;
  themeId: ThemeId;
  visualStyle: VisualStyle;
  layoutStyle: LayoutStyle;
  aspect: AspectRatio;
  assets: Record<string, AssetMeta>;
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
