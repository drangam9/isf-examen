import test from 'node:test'
import assert from 'node:assert/strict'
import { createRandomExam, expireExam, remainingSeconds, restoreExam, submitExamAnswer } from './exam.js'

const bank = Array.from({ length: 506 }, (_, index) => ({
  number: index + 1,
  answers: [{ isCorrect: true }, { isCorrect: false }, { isCorrect: false }],
}))

test('an exam draws exactly 40 distinct questions without changing the bank', () => {
  const before = structuredClone(bank)
  const exam = createRandomExam(bank, false, 1000, () => 0.25)
  assert.equal(exam.questionNumbers.length, 40)
  assert.equal(new Set(exam.questionNumbers).size, 40)
  assert.ok(exam.questionNumbers.every((number) => bank.some((question) => question.number === number)))
  assert.notDeepEqual(exam.questionNumbers, bank.slice(0, 40).map((question) => question.number))
  assert.deepEqual(bank, before)
  assert.equal(exam.expiresAt, null)
})

test('timed exams have a fixed 40-minute deadline and expire even after time away', () => {
  const exam = createRandomExam(bank, true, 1000)
  assert.equal(exam.expiresAt, 2401000)
  assert.equal(remainingSeconds(exam, 1000), 2400)
  assert.equal(remainingSeconds(exam, 2001), 2399)
  assert.equal(expireExam(exam, 2400999), exam)
  const expired = expireExam(exam, 2401000)
  assert.equal(expired.completed, true)
  assert.equal(expired.timedOut, true)
  assert.equal(remainingSeconds(expired, 2500000), 0)
  assert.deepEqual(expired.results, {})
  assert.equal(expireExam(expired, 2500000), expired)
})

test('untimed exams remain open regardless of elapsed time', () => {
  const exam = createRandomExam(bank, false, 1000)
  assert.equal(expireExam(exam, Number.MAX_SAFE_INTEGER), exam)
  assert.equal(remainingSeconds(exam, 1000), null)
})

test('answers advance once, score correctly, and finish on question 40', () => {
  let exam = createRandomExam(bank, false, 1000)
  assert.equal(submitExamAnswer(exam, bank, null, 2000), exam)
  assert.equal(submitExamAnswer(exam, bank, -1, 2000), exam)
  assert.equal(submitExamAnswer(exam, bank, 3, 2000), exam)
  for (let index = 0; index < 40; index++) {
    exam = submitExamAnswer(exam, bank, index % 2, 2000)
  }
  assert.equal(exam.completed, true)
  assert.equal(exam.timedOut, false)
  assert.equal(Object.keys(exam.results).length, 40)
  assert.equal(Object.values(exam.results).filter(Boolean).length, 20)
  assert.equal(submitExamAnswer(exam, bank, 0, 3000), exam)
})

test('answers at or after the deadline are not scored', () => {
  const exam = createRandomExam(bank, true, 1000)
  const expired = submitExamAnswer(exam, bank, 0, exam.expiresAt)
  assert.equal(expired.timedOut, true)
  assert.deepEqual(expired.results, {})
})

test('reload preserves the draw, selection, score and original deadline', () => {
  let exam = createRandomExam(bank, true, 1000)
  exam = submitExamAnswer(exam, bank, 0, 2000)
  exam.selectedAnswer = 1
  const saved = JSON.parse(JSON.stringify(exam))
  assert.deepEqual(restoreExam(saved, bank, 3000), exam)
  const expired = restoreExam(saved, bank, exam.expiresAt + 1)
  assert.equal(expired.timedOut, true)
  assert.equal(expired.results[exam.questionNumbers[0]], true)
})

test('invalid saved exam data is discarded safely', () => {
  const exam = createRandomExam(bank, true, 1000)
  assert.equal(restoreExam(null, bank, 2000), null)
  assert.equal(restoreExam({ ...exam, questionNumbers: Array(40).fill(1) }, bank, 2000), null)
  assert.equal(restoreExam({ ...exam, questionIndex: 40 }, bank, 2000), null)
  assert.equal(restoreExam({ ...exam, expiresAt: 'invalid' }, bank, 2000), null)
  assert.equal(restoreExam({ ...exam, selectedAnswer: -1 }, bank, 2000), null)
})
