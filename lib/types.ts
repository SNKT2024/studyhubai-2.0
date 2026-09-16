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
  deckId: string;
  order: number;
  front: string;
  back: string;
  hint: string | null;
  isMastered: boolean;
};

export type FlashcardDeck = {
  id: string;
  userId: string;
  title: string;
  topic: string;
  sourceType: string;
  sourceName: string | null;
  createdAt?: string;
  updatedAt?: string;
  cards: Flashcard[];
};

export type QuizQuestion = {
  id: string;
  quizId: string;
  order: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string | null;
};

export type Quiz = {
  id: string;
  userId: string;
  deckId: string | null;
  title: string;
  topic: string;
  sourceType: string;
  sourceName: string | null;
  createdAt?: string;
  updatedAt?: string;
  questions: QuizQuestion[];
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
