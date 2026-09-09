"use client";

type Question = {
  question_id: number;
  question: string;
  answer?: string;
};

type PreviousQuestionsProps = {
  previousQuestions: {
    id: string;
    userId?: string;
    topic: string;
    format: string;
    experienceLevel: string;
    count: number;
    questions: Question[];
    createdAt?: string;
    updatedAt?: string;
  }[];
};

export function PreviousQuestions({
  previousQuestions,
}: PreviousQuestionsProps) {
  return (
    <div className="p-4 flex flex-col gap-3 border-secondary border bg-secondary rounded-2xl">
      <h5>Previous Question Sets</h5>
      <ul>
        {previousQuestions.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-col border border-secondary rounded-3xl px-5 py-3 gap-2 justify-start text-md bg-primary text-secondary cursor-pointer hover:bg-secondary hover:text-primary hover:border-primary transition-all duration-100"
          >
            <p>{entry.topic}</p>
            <div className="font-light flex flex-row gap-2 text-sm">
              <p>{entry.format} |</p>
              <p>{entry.experienceLevel} |</p>
              <p>{entry.count} Qs</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
