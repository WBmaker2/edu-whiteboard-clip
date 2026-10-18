import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, ListChecks, RotateCcw, Sparkles, X } from "lucide-react";
import { decodeSharedQuiz, readQuizData, type SharedQuiz } from "../lib/share";
import { heuristicEssayFeedback } from "../lib/quiz";
import { downloadBlob, downloadText, sanitizeFileName } from "../lib/download";
import { fillGridPattern } from "../lib/renderer/background";
import { roundedPath, text, themeOf } from "../lib/renderer/core";
import { APP_NAME } from "../data/presets";
import { useI18n } from "../lib/i18n";

export function QuizViewer() {
  const { t } = useI18n();
  const [shared, setShared] = useState<SharedQuiz | null>(null);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [essays, setEssays] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const resultCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const data = readQuizData(window.location.hash);
    if (!data) {
      setError(t("quizViewer.errorNoData"));
      return;
    }
    try {
      setShared(decodeSharedQuiz(data));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("quizViewer.errorDecodeFailed"));
    }
  }, [t]);

  const quiz = shared?.quiz ?? null;

  const essayFeedback = useMemo(() => {
    if (!submitted || !quiz) return {};
    const feedback: Record<number, { score: number; feedback: string }> = {};
    for (const essay of quiz.essays) {
      feedback[essay.id] = heuristicEssayFeedback(essays[essay.id] ?? "", essay);
    }
    return feedback;
  }, [submitted, quiz, essays]);

  const correctCount = quiz
    ? quiz.multipleChoice.filter((item) => answers[item.id] === item.answerIndex).length
    : 0;
  const totalScore = quiz?.multipleChoice.length ?? 0;
  const essayAverage =
    quiz && quiz.essays.length > 0
      ? Math.round(
          quiz.essays.reduce((sum, essay) => sum + (essayFeedback[essay.id]?.score ?? 0), 0) /
            quiz.essays.length,
        )
      : 0;

  const reset = () => {
    setAnswers({});
    setEssays({});
    setSubmitted(false);
  };

  const resultPayload = () =>
    JSON.stringify(
      {
        kind: "panseolab-quiz-result",
        topic: shared?.topic ?? "",
        gradedAt: new Date().toISOString(),
        multipleChoice: quiz?.multipleChoice.map((item) => ({
          id: item.id,
          question: item.question,
          selected: answers[item.id] ?? null,
          answerIndex: item.answerIndex,
          correct: answers[item.id] === item.answerIndex,
        })),
        essays: quiz?.essays.map((essay) => ({
          id: essay.id,
          question: essay.question,
          answer: essays[essay.id] ?? "",
          score: essayFeedback[essay.id]?.score ?? null,
          feedback: essayFeedback[essay.id]?.feedback ?? "",
        })),
        summary: { correctCount, totalScore, essayAverage },
      },
      null,
      2,
    );

  const saveResultJson = () => {
    if (!shared) return;
    downloadText(
      `${sanitizeFileName(shared.topic, "quiz")}_quiz_result.json`,
      resultPayload(),
      "application/json;charset=utf-8",
    );
  };

  const saveResultImage = () => {
    const canvas = resultCanvasRef.current;
    if (!canvas || !shared || !quiz) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const theme = themeOf("paper");
    const width = 1080;
    const height = 1440;
    canvas.width = width;
    canvas.height = height;
    fillGridPattern(ctx, width, height, theme);
    text(ctx, t("quizViewer.canvasTitle"), width / 2, 110, {
      size: 44,
      weight: 900,
      color: theme.title,
    });
    text(ctx, shared.topic, width / 2, 170, {
      size: 24,
      weight: 600,
      color: theme.subtitle,
      maxWidth: 900,
    });
    const scoreCard = roundedPath(90, 230, 900, 190, 20);
    ctx.fillStyle = theme.cardBg;
    ctx.fill(scoreCard);
    ctx.strokeStyle = theme.cardBorderActive;
    ctx.lineWidth = 2.5;
    ctx.stroke(scoreCard);
    text(ctx, `${correctCount} / ${totalScore}`, width / 2, 310, {
      size: 64,
      weight: 900,
      color: theme.accent,
    });
    text(
      ctx,
      quiz.essays.length > 0
        ? t("quizViewer.canvasEssaySummary", { average: essayAverage })
        : t("quizViewer.canvasCorrectOnly"),
      width / 2,
      380,
      { size: 22, weight: 600, color: theme.subtitle },
    );
    let y = 490;
    quiz.multipleChoice.forEach((item, index) => {
      const correct = answers[item.id] === item.answerIndex;
      text(ctx, `${correct ? "O" : "X"}  ${index + 1}. ${item.question}`, 110, y, {
        size: 22,
        weight: 700,
        color: correct ? "#0f9d76" : "#cf3f3f",
        align: "left",
        maxWidth: 860,
      });
      y += 52;
    });
    text(ctx, t("quizViewer.canvasFooter", { date: new Date().toLocaleDateString("ko-KR") }), width / 2, height - 80, {
      size: 20,
      weight: 600,
      color: theme.subtitle,
    });
    canvas.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, `${sanitizeFileName(shared.topic, "quiz")}_quiz_result.png`);
      }
    }, "image/png");
  };

  if (error) {
    return (
      <div className="share-viewer">
        <div className="share-card">
          <h1>{t("quizViewer.errorTitle", { app: APP_NAME })}</h1>
          <p>{error}</p>
          <a className="primary-button" href="./">
            {t("quizViewer.openApp")}
          </a>
        </div>
      </div>
    );
  }

  if (!shared || !quiz) return null;

  return (
    <div className="quiz-viewer">
      <header className="share-header">
        <span className="share-brand">
          <Sparkles size={15} />
          {APP_NAME}
        </span>
        <span className="share-subtitle">{t("quizViewer.subtitle")}</span>
      </header>
      <main className="quiz-viewer-main">
        <div className="quiz-scorebar">
          <div>
            <span className="eyebrow">{t("quizViewer.eyebrow")}</span>
            <strong>{shared.topic}</strong>
          </div>
          <div className="score-pill">
            {submitted ? (
              <>
                <Check size={15} />
                {t("quizViewer.scoreCorrect", { correct: correctCount, total: totalScore })}
              </>
            ) : (
              <>{t("quizViewer.questionBreakdown", { multiple: quiz.multipleChoice.length, essays: quiz.essays.length })}</>
            )}
          </div>
        </div>

        <section className="quiz-section">
          <h3>{t("quizViewer.multipleChoiceSection")}</h3>
          {quiz.multipleChoice.map((item) => {
            const selected = answers[item.id];
            const showAnswer = submitted;
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
                {submitted && (
                  <div className={`quiz-feedback ${selected === item.answerIndex ? "is-ok" : "is-bad"}`}>
                    {selected === item.answerIndex ? <Check size={14} /> : <X size={14} />}
                    <p>{item.explanation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {quiz.essays.length > 0 && (
          <section className="quiz-section">
            <h3>{t("quizViewer.essaySection")}</h3>
            {quiz.essays.map((essay) => {
              const feedback = essayFeedback[essay.id];
              return (
                <div className="quiz-card" key={essay.id}>
                  <div className="quiz-question-head">
                    <span className="question-number">{essay.id}</span>
                    <div>
                      <small>{essay.sceneTitle}</small>
                      <p>{essay.question}</p>
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    className="text-area compact-area"
                    value={essays[essay.id] ?? ""}
                    onChange={(event) =>
                      setEssays({ ...essays, [essay.id]: event.target.value })
                    }
                    placeholder={t("quizViewer.essayPlaceholder")}
                    disabled={submitted}
                  />
                  {submitted && feedback && (
                    <div className="quiz-feedback is-ok">
                      <Check size={14} />
                      <p>
                        {t("quizViewer.autoFeedback", { score: feedback.score, feedback: feedback.feedback })}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        <div className="quiz-viewer-actions">
          {!submitted ? (
            <button
              type="button"
              className="primary-button btn-pulse"
              onClick={() => setSubmitted(true)}
              disabled={quiz.multipleChoice.some((item) => answers[item.id] === undefined)}
            >
              <ListChecks size={16} />
              {t("quizViewer.submit")}
            </button>
          ) : (
            <>
              <button type="button" className="primary-button" onClick={saveResultImage}>
                <Download size={15} />
                {t("quizViewer.saveImage")}
              </button>
              <button type="button" className="secondary-button" onClick={saveResultJson}>
                {t("quizViewer.saveJson")}
              </button>
              <button type="button" className="mini-button" onClick={reset}>
                <RotateCcw size={13} />
                {t("quizViewer.retry")}
              </button>
            </>
          )}
        </div>
        <p className="helper-note">
          {t("quizViewer.helperNote")}
        </p>
        <canvas ref={resultCanvasRef} className="result-canvas-hidden" aria-hidden="true" />
      </main>
    </div>
  );
}
