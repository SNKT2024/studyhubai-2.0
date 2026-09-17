export type Question = {
  question_id: number;
  question: string;
  options?: Record<string, string>;
  answer: string | null;
};

export type QuestionSet = {
  id: string;
  topic: string;
  format: string;
  experienceLevel: string;
  count: number;
  questions: Question[];
  createdAt?: string;
  updatedAt?: string;
};

// Flashcards and Quiz

export type Flashcard = {
  id: string;
  order: number;
  front: string;
  back: string;
  hint: string | null;
  isMastered: boolean;
};

export type FlashcardDeck = {
  id: string;
  title: string;
  topic: string;
  sourceType: string;
  sourceName: string | null;
  createdAt?: string;
  updatedAt?: string;
  cards: Flashcard[];
};

/**
 * A quiz question as the client sees it *before* an attempt is submitted. `correctAnswer` and
 * `explanation` are absent by construction — the API never sends them — so a caller cannot read
 * the answers out of the network response. Grading before submission goes through
 * `POST /api/flash-quiz-mode/check`, which returns just the one answer being asked about.
 */
export type QuizQuestion = {
  id: string;
  quizId: string;
  order: number;
  question: string;
  options: string[];
};

export type Quiz = {
  id: string;
  deckId: string | null;
  title: string;
  topic: string;
  sourceType: string;
  sourceName: string | null;
  createdAt?: string;
  updatedAt?: string;
  questions: QuizQuestion[];
};

/** What `POST /api/flash-quiz-mode/check` returns for a single answered question. */
export type QuizQuestionCheck = {
  isCorrect: boolean;
  /** Index into the question's `options`, or -1 when the stored answer matches none. */
  correctOptionIndex: number;
  correctAnswer: string;
  explanation: string | null;
};

/** One graded question, as returned by the attempt endpoint for the results screen. */
export type QuizReviewItem = {
  questionId: string;
  question: string;
  options: string[];
  chosen: string | null;
  correctAnswer: string;
  /** Index into `options`, or -1 when the stored answer matches no option. */
  correctOptionIndex: number;
  isCorrect: boolean;
  explanation: string | null;
};

export type QuizAttemptRecord = {
  id: string;
  quizId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeSpent: number | null;
  createdAt?: string;
  review: QuizReviewItem[];
};
