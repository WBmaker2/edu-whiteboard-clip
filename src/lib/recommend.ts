import type {
  ThemeId,
  ThemeSelection,
  VisualSelection,
  VisualStyle,
} from "../types/project";
import type { CurriculumContext } from "../data/curriculum";

export interface StyleRecommendation {
  themeId: ThemeId;
  visualStyle: VisualStyle;
}

interface RecommendationRule {
  themeId: ThemeId;
  visualStyle: VisualStyle;
  keywords: string[];
  subjects?: string[];
}

/**
 * Keyword + subject rules that map a lesson topic to a fitting look.
 * Order matters: the first matching rule wins.
 */
const RULES: RecommendationRule[] = [
  {
    themeId: "midnight",
    visualStyle: "marker",
    keywords: [
      "ai", "인공지능", "코딩", "프로그래밍", "알고리즘", "컴퓨터", "소프트웨어",
      "네트워크", "보안", "머신러닝", "딥러닝", "데이터", "정보", "프로그램",
      "chatgpt", "생성형", "블록체인", "클라우드", "서버", "코드",
    ],
    subjects: ["정보(sw·ai)", "정보", "sw", "코딩", "컴퓨터"],
  },
  {
    themeId: "blueprint",
    visualStyle: "diagram",
    keywords: [
      "물리", "로켓", "우주", "전기", "회로", "전자", "공학", "로봇", "기계",
      "엔진", "힘", "에너지", "구조", "설계", "건축", "수학", "미분", "적분",
      "함수", "기하", "통계", "확률", "벡터", "방정식", "화학", "분자", "원자",
      "화학식", "역학", "중력", "양자",
    ],
    subjects: ["수학", "과학", "물리", "화학", "공학"],
  },
  {
    themeId: "editorial",
    visualStyle: "illustration",
    keywords: [
      "역사", "조선", "고려", "국어", "문학", "시", "소설", "사회", "경제",
      "금리", "인플레이션", "철학", "윤리", "지리", "문화", "민주", "법",
      "정치", "실학", "은유", "상징", "가정법",
    ],
    subjects: ["국어", "영어", "사회", "역사", "도덕", "윤리"],
  },
  {
    themeId: "paper",
    visualStyle: "illustration",
    keywords: [
      "생물", "생명", "세포", "광합성", "면역", "dna", "유전", "식물", "동물",
      "인체", "환경", "지구", "기후", "천문", "바이러스", "백신", "뇌", "신경",
      "심장", "호르몬", "생태",
    ],
    subjects: ["생물", "생명과학", "지구과학"],
  },
];

const SUBJECT_FALLBACK: Record<string, StyleRecommendation> = {
  "예체능": { themeId: "editorial", visualStyle: "illustration" },
};

function normalize(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s/g, "");
}

export function recommendStyle(
  topic: string,
  curriculum?: CurriculumContext,
): StyleRecommendation {
  const haystack = `${topic} ${curriculum?.standards ?? ""}`.toLowerCase();
  const subject = normalize(curriculum?.subject);

  for (const rule of RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      return { themeId: rule.themeId, visualStyle: rule.visualStyle };
    }
  }
  if (subject) {
    for (const rule of RULES) {
      if (rule.subjects?.some((candidate) => normalize(candidate) === subject)) {
        return { themeId: rule.themeId, visualStyle: rule.visualStyle };
      }
    }
    if (SUBJECT_FALLBACK[curriculum?.subject ?? ""]) {
      return SUBJECT_FALLBACK[curriculum!.subject];
    }
  }
  return { themeId: "paper", visualStyle: "diagram" };
}

export function resolveTheme(
  selection: ThemeSelection,
  topic: string,
  curriculum?: CurriculumContext,
): ThemeId {
  if (selection === "auto") return recommendStyle(topic, curriculum).themeId;
  return selection;
}

export function resolveVisual(
  selection: VisualSelection,
  topic: string,
  curriculum?: CurriculumContext,
): VisualStyle {
  if (selection === "auto") return recommendStyle(topic, curriculum).visualStyle;
  return selection;
}
