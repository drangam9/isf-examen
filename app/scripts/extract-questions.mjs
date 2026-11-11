import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const appDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceDirectory = path.resolve(appDirectory, "../..");
const outputDirectory = path.resolve(appDirectory, "../src/data");
const pdfFile = fs.readdirSync(workspaceDirectory).find((file) => file.toLowerCase().endsWith(".pdf"));

if (!pdfFile) {
  throw new Error("Could not find the source PDF in the workspace root.");
}

const document = await getDocument({
  data: new Uint8Array(fs.readFileSync(path.join(workspaceDirectory, pdfFile))),
}).promise;
const questionMarkers = [];
const answerGroups = [];
let currentGroup;
let currentAnswer;
let lastAnswerA;

function answerLabel(text) {
  const afterParen = text.match(/^([abc])\)\s*(\*)?\s*(.*)$/i);
  const beforeParen = text.match(/^([abc])\s*(\*)\)\s*(.*)$/i);
  const match = afterParen ?? beforeParen;

  return match
    ? { label: match[1].toLowerCase(), isCorrect: Boolean(match[2]), text: match[3].trim() }
    : undefined;
}

for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
  const page = await document.getPage(pageNumber);
  const content = await page.getTextContent();
  const items = content.items
    .filter((item) => item.str.trim())
    .map((item) => ({
      x: item.transform[4],
      y: item.transform[5],
      text: item.str.trim(),
      pageNumber,
    }))
    .sort((left, right) => right.y - left.y || left.x - right.x);
  const pageMarkers = [];
  const promptItems = [];

  for (const item of items) {
    if (item.x < 40 && /^\d+$/.test(item.text)) {
      pageMarkers.push({ ...item, sourceNumber: Number(item.text), promptItems: [] });
      continue;
    }

    if (item.x >= 40 && item.x < 400) {
      const normalizedText = item.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (normalizedText !== "intrebare") {
        promptItems.push(item);
      }
      continue;
    }

    if (item.x < 400) {
      continue;
    }

    const normalizedText = item.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (normalizedText.startsWith("variante de raspuns")) {
      continue;
    }

    const parsedAnswer = answerLabel(item.text);
    const startsNewGroup = parsedAnswer?.label === "a" &&
      (!lastAnswerA || lastAnswerA.pageNumber !== pageNumber || lastAnswerA.y - item.y > 30);

    if (startsNewGroup) {
      currentGroup = { pageNumber, answers: [] };
      answerGroups.push(currentGroup);
    }

    if (parsedAnswer) {
      if (currentGroup) {
        currentAnswer = parsedAnswer;
        currentGroup.answers.push(currentAnswer);
      }
      if (parsedAnswer.label === "a") {
        lastAnswerA = item;
      }
      continue;
    }

    if (currentAnswer) {
      currentAnswer.text = `${currentAnswer.text} ${item.text}`.trim();
      if (currentAnswer.text.startsWith("*")) {
        currentAnswer.isCorrect = true;
        currentAnswer.text = currentAnswer.text.slice(1).trim();
      }
    }
  }

  for (const item of promptItems) {
    const nearestMarker = pageMarkers
      .slice()
      .sort((left, right) => Math.abs(left.y - item.y) - Math.abs(right.y - item.y))[0];

    if (nearestMarker && Math.abs(nearestMarker.y - item.y) <= 28) {
      nearestMarker.promptItems.push(item);
    }
  }
  questionMarkers.push(...pageMarkers);
}

const uniqueQuestionMarkers = questionMarkers.filter((marker, index, markers) => {
  const prompt = marker.promptItems
    .sort((left, right) => right.y - left.y || left.x - right.x)
    .map((item) => item.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  marker.prompt = prompt;

  return !markers.slice(0, index).some((previous) =>
    previous.sourceNumber === marker.sourceNumber && previous.prompt === prompt,
  );
});

if (questionMarkers.length !== 507 || uniqueQuestionMarkers.length !== 506 || answerGroups.length !== 506) {
  throw new Error(`Expected 506 distinct questions; found ${questionMarkers.length} markers, ${uniqueQuestionMarkers.length} unique prompts and ${answerGroups.length} answer groups.`);
}

const questions = uniqueQuestionMarkers.map((marker, index) => {
  const answers = answerGroups[index].answers.map((answer) => ({
    text: answer.text.replace(/^\*\s*/, "").replace(/\s+/g, " ").trim(),
    isCorrect: answer.isCorrect,
  }));

  return {
    number: index + 1,
    sourceNumber: marker.sourceNumber,
    prompt: marker.prompt,
    answers,
  };
});

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, "questions.json"), `${JSON.stringify(questions, null, 2)}\n`);

const invalidQuestions = questions.filter((question) =>
  question.answers.length !== 3 || question.answers.filter((answer) => answer.isCorrect).length !== 1 || !question.prompt,
);
console.log(`Extracted ${questions.length} distinct questions from ${document.numPages} pages (${questionMarkers.length} printed markers).`);
console.log(`Questions differing from the usual 3 choices and 1 correct answer: ${invalidQuestions.length}${invalidQuestions.length ? ` (${invalidQuestions.map((question) => question.number).join(", ")})` : ""}.`);