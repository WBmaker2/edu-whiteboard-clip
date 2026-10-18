import { useEffect, useMemo, useState } from "react";
import {
  Check,
  GraduationCap,
  Link2,
  ListChecks,
  Loader2,
  RotateCcw,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { Project } from "../types/project";
import { Modal } from "./Modal";
import { useShallow } from "zustand/react/shallow";
import { useStudioStore } from "../store/studioStore";
import { buildQuiz, heuristicEssayFeedback } from "../lib/quiz";
import { encodeSharedQuiz, MAX_SHARE_URL_LENGTH } from "../lib/share";
import { useI18n } from "../lib/i18n";

interface QuizModalProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
}

export function QuizModal({ open, project, onClose }: QuizModalProps) {
  const { t } = useI18n();
  const store = useStudioStore(
    useShallow((state) => ({
      apiKey: state.apiKey,
      model: state.model,
      pushToast: state.pushToast,
    })),
  );
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

  const copyStudentLink = async () => {
    try {
      const encoded = encodeSharedQuiz(project.topic, quiz);
      const url = `${window.location.origin}${window.location.pathname}#quiz=${encoded}`;
      if (url.length > MAX_SHARE_URL_LENGTH) {
        store.pushToast(
          "info",
          t("quiz.toastShareTooLarge"),
        );
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        store.pushToast(
          "success",
          t("quiz.toastLinkCopied"),
        );
      } catch {
        window.prompt(t("quiz.promptCopyLink"), url);
      }
    } catch (error) {
      store.pushToast(
        "error",
        error instanceof Error ? error.message : t("quiz.toastLinkFailed"),
      );
    }
  };

  const submit = () => {
    setSubmitted(true);
    const feedback: Record<number, { score: number; feedback: string }> = {};
    for (const essay of quiz.essays) {
      feedback[essay.id] = heuristicEssayFeedback(essays[essay.id] ?? "", essay);
    }
    setEssayFeedback(feedback);
    store.pushToast("success", t("quiz.toastGraded"));
  };

  const runAiGrading = async () => {
    if (!store.apiKey.trim()) {
      store.pushToast("error", t("quiz.toastNeedApiKey"));
      return;
    }
    setGrading(true);
    try {
      const results: Record<number, { score: number; feedback: string }> = {};
      const { gradeEssay } = await import("../lib/gemini");
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
      store.pushToast("success", t("quiz.toastAiGraded"));
    } catch (error) {
      store.pushToast(
        "error",
        error instanceof Error ? error.message : t("quiz.toastAiGradingFailed"),
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
      title={t("quiz.title")}
      subtitle={t("quiz.subtitle")}
      icon={<ListChecks size={19} />}
      actions={
        <>
          <div className="teacher-toggle">
            <button type="button" className={!teacher ? "is-active" : ""} onClick={() => setTeacher(false)}>
              <UserRound size={13} /> {t("quiz.studentMode")}
            </button>
            <button type="button" className={teacher ? "is-active" : ""} onClick={() => setTeacher(true)}>
              <GraduationCap size={13} /> {t("quiz.teacherMode")}
            </button>
          </div>
          <button type="button" className="mini-button is-ai btn-pulse" onClick={() => void copyStudentLink()}>
            <Link2 size={13} />
            {t("quiz.copyStudentLink")}
          </button>
          <button type="button" className="mini-button" onClick={reset}>
            <RotateCcw size={13} />
            {t("quiz.retry")}
          </button>
        </>
      }
    >
      <div className="quiz-shell">
        <div className="quiz-scorebar">
          <div>
            <span className="eyebrow">{t("quiz.sectionEyebrow")}</span>
            <strong>{project.topic}</strong>
          </div>
          <div className="score-pill">
            {submitted ? (
              <>
                <Check size={15} />
                {t("quiz.scoreCorrect", { correct: correctCount, total: totalScore })}
              </>
            ) : (
              <>{t("quiz.questionBreakdown", { multiple: totalScore, essays: quiz.essays.length })}</>
            )}
          </div>
        </div>

        <section className="quiz-section">
          <h3>{t("quiz.multipleChoiceSection")}</h3>
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
                    <strong>{t("quiz.explanation")}</strong> {item.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </section>

        <section className="quiz-section">
          <h3>{t("quiz.essaySection")}</h3>
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
                  <strong>{t("quiz.modelAnswer")}</strong>
                  <p>{item.modelAnswer}</p>
                  <strong>{t("quiz.rubric")}</strong>
                  <p>{item.rubric}</p>
                </div>
              )}
              <textarea
                rows={5}
                className="text-area"
                value={essays[item.id] ?? ""}
                onChange={(event) => setEssays({ ...essays, [item.id]: event.target.value })}
                placeholder={t("quiz.essayPlaceholder")}
                disabled={submitted}
              />
              {essayFeedback[item.id] && (
                <div className="essay-feedback">
                  <strong>{t("quiz.essayScore", { score: essayFeedback[item.id].score })}</strong>
                  <p>{essayFeedback[item.id].feedback}</p>
                </div>
              )}
            </div>
          ))}
        </section>

        <div className="quiz-actions">
          <button type="button" className="primary-button" onClick={submit} disabled={submitted}>
            <Check size={15} />
            {t("quiz.submit")}
          </button>
          <button type="button" className="secondary-button" onClick={runAiGrading} disabled={grading}>
            {grading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
            {grading ? t("quiz.grading") : t("quiz.aiFeedback")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
