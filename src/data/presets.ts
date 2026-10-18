import type {
  LayoutStyle,
  PresetOption,
  ThemePalette,
  VisualStyle,
} from "../types/project";

export const THEMES: Record<string, ThemePalette> = {
  paper: {
    id: "paper",
    name: "페이퍼 화이트보드",
    desc: "교실 판서에 어울리는 밝고 깔끔한 종이 질감",
    bg: "#faf9f6",
    grid: "rgba(22, 24, 29, 0.055)",
    title: "#16181d",
    subtitle: "#5b6472",
    cardBg: "#ffffff",
    cardBorder: "#e6e3dc",
    cardBorderActive: "#2f5bea",
    accent: "#2f5bea",
    badgeBg: "#eef2ff",
    badgeBorder: "#2f5bea",
    badgeText: "#2645c8",
    stepColors: ["#2f5bea", "#7c3aed", "#0f9d76", "#d97706"],
    subtitleBarBg: "rgba(22, 24, 29, 0.92)",
    subtitleText: "#ffffff",
    surface: "#ffffff",
    muted: "#8a8f99",
  },
  blueprint: {
    id: "blueprint",
    name: "엔지니어링 블루프린트",
    desc: "이공계·설계 수업에 어울리는 청사진 도면 룩",
    bg: "#0b1220",
    grid: "rgba(96, 165, 250, 0.14)",
    title: "#f1f5f9",
    subtitle: "#93a4bd",
    cardBg: "rgba(23, 34, 54, 0.88)",
    cardBorder: "rgba(96, 165, 250, 0.32)",
    cardBorderActive: "#60a5fa",
    accent: "#60a5fa",
    badgeBg: "rgba(96, 165, 250, 0.16)",
    badgeBorder: "#60a5fa",
    badgeText: "#93c5fd",
    stepColors: ["#60a5fa", "#a78bfa", "#34d399", "#fbbf24"],
    subtitleBarBg: "rgba(8, 15, 28, 0.94)",
    subtitleText: "#dbeafe",
    surface: "#111c2f",
    muted: "#7d8ea8",
  },
  editorial: {
    id: "editorial",
    name: "웜 에디토리얼",
    desc: "인문·사회 수업에 어울리는 크림 페이퍼와 어스 톤",
    bg: "#fbf7f0",
    grid: "rgba(180, 83, 9, 0.07)",
    title: "#2a2118",
    subtitle: "#7a6a58",
    cardBg: "#ffffff",
    cardBorder: "#eadfd0",
    cardBorderActive: "#c2410c",
    accent: "#c2410c",
    badgeBg: "#fff4ec",
    badgeBorder: "#ea580c",
    badgeText: "#9a3412",
    stepColors: ["#c2410c", "#b45309", "#0f766e", "#6d28d9"],
    subtitleBarBg: "rgba(42, 33, 24, 0.92)",
    subtitleText: "#fef3c7",
    surface: "#fffdf9",
    muted: "#a08d78",
  },
  midnight: {
    id: "midnight",
    name: "미드나잇 미니멀",
    desc: "SW·코딩 수업에 어울리는 딥 징크 시네마틱 룩",
    bg: "#0a0a0c",
    grid: "rgba(255, 255, 255, 0.05)",
    title: "#f5f5f4",
    subtitle: "#a3a3a3",
    cardBg: "#151518",
    cardBorder: "#2a2a2e",
    cardBorderActive: "#e4e4e7",
    accent: "#e4e4e7",
    badgeBg: "#1f1f23",
    badgeBorder: "#52525b",
    badgeText: "#e4e4e7",
    stepColors: ["#7dd3fc", "#c4b5fd", "#6ee7b7", "#fda4af"],
    subtitleBarBg: "rgba(21, 21, 24, 0.95)",
    subtitleText: "#f5f5f4",
    surface: "#121215",
    muted: "#8b8b93",
  },
};

export const VISUAL_STYLES: PresetOption<VisualStyle>[] = [
  {
    id: "diagram",
    name: "정밀 다이어그램",
    desc: "기술 도면",
  },
  {
    id: "illustration",
    name: "컬러 일러스트",
    desc: "소프트 글로우",
  },
  {
    id: "marker",
    name: "마커 스케치",
    desc: "화이트보드 감성",
  },
];

