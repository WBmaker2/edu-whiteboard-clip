export interface CallBudget {
  storyboard: number;
  tts: number;
  rewrite: number;
  translation: number;
  quiz: number;
  total: number;
}

function budget(partial: Omit<CallBudget, "total">): CallBudget {
  return {
    ...partial,
    total:
      partial.storyboard +
      partial.tts +
      partial.rewrite +
      partial.translation +
      partial.quiz,
  };
}

export function generationBudget(sceneCount: number, withAudio = true): CallBudget {
  return budget({
    storyboard: 1,
    tts: withAudio ? Math.max(0, sceneCount) : 0,
    rewrite: 0,
    translation: 0,
    quiz: 0,
  });
}

export function rewriteSceneBudget(withAudio: boolean): CallBudget {
  return budget({ storyboard: 0, tts: withAudio ? 1 : 0, rewrite: 1, translation: 0, quiz: 0 });
}

export function translateBudget(sceneCount: number): CallBudget {
  return budget({ storyboard: 0, tts: 0, rewrite: 0, translation: Math.max(0, sceneCount), quiz: 0 });
}

export function quizBudget(): CallBudget {
  return budget({ storyboard: 0, tts: 0, rewrite: 0, translation: 0, quiz: 1 });
}

export type BudgetTranslator = (
  key: string,
  params?: Record<string, string | number>,
) => string;

const KO_BUDGET: Record<string, string> = {
  "budget.storyboard": "스토리보드 {count}회",
  "budget.tts": "음성 {count}회",
  "budget.rewrite": "재작성 {count}회",
  "budget.translation": "번역 {count}회",
  "budget.quiz": "퀴즈 {count}회",
  "budget.none": "Gemini 호출 없음",
  "budget.total": "{parts} = 총 {total}회",
};

function fallbackBudgetTranslate(
  key: string,
  params?: Record<string, string | number>,
): string {
  const template = KO_BUDGET[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] !== undefined ? String(params[name]) : match,
  );
}

export function describeBudget(value: CallBudget, t?: BudgetTranslator): string {
  const tr = t ?? fallbackBudgetTranslate;
  const parts: string[] = [];
  if (value.storyboard) parts.push(tr("budget.storyboard", { count: value.storyboard }));
  if (value.tts) parts.push(tr("budget.tts", { count: value.tts }));
  if (value.rewrite) parts.push(tr("budget.rewrite", { count: value.rewrite }));
  if (value.translation) parts.push(tr("budget.translation", { count: value.translation }));
  if (value.quiz) parts.push(tr("budget.quiz", { count: value.quiz }));
  if (parts.length === 0) return tr("budget.none");
  return tr("budget.total", { parts: parts.join(" + "), total: value.total });
}

let sessionCalls = 0;
const listeners = new Set<() => void>();

export function recordCall(count = 1): void {
  sessionCalls += count;
  listeners.forEach((listener) => listener());
}

export function getSessionCalls(): number {
  return sessionCalls;
}

export function subscribeSessionCalls(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
