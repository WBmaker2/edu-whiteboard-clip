import type { Language } from "./i18n";

type Entry = { name?: string; desc?: string };
type Group =
  | "theme"
  | "visual"
  | "layout"
  | "bgm"
  | "voice"
  | "model"
  | "tts"
  | "grade"
  | "subject";

const EN: Record<Group, Record<string, Entry>> = {
  theme: {
    auto: { name: "Topic auto", desc: "Choose automatically from the topic and subject (recommended)" },
    paper: { name: "Paper whiteboard", desc: "Bright, clean paper texture for classroom notes" },
    blueprint: { name: "Engineering blueprint", desc: "Blueprint look for STEM lessons" },
    editorial: { name: "Warm editorial", desc: "Cream paper and earth tones for humanities" },
    midnight: { name: "Midnight minimal", desc: "Deep zinc cinematic look for coding lessons" },
  },
  visual: {
    auto: { name: "Topic auto", desc: "Choose automatically from the topic and subject" },
    diagram: { name: "Precise diagram", desc: "Technical blueprint" },
    illustration: { name: "Color illustration", desc: "Soft glow" },
    marker: { name: "Marker sketch", desc: "Whiteboard feel" },
  },
  layout: {
    adaptive: { name: "Smart adaptive", desc: "Picks a layout for each scene" },
    flow: { name: "Step-by-step flow", desc: "Sequential arrows 1 → 2 → 3" },
    mindmap: { name: "Radial mind map", desc: "Center concept with radial nodes" },
    comparison: { name: "Compare & contrast", desc: "Two-column split view" },
    infographic: { name: "Infographic showcase", desc: "Large visual with a three-part breakdown" },
    timeline: { name: "Timeline", desc: "Chronological flow" },
    cycle: { name: "Cycle diagram", desc: "Circular loop of repeating steps" },
    hierarchy: { name: "Hierarchy", desc: "Tree structure for categories and levels" },
    chart: { name: "Data chart", desc: "Bar chart for numbers and ratios" },
    venn: { name: "Venn diagram", desc: "Overlap and difference of two concepts" },
  },
  bgm: {
    none: { name: "No background music (voice only)", desc: "Clean narration only" },
    lofi: { name: "Warm lo-fi", desc: "Focus and comfort" },
    piano: { name: "Calm piano", desc: "Trust and classic" },
    ambient: { name: "Science ambient", desc: "Futuristic mood" },
  },
  voice: {
    Kore: { desc: "Steady" },
    Puck: { desc: "Lively" },
    Fenrir: { desc: "Deep" },
  },
  model: {
    "gemini-3.8-flash": { desc: "Latest flagship model (fast and high quality)" },
    "gemini-3.7-flash": { desc: "Proven high-performance model" },
  },
  tts: {
    "gemini-3.8-flash-tts": { desc: "Latest natural Korean voice" },
    "gemini-3.8-flash-lite-tts": { desc: "Lightweight fast speech synthesis" },
  },
  grade: {
    "": { name: "None" },
    초등: { name: "Elementary" },
    중등: { name: "Middle school" },
    고등: { name: "High school" },
    일반: { name: "Adult / general" },
  },
  subject: {
    과학: { name: "Science" },
    수학: { name: "Math" },
    국어: { name: "Korean" },
    영어: { name: "English" },
    사회: { name: "Social studies" },
    역사: { name: "History" },
    "정보(SW·AI)": { name: "CS (SW · AI)" },
    예체능: { name: "Arts & PE" },
    기타: { name: "Other" },
  },
};

export function localLabel(
  language: Language,
  group: Group,
  id: string,
  field: "name" | "desc",
  fallback: string,
): string {
  if (language !== "en") return fallback;
  return EN[group][id]?.[field] ?? fallback;
}

export function localGrade(language: Language, id: string, fallback: string): string {
  return localLabel(language, "grade", id, "name", fallback);
}

export function localSubject(language: Language, id: string, fallback: string): string {
  return localLabel(language, "subject", id, "name", fallback);
}

const EN_BADGES: Record<string, string> = {
  추천: "Recommended",
  "기본 권장": "Recommended",
  안정형: "Stable",
  고품질: "High quality",
  "무료 티어": "Free tier",
};

export function localBadge(
  language: Language,
  badge: string | undefined,
  fallback: string,
): string {
  if (!badge) return fallback;
  if (language !== "en") return badge;
  return EN_BADGES[badge] ?? badge;
}
