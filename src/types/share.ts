import type { Project } from "./project";

export interface SharedProjectData {
  version: number;
  project: Project;
}

export interface QuizQuestionRaw {
  id: number;
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
}

export interface SharedQuizData {
  version: number;
  title: string;
  questions: QuizQuestionRaw[];
}
