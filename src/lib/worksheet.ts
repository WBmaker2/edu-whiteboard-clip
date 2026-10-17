import type { Project, Scene } from "../types/project";

export interface MultipleChoiceQuestion {
  id: number;
  sceneTitle: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface EssayQuestion {
  id: number;
  sceneTitle: string;
  question: string;
  guidingThoughts: string[];
  modelAnswer: string;
  rubric: string;
}

export interface FillInQuestion {
  id: number;
  question: string;
  answer: string;
}

export interface WorksheetData {
  fillIn: FillInQuestion[];
  multipleChoice: MultipleChoiceQuestion[];
  essays: EssayQuestion[];
}

function allLabels(project: Project): string[] {
  const labels = project.scenes.flatMap((scene) => scene.beats.map((beat) => beat.label));
  return [...new Set(labels.filter(Boolean))];
}

function distractorOptions(correct: string, pool: string[], seed: number): string[] {
  const others = pool.filter((item) => item !== correct);
  const fallbacks = ["핵심 개념", "보조 원리", "관련 현상", "적용 사례"];
  const chosen: string[] = [];
  for (let offset = 0; offset < others.length && chosen.length < 3; offset += 1) {
    const candidate = others[(seed + offset) % others.length];
    if (!chosen.includes(candidate)) chosen.push(candidate);
  }
  for (const fallback of fallbacks) {
    if (chosen.length >= 3) break;
    if (fallback !== correct && !chosen.includes(fallback)) chosen.push(fallback);
  }
  return chosen;
}

function buildMultipleChoice(project: Project): MultipleChoiceQuestion[] {
  const pool = allLabels(project);
  const questions: MultipleChoiceQuestion[] = [];
  for (const scene of project.scenes) {
    for (const beat of scene.beats) {
      if (questions.length >= 5) break;
      const distractors = distractorOptions(beat.label, pool, questions.length + 1);
      const rawOptions = [beat.label, ...distractors];
      const shift = questions.length % rawOptions.length;
      const options = [...rawOptions.slice(shift), ...rawOptions.slice(0, shift)];
      questions.push({
        id: questions.length + 1,
        sceneTitle: scene.title,
        question: `[${scene.title}] "${beat.desc}"를 가장 잘 나타내는 개념은 무엇일까요?`,
        options,
        answerIndex: options.indexOf(beat.label),
        explanation: `${beat.label}은(는) ${scene.title}에서 ${beat.desc}의 핵심 개념입니다.`,
      });
    }
    if (questions.length >= 5) break;
  }
  return questions;
}

function blankNarration(scene: Scene, label: string, narration: string): string {
  if (narration.includes(label)) return narration.replace(label, "______");
  return `${narration} (핵심어: ______)`;
}

function buildFillIn(project: Project): FillInQuestion[] {
  const questions: FillInQuestion[] = [];
  for (const scene of project.scenes) {
    for (const beat of scene.beats) {
      if (questions.length >= 5) break;
      questions.push({
        id: questions.length + 1,
        question: blankNarration(scene, beat.label, beat.narration),
        answer: beat.label,
      });
    }
    if (questions.length >= 5) break;
  }
  return questions;
}

function buildEssays(project: Project): EssayQuestion[] {
  const first = project.scenes[0];
  const middle = project.scenes[Math.floor(project.scenes.length / 2)];
  const last = project.scenes[project.scenes.length - 1];
  const middleBeats = middle?.beats ?? [];
  const essays: EssayQuestion[] = [];
  if (first) {
    essays.push({
      id: 1,
      sceneTitle: first.title,
      question: `도입 장면의 "${first.title}"에서 제시한 문제를 일상생활의 구체적인 사례와 연결해 서술하시오.`,
      guidingThoughts: [
        "일상에서 직접 경험한 사례를 한 가지 이상 제시했는가?",
        "현상과 원리의 인과관계를 자신의 언어로 연결했는가?",
      ],
      modelAnswer: first.beats.map((beat) => beat.narration).join(" "),
      rubric: "구체적 사례 제시 5점, 원리와의 인과관계 설명 5점",
    });
  }
  if (middle) {
    essays.push({
      id: essays.length + 1,
      sceneTitle: middle.title,
      question: `"${middle.title}"에서 다룬 핵심 메커니즘을 원인 → 작용 → 결과의 3단계로 나누어 설명하시오.`,
      guidingThoughts: [
        `${middleBeats[0]?.label ?? "첫 단계"}의 시작 조건을 설명했는가?`,
        `${middleBeats[1]?.label ?? "중간 단계"}의 작용 원리를 제시했는가?`,
        `${middleBeats[2]?.label ?? "결과"}에 이르는 변화를 정리했는가?`,
      ],
      modelAnswer: middle.beats.map((beat) => beat.narration).join(" "),
      rubric: "3단계 순차 설명 6점, 핵심 용어의 정확한 사용 4점",
    });
  }
  if (last) {
    essays.push({
      id: essays.length + 1,
      sceneTitle: last.title,
      question: `오늘 배운 "${project.topic}"의 원리를 실생활 문제 해결에 적용할 수 있는 창의적인 방안을 제안하시오.`,
      guidingThoughts: [
        "배운 원리를 어떤 문제에 적용할지 분명히 밝혔는가?",
        "실현 가능성과 기대 효과를 함께 설명했는가?",
      ],
      modelAnswer: `${last.subtitle} 이 원리를 활용하면 일상의 문제를 더 체계적으로 개선할 수 있습니다.`,
      rubric: "원리의 바른 적용 5점, 창의성과 실현 가능성 5점",
    });
  }
  return essays;
}

export function buildWorksheet(project: Project): WorksheetData {
  return {
    fillIn: buildFillIn(project),
    multipleChoice: buildMultipleChoice(project),
    essays: buildEssays(project),
  };
}
