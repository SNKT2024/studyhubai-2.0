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
