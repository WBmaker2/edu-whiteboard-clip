export const GRADE_LEVELS = [
  { id: "", label: "선택 안 함" },
  { id: "초등", label: "초등학교" },
  { id: "중등", label: "중학교" },
  { id: "고등", label: "고등학교" },
  { id: "일반", label: "성인/일반" },
] as const;

export const SUBJECTS = [
  "",
  "과학",
  "수학",
  "국어",
  "영어",
  "사회",
  "역사",
  "정보(SW·AI)",
  "예체능",
  "기타",
] as const;

export interface CurriculumContext {
  grade: string;
  subject: string;
  standards: string;
}

export function curriculumPromptBlock(
  context: CurriculumContext | undefined,
): string {
  if (!context) return "";
  const level = [context.grade, context.subject].filter(Boolean).join(" ");
  const standards = context.standards.trim();
  if (!level && !standards) return "";
  const lines = ["", "Curriculum alignment:"];
  if (level) lines.push(`- Level and subject: ${level}`);
  if (standards) {
    lines.push(`- Achievement standards the lesson must cover:`);
    lines.push(standards.slice(0, 1200));
  }
  lines.push("");
  return lines.join("\n");
}
