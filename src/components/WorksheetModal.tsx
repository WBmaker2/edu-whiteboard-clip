import { useMemo, useState } from "react";
import { ClipboardList, GraduationCap, Printer, Sparkles, UserRound } from "lucide-react";
import type { Project } from "../types/project";
import { Modal } from "./Modal";
import { buildWorksheet } from "../lib/worksheet";
import { useI18n } from "../lib/i18n";

interface WorksheetModalProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
}

type WorksheetTab = "summary" | "fillIn" | "mcq" | "essay";

const TABS: { id: WorksheetTab; labelKey: string }[] = [
  { id: "summary", labelKey: "worksheet.tabSummary" },
  { id: "fillIn", labelKey: "worksheet.tabFillIn" },
  { id: "mcq", labelKey: "worksheet.tabMcq" },
  { id: "essay", labelKey: "worksheet.tabEssay" },
];

export function WorksheetModal({ open, project, onClose }: WorksheetModalProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<WorksheetTab>("summary");
  const [teacher, setTeacher] = useState(false);
  const worksheet = useMemo(() => (project ? buildWorksheet(project) : null), [project]);
  if (!project || !worksheet) return null;

  const today = new Date();
  const dateLabel = t("worksheet.date", {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate(),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      title={t("worksheet.title")}
      subtitle={t("worksheet.subtitle")}
      icon={<ClipboardList size={19} />}
      actions={
        <>
          <div className="teacher-toggle">
            <button type="button" className={!teacher ? "is-active" : ""} onClick={() => setTeacher(false)}>
              <UserRound size={13} /> {t("worksheet.student")}
            </button>
            <button type="button" className={teacher ? "is-active" : ""} onClick={() => setTeacher(true)}>
              <GraduationCap size={13} /> {t("worksheet.teacher")}
            </button>
          </div>
          <button type="button" className="primary-button small" onClick={() => window.print()}>
            <Printer size={14} />
            {t("worksheet.print")}
          </button>
        </>
      }
    >
      <div className="worksheet-shell">
        <div className="worksheet-tabs">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "is-active" : ""}
              onClick={() => setTab(item.id)}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>

        <div className="worksheet-print-area">
          <header className="worksheet-header">
            <div className="worksheet-brand">
              <span className="worksheet-mark">
                <Sparkles size={16} />
              </span>
              <span>
                <strong>{t("worksheet.brand")}</strong>
                <small>{t("worksheet.brandTagline")}</small>
              </span>
            </div>
            <div className="worksheet-meta">
              <span>{t("worksheet.issuedOn", { date: dateLabel })}</span>
              <table>
                <tbody>
                  <tr>
                    <th>{t("worksheet.gradeClass")}</th>
                    <th>{t("worksheet.number")}</th>
                    <th>{t("worksheet.name")}</th>
                  </tr>
                  <tr>
                    <td />
                    <td />
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </header>

          <div className="worksheet-title">
            <p className="eyebrow">{t("worksheet.eyebrow")}</p>
            <h1>{project.topic}</h1>
            <p>{project.scenes[0]?.subtitle}</p>
          </div>

          {tab === "summary" && (
            <section className="worksheet-section">
              <h2>{t("worksheet.summaryTitle")}</h2>
              <div className="worksheet-question-box">
                <strong>{project.scenes[0]?.title}</strong>
                <p>{project.scenes[0]?.subtitle}</p>
              </div>
              <div className="worksheet-summary-list">
                {project.scenes.map((scene, index) => (
                  <article key={scene.id} className="worksheet-summary-item">
                    <div className="worksheet-summary-head">
                      <span className={`worksheet-step step-${scene.type}`}>
                        {index === 0
                          ? t("worksheet.intro")
                          : index === project.scenes.length - 1
                            ? t("worksheet.wrapUp")
                            : t("worksheet.development", { step: index })}
                      </span>
                      <strong>{scene.title}</strong>
                      <p>{scene.subtitle}</p>
                    </div>
                    <div className="worksheet-beat-grid">
                      {scene.beats.map((beat) => (
                        <div key={beat.id} className="worksheet-beat">
                          <strong>{beat.label}</strong>
                          <span>{beat.desc}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
              <div className="worksheet-reflection">
                <h3>{t("worksheet.reflectionTitle")}</h3>
                <p>{t("worksheet.reflectionBody")}</p>
                <div className="reflection-lines" />
              </div>
            </section>
          )}

          {tab === "fillIn" && (
            <section className="worksheet-section">
              <h2>{t("worksheet.fillInTitle")}</h2>
              <p className="worksheet-section-desc">{t("worksheet.fillInDesc")}</p>
              {worksheet.fillIn.map((item) => (
                <div className="worksheet-question" key={item.id}>
                  <span className="question-number">{item.id}</span>
                  <p>{item.question}</p>
                  {teacher && <span className="answer-chip">{item.answer}</span>}
                </div>
              ))}
            </section>
          )}

          {tab === "mcq" && (
            <section className="worksheet-section">
              <h2>{t("worksheet.mcqTitle")}</h2>
              <p className="worksheet-section-desc">{t("worksheet.mcqDesc")}</p>
              {worksheet.multipleChoice.map((item) => (
                <div className="worksheet-question mcq" key={item.id}>
                  <span className="question-number">{item.id}</span>
                  <div>
                    <p className="mcq-question">{item.question}</p>
                    <div className="mcq-options">
                      {item.options.map((option, index) => (
                        <span
                          key={`${item.id}-${option}`}
                          className={`mcq-option ${teacher && index === item.answerIndex ? "is-answer" : ""}`}
                        >
                          <b>{String.fromCharCode(65 + index)}</b>
                          {option}
                        </span>
                      ))}
                    </div>
                    {teacher && <p className="mcq-explanation">{t("worksheet.explanation", { explanation: item.explanation })}</p>}
                  </div>
                </div>
              ))}
            </section>
          )}

          {tab === "essay" && (
            <section className="worksheet-section">
              <h2>{t("worksheet.essayTitle")}</h2>
              <p className="worksheet-section-desc">{t("worksheet.essayDesc")}</p>
              {worksheet.essays.map((item) => (
                <div className="worksheet-question essay" key={item.id}>
                  <span className="question-number">{item.id}</span>
                  <div>
                    <p className="mcq-question">{item.question}</p>
                    <ul className="guiding-list">
                      {item.guidingThoughts.map((thought) => (
                        <li key={thought}>{thought}</li>
                      ))}
                    </ul>
                    <div className="essay-lines" />
                    {teacher && (
                      <div className="teacher-answer">
                        <strong>{t("worksheet.modelAnswer")}</strong>
                        <p>{item.modelAnswer}</p>
                        <strong>{t("worksheet.rubric")}</strong>
                        <p>{item.rubric}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </section>
          )}

          <footer className="worksheet-footer">
            {t("worksheet.footer")}
          </footer>
        </div>
      </div>
    </Modal>
  );
}
