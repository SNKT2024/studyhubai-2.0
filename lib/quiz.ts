/**
 * Helpers for reading `QuizQuestion` rows.
 *
 * `prisma/schema.prisma` documents `correctAnswer` as "the exact string of the correct choice",
 * but rows written by the original generator store the option *letter* instead ("a".."d").
 * The cause is the write in app/api/flash-quiz-mode/route.ts, which persists
 * `Object.values(question.options)` — dropping the a/b/c/d keys — and then stores the raw
 * `answer` field from the model, which is that same letter.
 *
 * New rows now store the option text, but existing rows still hold letters, so every reader
 * has to accept both spellings. Scoring lives here rather than in the route so the UI and the
 * API can never disagree about what counts as correct.
 */

/** 0 -> "a", 1 -> "b", ... */
export function optionLetter(index: number): string {
  return String.fromCharCode(97 + index);
}

/**
 * The `QuizQuestion` columns a client may see before it submits an attempt.
 *
 * `correctAnswer` and `explanation` are absent on purpose: selecting them is what used to leak
 * the answers in the generation response and the library listing. Keeping the projection here
 * means every reader that is allowed to omit them has one place to import it from, and
 * `app/api/flash-quiz-mode/check/route.ts` is the only route that selects them.
 */
export const PUBLIC_QUESTION_SELECT = {
  id: true,
  quizId: true,
  order: true,
  question: true,
  options: true,
} as const;

/** True when `optionText` at `index` is the answer, whether it was stored as text or a letter. */
export function isCorrectOption(
  optionText: string,
  index: number,
  correctAnswer: string,
): boolean {
  return (
    optionText === correctAnswer ||
    optionLetter(index) === correctAnswer.trim().toLowerCase()
  );
}

/**
 * Index of the correct option, or -1 when `correctAnswer` matches nothing — which happens for
 * legacy rows whose letter no longer lines up with the options array.
 */
export function findCorrectOptionIndex(
  options: string[],
  correctAnswer: string,
): number {
  return options.findIndex((option, index) =>
    isCorrectOption(option, index, correctAnswer),
  );
}

/**
 * Normalises a model-produced answer into the option's text, so it can be stored in the shape
 * `schema.prisma` documents. Falls back to the raw answer when it is not a usable key.
 */
export function normalizeCorrectAnswer(
  options: Record<string, string>,
  answer: string,
): string {
  const values = Object.values(options);
  const byKey = options[answer.trim().toLowerCase()];

  if (byKey !== undefined) return byKey;

  // The model may have returned the option text rather than its key.
  const byText = values.find((value) => value === answer);
  return byText ?? answer;
}

export type GradedAnswer = {
  isCorrect: boolean;
  /** Index into `options`, or -1 when the stored answer matches no option. */
  correctOptionIndex: number;
};

/**
 * Grades one answer.
 *
 * Shared by `POST /api/flash-quiz-mode/check` (the answer a user checks mid-quiz) and
 * `POST /api/flash-quiz-mode/attempt` (the final score) so the two can never disagree about
 * what counts as correct — a user seeing "Correct" and then a lower score would be a bug with
 * no obvious cause.
 *
 * When `correctOptionIndex` is -1 the stored answer matches no option — legacy rows whose letter
 * no longer lines up with the options array — so nothing grades as correct rather than everyone
 * silently marking themselves right.
 */
export function gradeAnswer(
  options: string[],
  correctAnswer: string,
  chosen: string | null,
): GradedAnswer {
  const correctOptionIndex = findCorrectOptionIndex(options, correctAnswer);
  const chosenIndex = chosen === null ? -1 : options.indexOf(chosen);

  return {
    isCorrect: chosenIndex !== -1 && chosenIndex === correctOptionIndex,
    correctOptionIndex,
  };
}
