# ISF · Simulator de examen

React + Vite study app for the Conducător exam hosted by ISF, using the 506 questions extracted from the reference PDF dated 16.01.2026.

- **Examen aleatoriu** is the default section. Each exam draws 40 distinct questions from the full bank. Answers are scored and reviewed at the end.
- An optional **40-minute timer** ends the exam automatically. Its fixed deadline survives refreshes and keeps running when another section or browser tab is open. Unanswered questions appear in the final review.
- **Teste în ordinea PDF-ului** preserves the original 13 groups (40 questions each, with 26 in the final group) and immediate answer feedback.
- Both sections save progress in the browser. Existing PDF-order progress is migrated automatically from the previous storage key.
- The footer's **Document de referință** link downloads the original PDF, included automatically in production builds.

## Development

```sh
npm install
npm run dev
npm test
npm run build
```

Exam selection, timing, answer submission, and saved-session validation are covered by the dependency-free Node test suite in `src/exam.test.js`.

`npm run extract-questions` rebuilds the question bank from the reference PDF. GitHub Pages builds the site on pushes to `main`; Vite is configured for `/isf-examen/`.
