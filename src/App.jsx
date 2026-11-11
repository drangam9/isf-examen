import { useEffect, useState } from 'react'
import questions from './data/questions.json'
import './App.css'

const TEST_SIZE = 40
const STORAGE_KEY = 'asf-quiz-progress-v1'
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
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (!saved || saved.version !== 1) throw new Error('No saved quiz progress')

    const selectedTestIndex = Number.isInteger(saved.selectedTestIndex) && tests[saved.selectedTestIndex]
      ? saved.selectedTestIndex
      : 0
    const sessions = Object.fromEntries(tests.map((test, index) => {
      const savedSession = saved.sessions?.[index] ?? {}
      const questionIndex = Number.isInteger(savedSession.questionIndex) && test.questions[savedSession.questionIndex]
        ? savedSession.questionIndex
        : 0
      const answerCount = test.questions[questionIndex].answers.length
      const selectedAnswer = Number.isInteger(savedSession.selectedAnswer) && savedSession.selectedAnswer < answerCount
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

    return {
      version: 1,
      selectedTestIndex,
      sessions,
      results,
      completedTests,
      view: view === 'results' && !completedTests[selectedTestIndex] ? 'selection' : view,
    }
  } catch {
    return {
      version: 1,
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
  const { selectedTestIndex, sessions, results, completedTests, view } = progressState
  const activeSession = sessions[selectedTestIndex] ?? EMPTY_SESSION
  const { questionIndex, selectedAnswer, submitted } = activeSession

  const activeTest = tests[selectedTestIndex]
  const currentQuestion = activeTest.questions[questionIndex]
  const testResults = results[selectedTestIndex] ?? {}
  const score = Object.values(testResults).filter(Boolean).length
  const progress = ((questionIndex + 1) / activeTest.questions.length) * 100
  const answeredCount = Object.keys(testResults).length
  const canContinue = answeredCount > 0 || questionIndex > 0 || submitted
  const incorrectQuestions = activeTest.questions.filter((question) => testResults[question.number] === false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progressState))
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }, [progressState])

  function selectTest(index) {
    setProgressState((previous) => ({
      ...previous,
      selectedTestIndex: index,
      view: previous.completedTests[index] ? 'results' : 'selection',
    }))
  }

  function startTest() {
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
        <a className="brand" href="#top" aria-label="ASF, pagina principală">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span>ASF <i>·</i> EXAMEN</span>
        </a>
        <div className="topbar-note">
          <span className="status-dot" />
          Pregătire broker de asigurare
        </div>
      </header>

      <main id="top" className="workspace">
        <section className="intro-row" aria-label="Titlu">
          <div>
            <p className="eyebrow">SIMULATOR DE EXAMEN <span> / </span> 2026</p>
            <h1>Teste de pregătire</h1>
          </div>
          <div className="question-bank-count"><strong>{questions.length}</strong><span>întrebări<br />în bancă</span></div>
        </section>

        <div className="quiz-layout">
          <aside className="test-sidebar" aria-label="Selectare test">
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
          </aside>

          <section className="quiz-content" aria-live="polite">
            {view === 'selection' && (
              <div className="selection-view">
                <div className="section-kicker">TEST {activeTest.number.toString().padStart(2, '0')} <span>·</span> {tests.length.toString().padStart(2, '0')}</div>
                <div className="selection-copy">
                  <p className="range-label">ÎNTREBĂRILE {activeTest.start}–{activeTest.end}</p>
                  <h2>Un test. Un singur răspuns corect.</h2>
                  <p className="selection-summary">{activeTest.questions.length} întrebări din banca de examen, în ordinea documentului.</p>
                  {canContinue && <p className="saved-progress">Ai răspuns deja la {answeredCount} întrebări. Poți continua de unde ai rămas.</p>}
                </div>
                <button className="primary-button" onClick={canContinue ? continueTest : startTest} type="button">
                  {canContinue ? 'Continuă testul' : 'Începe testul'} <span aria-hidden="true">→</span>
                </button>
                <div className="selection-index"><span>01</span><span className="index-line" /><span>{tests.length.toString().padStart(2, '0')}</span></div>
              </div>
            )}

            {view === 'question' && (
              <div className="question-view" key={`${selectedTestIndex}-${questionIndex}`}>
                <div className="question-topline">
                  <span>TEST {activeTest.number.toString().padStart(2, '0')}</span>
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
                            sessions: {
                              ...previous.sessions,
                              [selectedTestIndex]: { ...activeSession, selectedAnswer: index },
                            },
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
                      Verifică răspunsul <span aria-hidden="true">→</span>
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
                <div className="section-kicker">TEST {activeTest.number.toString().padStart(2, '0')} <span>·</span> REZULTAT</div>
                <div className="result-score">
                  <strong>{score.toString().padStart(2, '0')}</strong>
                  <span> / {activeTest.questions.length}</span>
                </div>
                <h2>{score === activeTest.questions.length ? 'Excelent.' : 'Test încheiat.'}</h2>
                <p className="result-caption">Răspunsuri corecte</p>
                <div className="result-actions">
                  <button className="primary-button" onClick={startTest} type="button">Reia testul <span aria-hidden="true">↻</span></button>
                  {selectedTestIndex < tests.length - 1 && (
                    <button className="text-button" onClick={() => selectTest(selectedTestIndex + 1)} type="button">Următorul test <span aria-hidden="true">→</span></button>
                  )}
                </div>
                {incorrectQuestions.length > 0 && (
                  <details className="review-list">
                    <summary>Revizuiește răspunsurile greșite <span>{incorrectQuestions.length}</span></summary>
                    <ol>
                      {incorrectQuestions.map((question) => (
                        <li key={question.number}>
                          <p>{question.prompt}</p>
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

      <footer className="page-footer"><span>ASF · BANCĂ DE ÎNTREBĂRI</span><span>DOCUMENT DE REFERINȚĂ · 16.01.2026</span></footer>
    </div>
  )
}

export default App
