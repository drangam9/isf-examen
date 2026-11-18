import { useEffect, useState } from 'react'
import questions from './data/questions.json'
import referencePdf from '../Întrebări Conducător_16.01.2026.pdf?url'
import { createRandomExam, expireExam, remainingSeconds, restoreExam, submitExamAnswer } from './exam.js'
import './App.css'

const TEST_SIZE = 40
const STORAGE_KEY = 'isf-quiz-progress-v2'
const LEGACY_STORAGE_KEY = 'asf-quiz-progress-v1'
const EMPTY_SESSION = { questionIndex: 0, selectedAnswer: null, submitted: false }
const answerLetters = ['A', 'B', 'C']
const tests = Array.from({ length: Math.ceil(questions.length / TEST_SIZE) }, (_, index) => {
  const start = index * TEST_SIZE

  return {
    number: index + 1,
    start: start + 1,
    end: Math.min(start + TEST_SIZE, questions.length),
    questions: questions.slice(start, start + TEST_SIZE),
  }
})

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY) ?? 'null')
    if (!saved || ![1, 2].includes(saved.version)) throw new Error('No saved quiz progress')

    const selectedTestIndex = Number.isInteger(saved.selectedTestIndex) && tests[saved.selectedTestIndex]
      ? saved.selectedTestIndex
      : 0
    const sessions = Object.fromEntries(tests.map((test, index) => {
      const savedSession = saved.sessions?.[index] ?? {}
      const questionIndex = Number.isInteger(savedSession.questionIndex) && test.questions[savedSession.questionIndex]
        ? savedSession.questionIndex
        : 0
      const answerCount = test.questions[questionIndex].answers.length
      const selectedAnswer = Number.isInteger(savedSession.selectedAnswer) && savedSession.selectedAnswer >= 0 && savedSession.selectedAnswer < answerCount
        ? savedSession.selectedAnswer
        : null

      return [index, {
        ...EMPTY_SESSION,
        questionIndex,
        selectedAnswer,
        submitted: Boolean(savedSession.submitted && selectedAnswer !== null),
      }]
    }))
    const results = Object.fromEntries(tests.map((test, index) => [
      index,
      Object.fromEntries(Object.entries(saved.results?.[index] ?? {}).filter(([, value]) => typeof value === 'boolean')),
    ]))
    const completedTests = Object.fromEntries(tests.map((test, index) => [index, Boolean(saved.completedTests?.[index])]))
    const view = ['selection', 'question', 'results'].includes(saved.view) ? saved.view : 'selection'
    const mode = saved.version === 2 && saved.mode === 'ordered' ? 'ordered' : 'exam'
    const exam = restoreExam(saved.exam, questions)

    return {
      version: 2,
      mode,
      exam,
      timerEnabled: Boolean(saved.timerEnabled),
      selectedTestIndex,
      sessions,
      results,
      completedTests,
      view: mode === 'exam'
        ? exam?.completed ? 'results' : exam && view === 'question' ? 'question' : 'selection'
        : view === 'results' && !completedTests[selectedTestIndex] ? 'selection' : view,
    }
  } catch {
    return {
      version: 2,
      mode: 'exam',
      exam: null,
      timerEnabled: false,
      selectedTestIndex: 0,
      sessions: Object.fromEntries(tests.map((_, index) => [index, { ...EMPTY_SESSION }])),
      results: {},
      completedTests: {},
      view: 'selection',
    }
  }
}