export const LAYOUT_STYLES: PresetOption<LayoutStyle>[] = [
  {
    id: "adaptive",
    name: "스마트 적응형",
    desc: "씬 흐름에 맞춰 레이아웃 자동 전환",
    badge: "추천",
  },
  {
    id: "flow",
    name: "단계별 플로우",
    desc: "1→2→3 순차 연결 화살표",
  },
  {
    id: "mindmap",
    name: "방사형 마인드맵",
    desc: "중심 개념과 방사형 세부 노드",
  },
  {
    id: "comparison",
    name: "비교 & 대조 듀얼",
    desc: "좌우 2단 대조 분할 뷰",
  },
  {
    id: "infographic",
    name: "인포그래픽 쇼케이스",
    desc: "대형 비주얼과 3단 브레이크다운",
  },
];

export const MODELS: PresetOption[] = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    desc: "최신 플래그십 모델 (빠른 응답과 높은 품질)",
    badge: "기본 권장",
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    desc: "안정적으로 검증된 고성능 모델",
    badge: "안정형",
  },
];

export const TTS_MODELS: PresetOption[] = [
  {
    id: "gemini-3.8-flash-tts",
    name: "Gemini 3.8 Flash TTS",
    desc: "최신 고음질 자연스러운 한국어 음성",
    badge: "기본 권장",
  },
  {
    id: "gemini-3.8-flash-lite-tts",
    name: "Gemini 3.8 Flash Lite TTS",
    desc: "경량 고속 음성 합성",
  },
];

export const MODEL_FALLBACKS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

export const TTS_FALLBACKS = [
  "gemini-3.8-flash-tts",
  "gemini-3.8-flash-lite-tts",
  "gemini-2.5-flash-preview-tts",
];

/**
 * Image generation models. `imagen-*` ids use the :predict endpoint;
 * any other id is treated as a Gemini image-generation model and uses
 * :generateContent with an inline image part.
 */
export const IMAGE_MODELS: PresetOption[] = [
  {
    id: "imagen-4.0-generate-001",
    name: "Imagen 4",
    desc: "고품질 교수자료 이미지",
    badge: "고품질",
  },
  {
    id: "gemini-2.5-flash-image",
    name: "Gemini Image",
    desc: "무료 티어에서 동작하는 빠른 이미지 생성",
    badge: "무료 티어",
  },
];

export const IMAGE_FALLBACKS = [
  "imagen-4.0-generate-001",
  "imagen-3.0-generate-002",
  "gemini-2.5-flash-image",
  "gemini-2.0-flash-preview-image-generation",
];

export const VOICES: PresetOption[] = [
  { id: "Kore", name: "Kore", desc: "안정적" },
  { id: "Puck", name: "Puck", desc: "경쾌함" },
  { id: "Fenrir", name: "Fenrir", desc: "진중함" },
];

export const BGM_PRESETS = [
  { id: "none", name: "배경음 없음 (음성만)", desc: "나레이션만 깔끔하게" },
  { id: "lofi", name: "따뜻한 로파이", desc: "집중과 편안함" },
  { id: "piano", name: "차분한 피아노", desc: "신뢰와 클래식" },
  { id: "ambient", name: "과학 탐구 앰비언트", desc: "미래지향적 분위기" },
];

export const CAPTION_LANGUAGES = [
  { code: "ko", flag: "KR", label: "한국어", nativeName: "한국어 (원본)" },
  { code: "en", flag: "EN", label: "영어", nativeName: "English" },
  { code: "ja", flag: "JA", label: "일본어", nativeName: "日本語" },
  { code: "zh", flag: "ZH", label: "중국어", nativeName: "中文" },
  { code: "es", flag: "ES", label: "스페인어", nativeName: "Español" },
  { code: "fr", flag: "FR", label: "프랑스어", nativeName: "Français" },
  { code: "de", flag: "DE", label: "독일어", nativeName: "Deutsch" },
];

