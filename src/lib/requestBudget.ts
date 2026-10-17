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

export function describeBudget(value: CallBudget): string {
  const parts: string[] = [];
  if (value.storyboard) parts.push(`스토리보드 ${value.storyboard}회`);
  if (value.tts) parts.push(`음성 ${value.tts}회`);
  if (value.rewrite) parts.push(`재작성 ${value.rewrite}회`);
  if (value.translation) parts.push(`번역 ${value.translation}회`);
  if (value.quiz) parts.push(`퀴즈 ${value.quiz}회`);
  if (parts.length === 0) return "Gemini 호출 없음";
  return `${parts.join(" + ")} = 총 ${value.total}회`;
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