function App() {
  const [progressState, setProgressState] = useState(loadProgress)
  const { selectedTestIndex, sessions, results, completedTests, view, mode, exam, timerEnabled } = progressState
  const isExam = mode === 'exam'
  const [now, setNow] = useState(Date.now)
  const activeSession = isExam ? exam ?? EMPTY_SESSION : sessions[selectedTestIndex] ?? EMPTY_SESSION
  const { questionIndex, selectedAnswer, submitted } = activeSession

  const activeTest = isExam ? {
    questions: exam ? exam.questionNumbers.map((number) => questions.find((question) => question.number === number)) : questions.slice(0, TEST_SIZE),
  } : tests[selectedTestIndex]
  const currentQuestion = activeTest.questions[questionIndex]
  const testResults = isExam ? exam?.results ?? {} : results[selectedTestIndex] ?? {}
  const score = Object.values(testResults).filter(Boolean).length
  const progress = ((questionIndex + 1) / activeTest.questions.length) * 100
  const answeredCount = Object.keys(testResults).length
  const canContinue = isExam ? Boolean(exam && !exam.completed) : answeredCount > 0 || questionIndex > 0 || submitted
  const incorrectQuestions = activeTest.questions.filter((question) => testResults[question.number] === false)
  const unansweredQuestions = activeTest.questions.filter((question) => testResults[question.number] === undefined)
  const secondsLeft = remainingSeconds(exam, now)
  const testLabel = isExam ? 'EXAMEN ALEATORIU' : `TEST ${activeTest.number.toString().padStart(2, '0')}`

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progressState))
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }, [progressState])

  useEffect(() => {
    if (!exam || exam.completed || exam.expiresAt === null) return
    function tick() {
      const timestamp = Date.now()
      setNow(timestamp)
      setProgressState((previous) => {
        const updated = expireExam(previous.exam, timestamp)
        return updated === previous.exam ? previous : {
          ...previous,
          exam: updated,
          view: previous.mode === 'exam' ? 'results' : previous.view,
        }
      })
    }
    tick()
    const interval = window.setInterval(tick, 250)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [exam?.expiresAt, exam?.completed])

  function selectMode(nextMode) {
    setProgressState((previous) => ({
      ...previous,
      mode: nextMode,
      view: (nextMode === 'exam' ? previous.exam?.completed : previous.completedTests[previous.selectedTestIndex]) ? 'results' : 'selection',
    }))
  }

  function selectTest(index) {
    setProgressState((previous) => ({
      ...previous,
      selectedTestIndex: index,
      view: previous.completedTests[index] ? 'results' : 'selection',
    }))
  }

  function startTest() {
    if (isExam) {
      const timestamp = Date.now()
      setNow(timestamp)
      setProgressState((previous) => ({
        ...previous,
        exam: createRandomExam(questions, previous.timerEnabled, timestamp),
        view: 'question',
      }))
      return
    }
    setProgressState((previous) => ({
      ...previous,
      view: 'question',
      sessions: {
        ...previous.sessions,
        [selectedTestIndex]: { ...EMPTY_SESSION },
      },
      results: { ...previous.results, [selectedTestIndex]: {} },
      completedTests: { ...previous.completedTests, [selectedTestIndex]: false },
    }))
  }

  function continueTest() {
    setProgressState((previous) => ({ ...previous, view: 'question' }))
  }

  function submitAnswer() {
    if (selectedAnswer === null) return
    if (isExam) {
      setProgressState((previous) => {
        const updated = submitExamAnswer(previous.exam, questions, previous.exam.selectedAnswer)
        return { ...previous, exam: updated, view: updated.completed ? 'results' : 'question' }
      })
      return
    }

    setProgressState((previous) => ({
      ...previous,
      view: 'question',
      sessions: {
        ...previous.sessions,
        [selectedTestIndex]: { ...activeSession, submitted: true },
      },
      results: {
        ...previous.results,
        [selectedTestIndex]: {
          ...testResults,
          [currentQuestion.number]: currentQuestion.answers[selectedAnswer].isCorrect,
        },
      },
    }))
  }

  function nextQuestion() {
    if (questionIndex === activeTest.questions.length - 1) {
      setProgressState((previous) => ({
        ...previous,
        view: 'results',
        sessions: {
          ...previous.sessions,
          [selectedTestIndex]: { ...activeSession, submitted: true },
        },
        completedTests: { ...previous.completedTests, [selectedTestIndex]: true },
      }))
      return
    }

    setProgressState((previous) => ({
      ...previous,
      sessions: {
        ...previous.sessions,
        [selectedTestIndex]: {
          ...activeSession,
          questionIndex: questionIndex + 1,
          selectedAnswer: null,
          submitted: false,
        },
      },
    }))
  }

  const selectedIsCorrect = selectedAnswer !== null && currentQuestion.answers[selectedAnswer].isCorrect

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" onClick={() => selectMode('exam')} aria-label="ISF, pagina principală">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span>ISF <i>·</i> EXAMEN</span>
        </a>
        <div className="topbar-note">
          <span className="status-dot" />
          Examen Conducător
        </div>
      </header>

      <main id="top" className="workspace">
        <section className="intro-row" aria-label="Titlu">
          <div>
            <p className="eyebrow">SIMULATOR DE EXAMEN <span> / </span> 2026</p>
            <h1>Pregătire pentru examenul de Conducător</h1>
            <p className="intro-summary">Teste pentru examenul de Conducător organizat de ISF, cu {questions.length} întrebări din documentul de referință.</p>
          </div>
          <div className="question-bank-count"><strong>{questions.length}</strong><span>întrebări<br />în bancă</span></div>
        </section>

        <nav className="mode-navigation" aria-label="Secțiuni de pregătire">
          <button className={`mode-choice ${isExam ? 'is-active' : ''}`} aria-pressed={isExam} onClick={() => selectMode('exam')} type="button">
            <strong>Examen aleatoriu</strong><span>40 de întrebări · cronometru opțional</span>
          </button>
          <button className={`mode-choice ${!isExam ? 'is-active' : ''}`} aria-pressed={!isExam} onClick={() => selectMode('ordered')} type="button">
            <strong>Teste în ordinea PDF-ului</strong><span>{tests.length} teste de pregătire · progres salvat</span>
          </button>
        </nav>

        <div className={`quiz-layout ${isExam ? 'exam-layout' : ''}`}>
          {!isExam && <aside className="test-sidebar" aria-label="Selectare test">
            <div className="sidebar-heading">
              <h2>Teste</h2>
              <span>{tests.length.toString().padStart(2, '0')}</span>
            </div>
            <nav className="test-list">
              {tests.map((test, index) => (
                <button
                  className={`test-choice ${selectedTestIndex === index ? 'is-selected' : ''}`}
                  key={test.number}
                  onClick={() => selectTest(index)}
                  type="button"
                  aria-current={selectedTestIndex === index ? 'step' : undefined}
                >
                  <span className="test-number">{test.number.toString().padStart(2, '0')}</span>
                  <span className="test-range">{test.start}–{test.end}</span>
                  {completedTests[index] && (
                    <span className="test-score" aria-label={`Scor ${Object.values(results[index] ?? {}).filter(Boolean).length} din ${test.questions.length}`}>
                      {Object.values(results[index] ?? {}).filter(Boolean).length}/{test.questions.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div className="sidebar-footnote">
              <span className="sidebar-rule" />
              <span>40 întrebări / test</span>
              <span>Ultimul test: {tests.at(-1).questions.length}</span>
              <span>Progres salvat în acest browser</span>
            </div>
          </aside>}

          <section className="quiz-content">
            {isExam && exam && !exam.completed && view === 'question' && (
              <div className="exam-status">
                <button className="text-button" onClick={() => setProgressState((previous) => ({ ...previous, view: 'selection' }))} type="button">← Înapoi la examen</button>
                <span className={`exam-timer ${secondsLeft !== null && secondsLeft <= 300 ? 'is-urgent' : ''}`} role="timer" aria-label="Timp rămas" aria-live="off">
                  {secondsLeft === null ? 'Fără cronometru' : `${Math.floor(secondsLeft / 60).toString().padStart(2, '0')}:${(secondsLeft % 60).toString().padStart(2, '0')}`}
                </span>
              </div>
            )}
            {view === 'selection' && (
              <div className="selection-view">
                <div className="section-kicker">{testLabel} <span>·</span> {isExam ? 'SIMULARE CONDUCĂTOR' : tests.length.toString().padStart(2, '0')}</div>
                <div className="selection-copy">
                  <p className="range-label">{isExam ? '40 DE ÎNTREBĂRI · O NOUĂ PROVOCARE' : `ÎNTREBĂRILE ${activeTest.start}–${activeTest.end}`}</p>
                  <h2>{isExam ? 'Exersează în ritmul examenului.' : 'Un test. Un singur răspuns corect.'}</h2>
                  <p className="selection-summary">{isExam ? `40 de întrebări distincte, alese aleatoriu din cele ${questions.length} de întrebări. Un singur răspuns corect. Rezultatul și răspunsurile corecte sunt afișate la final.` : `${activeTest.questions.length} întrebări din banca de examen, în ordinea documentului.`}</p>
                  {canContinue && <p className="saved-progress">Ai răspuns deja la {answeredCount} întrebări. Poți continua de unde ai rămas.</p>}
                  {isExam && (
                    <label className="timer-option">
                      <input type="checkbox" checked={canContinue ? exam.expiresAt !== null : timerEnabled} disabled={canContinue} onChange={(event) => setProgressState((previous) => ({ ...previous, timerEnabled: event.target.checked }))} />
                      <span><strong>Cronometru de 40 de minute</strong><small>{canContinue && exam.expiresAt !== null ? 'Cronometrul continuă să ruleze până la încheierea examenului.' : 'La expirarea timpului, examenul se încheie automat.'}</small></span>
                    </label>
                  )}
                </div>
                <button className="primary-button" onClick={canContinue ? continueTest : startTest} type="button">
                  {canContinue ? isExam ? 'Continuă examenul' : 'Continuă testul' : isExam ? 'Începe examenul' : 'Începe testul'} <span aria-hidden="true">→</span>
                </button>
                {isExam && canContinue && <button className="text-button new-exam-button" onClick={() => setProgressState((previous) => ({ ...previous, exam: null, view: 'selection' }))} type="button">Renunță și pregătește un examen nou</button>}
                <div className="selection-index"><span>{isExam ? 'ALEATORIU' : '01'}</span><span className="index-line" /><span>{isExam ? '40 DE ÎNTREBĂRI' : tests.length.toString().padStart(2, '0')}</span></div>
              </div>
            )}

            {view === 'question' && (
              <div className="question-view" key={`${mode}-${selectedTestIndex}-${questionIndex}`}>
                <div className="question-topline">
                  <span>{testLabel}</span>
                  <span>ÎNTREBAREA {questionIndex + 1}<i> / </i>{activeTest.questions.length}</span>
                </div>
                <div className="progress-track" aria-label={`Progres ${Math.round(progress)}%`}>
                  <span style={{ width: `${progress}%` }} />
                </div>

                <div className="question-heading">
                  <span className="question-index">{(questionIndex + 1).toString().padStart(2, '0')}</span>
                  <h2>{currentQuestion.prompt}</h2>
                </div>

                <fieldset className="answer-list" disabled={submitted}>
                  <legend className="visually-hidden">Alege un răspuns</legend>
                  {currentQuestion.answers.map((answer, index) => {
                    const isSelected = selectedAnswer === index
                    const isCorrectAnswer = submitted && answer.isCorrect
                    const isWrongSelection = submitted && isSelected && !answer.isCorrect
                    const stateClass = isCorrectAnswer ? 'is-correct' : isWrongSelection ? 'is-wrong' : ''

                    return (
                      <label className={`answer-option ${isSelected ? 'is-selected' : ''} ${stateClass}`} key={`${currentQuestion.number}-${index}`}>
                        <input
                          checked={isSelected}
                          name={`question-${currentQuestion.number}`}
                          onChange={() => setProgressState((previous) => ({
                            ...previous,
                            ...(isExam ? { exam: { ...previous.exam, selectedAnswer: index } } : {
                            sessions: {
                              ...previous.sessions,
                              [selectedTestIndex]: { ...activeSession, selectedAnswer: index },
                            },
                            }),
                          }))}
                          type="radio"
                        />
                        <span className="answer-letter">{answerLetters[index]}</span>
                        <span className="answer-text">{answer.text}</span>
                        {isCorrectAnswer && <span className="answer-mark" aria-label="Răspuns corect">✓</span>}
                      </label>
                    )
                  })}
                </fieldset>

                {submitted && (
                  <div className={`answer-feedback ${selectedIsCorrect ? 'feedback-correct' : 'feedback-wrong'}`} role="status">
                    <strong>{selectedIsCorrect ? 'Răspuns corect' : 'Răspuns greșit'}</strong>
                    {!selectedIsCorrect && <span>Varianta corectă: {answerLetters[currentQuestion.answers.findIndex((answer) => answer.isCorrect)]}</span>}
                  </div>
                )}

                <div className="question-actions">
                  <span className="answered-count">{answeredCount} / {activeTest.questions.length} rezolvate</span>
                  {!submitted ? (
                    <button className="primary-button" disabled={selectedAnswer === null} onClick={submitAnswer} type="button">
                      {isExam ? questionIndex === activeTest.questions.length - 1 ? 'Finalizează examenul' : 'Înregistrează răspunsul' : 'Verifică răspunsul'} <span aria-hidden="true">→</span>
                    </button>
                  ) : (
                    <button className="primary-button" onClick={nextQuestion} type="button">
                      {questionIndex === activeTest.questions.length - 1 ? 'Vezi rezultatul' : 'Întrebarea următoare'}
                      <span aria-hidden="true">→</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {view === 'results' && (
              <div className="results-view">
                <div className="section-kicker">{testLabel} <span>·</span> REZULTAT</div>
                <div className="result-score">
                  <strong>{score.toString().padStart(2, '0')}</strong>
                  <span> / {activeTest.questions.length}</span>
                </div>
                <h2>{isExam && exam?.timedOut ? 'Timpul a expirat.' : score === activeTest.questions.length ? 'Excelent.' : isExam ? 'Examen încheiat.' : 'Test încheiat.'}</h2>
                <p className="result-caption">Răspunsuri corecte</p>
                {isExam && <p className="result-breakdown">{score} corecte · {incorrectQuestions.length} greșite · {unansweredQuestions.length} fără răspuns</p>}
                <div className="result-actions">
                  <button className="primary-button" onClick={isExam ? () => setProgressState((previous) => ({ ...previous, exam: null, view: 'selection' })) : startTest} type="button">{isExam ? 'Examen nou' : 'Reia testul'} <span aria-hidden="true">↻</span></button>
                  {!isExam && selectedTestIndex < tests.length - 1 && (
                    <button className="text-button" onClick={() => selectTest(selectedTestIndex + 1)} type="button">Următorul test <span aria-hidden="true">→</span></button>
                  )}
                </div>
                {incorrectQuestions.length + (isExam ? unansweredQuestions.length : 0) > 0 && (
                  <details className="review-list">
                    <summary>{isExam ? 'Revizuiește întrebările greșite sau fără răspuns' : 'Revizuiește răspunsurile greșite'} <span>{incorrectQuestions.length + (isExam ? unansweredQuestions.length : 0)}</span></summary>
                    <ol>
                      {activeTest.questions.filter((question) => testResults[question.number] === false || (isExam && testResults[question.number] === undefined)).map((question) => (
                        <li key={question.number}>
                          <p>{question.prompt}</p>
                          {isExam && testResults[question.number] === undefined && <em>Fără răspuns. </em>}
                          <span>{question.answers.find((answer) => answer.isCorrect)?.text}</span>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="page-footer">
        <span>ISF · BANCĂ DE ÎNTREBĂRI</span>
        <a href={referencePdf} download="Întrebări Conducător_16.01.2026.pdf">DOCUMENT DE REFERINȚĂ · 16.01.2026 <span aria-hidden="true">↓</span></a>
      </footer>
    </div>
  )
}

export default App
