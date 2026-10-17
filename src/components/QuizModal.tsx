import { useEffect, useMemo, useState } from "react";
import {
  Check,
  GraduationCap,
  ListChecks,
  Loader2,
  RotateCcw,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { Project } from "../types/project";
import { Modal } from "./Modal";
import { useStudioStore } from "../store/studioStore";
import { buildQuiz, heuristicEssayFeedback } from "../lib/quiz";
import { gradeEssay } from "../lib/gemini";

interface QuizModalProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
}

export function QuizModal({ open, project, onClose }: QuizModalProps) {
  const store = useStudioStore();
  const quiz = useMemo(() => (project ? buildQuiz(project) : null), [project]);
  const [teacher, setTeacher] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [essays, setEssays] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [essayFeedback, setEssayFeedback] = useState<Record<number, { score: number; feedback: string }>>({});
  const [grading, setGrading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAnswers({});
    setEssays({});
    setSubmitted(false);
    setEssayFeedback({});
    setTeacher(false);
  }, [open, project]);

  if (!project || !quiz) return null;

  const correctCount = quiz.multipleChoice.filter(
    (item) => answers[item.id] === item.answerIndex,
  ).length;
  const totalScore = quiz.multipleChoice.length;

  const submit = () => {
    setSubmitted(true);
    const feedback: Record<number, { score: number; feedback: string }> = {};
    for (const essay of quiz.essays) {
      feedback[essay.id] = heuristicEssayFeedback(essays[essay.id] ?? "", essay);
    }
    setEssayFeedback(feedback);
    store.pushToast("success", "채점이 완료되었습니다. 해설과 피드백을 확인해 보세요.");
  };

  const runAiGrading = async () => {
    if (!store.apiKey.trim()) {
      store.pushToast("error", "AI 첨삭을 위해 Gemini API 키를 입력해 주세요.");
      return;
    }
    setGrading(true);
    try {
      const results: Record<number, { score: number; feedback: string }> = {};
      for (const essay of quiz.essays) {
        results[essay.id] = await gradeEssay({
          apiKey: store.apiKey,
          model: store.model,
          question: essay.question,
          rubric: essay.rubric,
          modelAnswer: essay.modelAnswer,
          answer: essays[essay.id] ?? "",
        });
      }
      setEssayFeedback(results);
      setSubmitted(true);
      store.pushToast("success", "AI 첨삭이 완료되었습니다.");
    } catch (error) {
      store.pushToast(
        "error",
        error instanceof Error ? error.message : "AI 첨삭 중 문제가 발생했습니다.",
      );
    } finally {
      setGrading(false);
    }
  };

  const reset = () => {
    setAnswers({});
    setEssays({});
    setSubmitted(false);
    setEssayFeedback({});
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      title="AI 웹 퀴즈"
      subtitle="형성평가 4지선다와 서술형 문항으로 수업 이해도를 확인합니다."
      icon={<ListChecks size={19} />}
      actions={
        <>
          <div className="teacher-toggle">
            <button type="button" className={!teacher ? "is-active" : ""} onClick={() => setTeacher(false)}>
              <UserRound size={13} /> 학생용
            </button>
            <button type="button" className={teacher ? "is-active" : ""} onClick={() => setTeacher(true)}>
              <GraduationCap size={13} /> 교사용
            </button>
          </div>
          <button type="button" className="mini-button" onClick={reset}>
            <RotateCcw size={13} />
            다시 풀기
          </button>
        </>
      }
    >
      <div className="quiz-shell">
        <div className="quiz-scorebar">
          <div>
            <span className="eyebrow">형성평가</span>
            <strong>{project.topic}</strong>
          </div>
          <div className="score-pill">
            {submitted ? (
              <>
                <Check size={15} />
                {correctCount} / {totalScore} 정답
              </>
            ) : (
              <>객관식 {totalScore}문항 · 서술형 {quiz.essays.length}문항</>
            )}
          </div>
        </div>

        <section className="quiz-section">
          <h3>1. 4지선다 형성평가</h3>
          {quiz.multipleChoice.map((item) => {
            const selected = answers[item.id];
            const showAnswer = teacher || submitted;
            return (
              <div className="quiz-card" key={item.id}>
                <div className="quiz-question-head">
                  <span className="question-number">{item.id}</span>
                  <div>
                    <small>{item.sceneTitle}</small>
                    <p>{item.question}</p>
                  </div>
                </div>
                <div className="quiz-options">
                  {item.options.map((option, index) => {
                    const isSelected = selected === index;
                    const isAnswer = item.answerIndex === index;
                    return (
                      <button
                        key={`${item.id}-${option}`}
                        type="button"
                        className={`quiz-option ${isSelected ? "is-selected" : ""} ${
                          showAnswer && isAnswer ? "is-correct" : ""
                        } ${showAnswer && isSelected && !isAnswer ? "is-wrong" : ""}`}
                        onClick={() => !submitted && setAnswers({ ...answers, [item.id]: index })}
                        disabled={submitted}
                      >
                        <b>{String.fromCharCode(65 + index)}</b>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>
                {showAnswer && (
                  <p className="quiz-explanation">
                    <strong>해설</strong> {item.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </section>

        <section className="quiz-section">
          <h3>2. 서술형 심층 문항</h3>
          {quiz.essays.map((item) => (
            <div className="quiz-card" key={item.id}>
              <div className="quiz-question-head">
                <span className="question-number">{item.id}</span>
                <div>
                  <small>{item.sceneTitle}</small>
                  <p>{item.question}</p>
                </div>
              </div>
              {teacher && (
                <div className="quiz-model-answer">
                  <strong>예시 답안</strong>
                  <p>{item.modelAnswer}</p>
                  <strong>루브릭</strong>
                  <p>{item.rubric}</p>
                </div>
              )}
              <textarea
                rows={5}
                className="text-area"
                value={essays[item.id] ?? ""}
                onChange={(event) => setEssays({ ...essays, [item.id]: event.target.value })}
                placeholder="배운 개념을 자신의 언어로 서술해 보세요."
                disabled={submitted}
              />
              {essayFeedback[item.id] && (
                <div className="essay-feedback">
                  <strong>{essayFeedback[item.id].score} / 10점</strong>
                  <p>{essayFeedback[item.id].feedback}</p>
                </div>
              )}
            </div>
          ))}
        </section>

        <div className="quiz-actions">
          <button type="button" className="primary-button" onClick={submit} disabled={submitted}>
            <Check size={15} />
            답안 제출하고 채점하기
          </button>
          <button type="button" className="secondary-button" onClick={runAiGrading} disabled={grading}>
            {grading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
            {grading ? "AI 첨삭 중..." : "AI 서술형 첨삭 받기"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
