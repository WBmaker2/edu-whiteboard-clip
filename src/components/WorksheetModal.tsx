import { useMemo, useState } from "react";
import { ClipboardList, GraduationCap, Printer, Sparkles, UserRound } from "lucide-react";
import type { Project } from "../types/project";
import { Modal } from "./Modal";
import { buildWorksheet } from "../lib/worksheet";

interface WorksheetModalProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
}

type WorksheetTab = "summary" | "fillIn" | "mcq" | "essay";

const TABS: { id: WorksheetTab; label: string }[] = [
  { id: "summary", label: "1. A4 핵심 요약 정리" },
  { id: "fillIn", label: "2. 개념 빈칸 퀴즈" },
  { id: "mcq", label: "3. 실전 4지선다" },
  { id: "essay", label: "4. 서술형 & 논술 루브릭" },
];

export function WorksheetModal({ open, project, onClose }: WorksheetModalProps) {
  const [tab, setTab] = useState<WorksheetTab>("summary");
  const [teacher, setTeacher] = useState(false);
  const worksheet = useMemo(() => (project ? buildWorksheet(project) : null), [project]);
  if (!project || !worksheet) return null;

  const today = new Date();
  const dateLabel = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      title="수업용 A4 요약 학습지"
      subtitle="요약 정리, 빈칸 퀴즈, 4지선다, 서술형 평가를 한 번에 인쇄합니다."
      icon={<ClipboardList size={19} />}
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
          <button type="button" className="primary-button small" onClick={() => window.print()}>
            <Printer size={14} />
            인쇄 / PDF
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
              {item.label}
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
                <strong>판서랩</strong>
                <small>교육용 화이트보드 영상 만들기</small>
              </span>
            </div>
            <div className="worksheet-meta">
              <span>발행일: {dateLabel}</span>
              <table>
                <tbody>
                  <tr>
                    <th>학년 / 반</th>
                    <th>번호</th>
                    <th>성명</th>
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
            <p className="eyebrow">5단계 교수학습 설계 · 핵심 개념 정리와 다면 평가</p>
            <h1>{project.topic}</h1>
            <p>{project.scenes[0]?.subtitle}</p>
          </div>

          {tab === "summary" && (
            <section className="worksheet-section">
              <h2>오늘의 핵심 학습 질문 &amp; 탐구 목표</h2>
              <div className="worksheet-question-box">
                <strong>{project.scenes[0]?.title}</strong>
                <p>{project.scenes[0]?.subtitle}</p>
              </div>
              <div className="worksheet-summary-list">
                {project.scenes.map((scene, index) => (
                  <article key={scene.id} className="worksheet-summary-item">
                    <div className="worksheet-summary-head">
                      <span className={`worksheet-step step-${scene.type}`}>
                        {index === 0 ? "도입" : index === project.scenes.length - 1 ? "정리" : `전개 ${index}단계`}
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
                <h3>2. 수업 배움 성찰 및 필기 노트</h3>
                <p>오늘 수업을 통해 새롭게 깨달은 원리나 더 탐구해 보고 싶은 점을 기록하세요.</p>
                <div className="reflection-lines" />
              </div>
            </section>
          )}

          {tab === "fillIn" && (
            <section className="worksheet-section">
              <h2>개념 빈칸 퀴즈</h2>
              <p className="worksheet-section-desc">밑줄에 들어갈 핵심 개념을 적어 보세요.</p>
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
              <h2>실전 4지선다 형성평가</h2>
              <p className="worksheet-section-desc">가장 알맞은 답을 하나 골라 표시하세요.</p>
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
                    {teacher && <p className="mcq-explanation">해설: {item.explanation}</p>}
                  </div>
                </div>
              ))}
            </section>
          )}

          {tab === "essay" && (
            <section className="worksheet-section">
              <h2>심층 서술형 &amp; 논술 루브릭</h2>
              <p className="worksheet-section-desc">각 문항의 조건을 확인하고 자신의 언어로 서술하세요.</p>
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
                        <strong>예시 답안</strong>
                        <p>{item.modelAnswer}</p>
                        <strong>루브릭</strong>
                        <p>{item.rubric}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </section>
          )}

          <footer className="worksheet-footer">
            판서랩 · 교육용 화이트보드 영상 만들기 · 교수학습용 비영리 교육자료로 자유롭게 활용할 수 있습니다.
          </footer>
        </div>
      </div>
    </Modal>
  );
}
