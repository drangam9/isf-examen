export const EXAM_SIZE = 40
export const EXAM_DURATION_MS = 40 * 60 * 1000

export function createRandomExam(bank, timed, now = Date.now(), random = Math.random) {
  const numbers = bank.map((question) => question.number)
  // Fisher–Yates gives every question the same chance of being drawn.
  for (let index = numbers.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    ;[numbers[index], numbers[other]] = [numbers[other], numbers[index]]
  }
  return {
    questionNumbers: numbers.slice(0, EXAM_SIZE),
    questionIndex: 0,
    selectedAnswer: null,
    results: {},
    expiresAt: timed ? now + EXAM_DURATION_MS : null,
    completed: false,
    timedOut: false,
  }
}

export function remainingSeconds(exam, now = Date.now()) {
  return exam?.expiresAt == null ? null : Math.max(0, Math.ceil((exam.expiresAt - now) / 1000))
}

export function expireExam(exam, now = Date.now()) {
  if (!exam || exam.completed || exam.expiresAt === null || now < exam.expiresAt) return exam
  return { ...exam, completed: true, timedOut: true, selectedAnswer: null }
}

export function submitExamAnswer(exam, bank, answerIndex, now = Date.now()) {
  const checked = expireExam(exam, now)
  if (checked !== exam || exam.completed) return checked
  const question = bank.find((item) => item.number === exam.questionNumbers[exam.questionIndex])
  if (!Number.isInteger(answerIndex) || !question?.answers[answerIndex]) return exam
  const completed = exam.questionIndex === exam.questionNumbers.length - 1
  return {
    ...exam,
    results: { ...exam.results, [question.number]: question.answers[answerIndex].isCorrect },
    questionIndex: completed ? exam.questionIndex : exam.questionIndex + 1,
    selectedAnswer: null,
    completed,
  }
}

export function restoreExam(saved, bank, now = Date.now()) {
  if (!saved || !Array.isArray(saved.questionNumbers) || saved.questionNumbers.length !== EXAM_SIZE) return null
  const byNumber = new Map(bank.map((question) => [question.number, question]))
  if (new Set(saved.questionNumbers).size !== EXAM_SIZE || saved.questionNumbers.some((number) => !byNumber.has(number))) return null
  if (!Number.isInteger(saved.questionIndex) || saved.questionIndex < 0 || saved.questionIndex >= EXAM_SIZE) return null
  if (saved.expiresAt !== null && (typeof saved.expiresAt !== 'number' || !Number.isFinite(saved.expiresAt))) return null
  const current = byNumber.get(saved.questionNumbers[saved.questionIndex])
  if (saved.selectedAnswer !== null && (!Number.isInteger(saved.selectedAnswer) || !current.answers[saved.selectedAnswer])) return null
  const results = Object.fromEntries(Object.entries(saved.results ?? {}).filter(([number, value]) => (
    saved.questionNumbers.includes(Number(number)) && typeof value === 'boolean'
  )))
  return expireExam({
    questionNumbers: saved.questionNumbers,
    questionIndex: saved.questionIndex,
    selectedAnswer: saved.selectedAnswer,
    results,
    expiresAt: saved.expiresAt,
    completed: Boolean(saved.completed),
    timedOut: Boolean(saved.timedOut),
  }, now)
}