export const TOPIC_TEMPLATES = [
  { title: "커피가 뇌를 깨우는 과학적 메커니즘", tag: "중·고등 과학/생체", dotColor: "#2f5bea" },
  { title: "생성형 AI가 문장을 만드는 원리", tag: "SW·인공지능 교육", dotColor: "#0f9d76" },
  { title: "금리와 인플레이션이 일상 경제에 미치는 영향", tag: "통합사회/경제", dotColor: "#d97706" },
  { title: "로켓이 중력을 이기고 우주로 나아가는 원리", tag: "기초 물리/항공우주", dotColor: "#7c3aed" },
  { title: "면역 세포가 바이러스를 탐색하고 퇴치하는 과정", tag: "생명과학", dotColor: "#db2777" },
  { title: "광합성이 빛을 양분으로 바꾸는 과정", tag: "통합과학/생물", dotColor: "#0891b2" },
  { title: "미분이 순간의 변화를 계산하는 원리", tag: "수학/미적분", dotColor: "#2563eb" },
  { title: "평균과 표준편차로 데이터를 읽는 법", tag: "수학/통계", dotColor: "#059669" },
  { title: "판 구조론으로 본 지진이 일어나는 원리", tag: "지구과학", dotColor: "#b45309" },
  { title: "조선 후기 실학이 세상을 바꾼 방식", tag: "한국사", dotColor: "#7c2d12" },
  { title: "은유와 상징이 시의 의미를 만드는 방법", tag: "국어/문학", dotColor: "#9333ea" },
  { title: "가정법으로 상상을 표현하는 영어 문장", tag: "영어/문법", dotColor: "#0ea5e9" },
];

export const ICON_KEYS = [
  "Sun",
  "Leaf",
  "FlaskConical",
  "Atom",
  "Zap",
  "BatteryCharging",
  "BrainCircuit",
  "Cpu",
  "Rocket",
  "ChartLine",
  "Dna",
  "Clock",
  "ShieldCheck",
  "HeartPulse",
  "Check",
  "Star",
  "Coffee",
  "Brain",
  "Target",
  "BookOpen",
  "Lightbulb",
  "Settings",
  "Magnet",
  "Droplets",
  "Globe2",
  "Scale",
] as const;

export const ICON_FALLBACK = "Lightbulb";

export const SCENE_LIMITS = {
  minScenes: 2,
  maxScenes: 10,
  minBeats: 2,
  maxBeats: 5,
} as const;

export const EXPORT_FORMATS = [
  {
    id: "webm" as const,
    name: "WebM (VP9/Opus)",
    desc: "모든 최신 브라우저에서 안정적으로 동작합니다.",
  },
  {
    id: "mp4" as const,
    name: "MP4 (H.264/AAC)",
    desc: "WebCodecs 지원 브라우저에서 오프라인으로 빠르게 인코딩합니다.",
  },
];

export type ExportFormatId = (typeof EXPORT_FORMATS)[number]["id"];

export const RESOLUTIONS = [
  { id: "fhd", label: "FHD 1080p", width: 1920, height: 1080 },
  { id: "hd", label: "고속 720p", width: 1280, height: 720 },
] as const;

export const VERTICAL_RESOLUTIONS = [
  { id: "fhd", label: "FHD 1080p (세로)", width: 1080, height: 1920 },
  { id: "hd", label: "고속 720p (세로)", width: 720, height: 1280 },
] as const;

export type ResolutionId = (typeof RESOLUTIONS)[number]["id"];

export function resolutionPreset(
  resolution: ResolutionId,
  aspect: "16:9" | "9:16",
): (typeof RESOLUTIONS)[number] | (typeof VERTICAL_RESOLUTIONS)[number] {
  if (aspect === "9:16") {
    return VERTICAL_RESOLUTIONS.find((item) => item.id === resolution) ?? VERTICAL_RESOLUTIONS[0];
  }
  return RESOLUTIONS.find((item) => item.id === resolution) ?? RESOLUTIONS[0];
}

export const APP_NAME = "판서랩";
export const APP_TAGLINE = "교육용 화이트보드 영상 만들기";
export const DB_NAME = "panseolab-db";
export const DRAFT_KEY = "draft:latest";
export const SETTINGS_KEY = "panseolab-settings";
