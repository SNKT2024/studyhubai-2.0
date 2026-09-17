"use client";

import { Spinner } from "@/components/ui/spinner";
import type { QuestionSet } from "@/lib/types";

type PreviousQuestionsProps = {
  previousQuestions: QuestionSet[];
  onSelectSet: (questionSet: QuestionSet) => void;
};

export function PreviousQuestions({
  previousQuestions,
  onSelectSet,
}: PreviousQuestionsProps) {
  return (
    <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-secondary bg-secondary p-4 lg:w-80 lg:shrink-0">
      <h5>Previous Question Sets</h5>

      {previousQuestions.length === 0 ? (
        <div className="flex w-full items-center justify-center py-8">
          <Spinner className="size-7 text-primary" />
        </div>
      ) : (
        <ul className="space-y-2">
          {previousQuestions.map((entry) => (
            <li
              key={entry.id}
              onClick={() => onSelectSet(entry)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  onSelectSet(entry);
                }
              }}
              role="button"
              tabIndex={0}
              className="flex min-w-0 flex-col border border-secondary rounded-3xl px-4 py-3 gap-2 justify-start bg-primary text-secondary cursor-pointer hover:bg-secondary hover:text-primary hover:border-primary transition-all duration-100"
            >
              <p className="wrap-break-word">{entry.topic}</p>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-sm font-light">
                <p className="whitespace-nowrap">{entry.format} |</p>
                <p className="whitespace-nowrap">{entry.experienceLevel} |</p>
                <p className="whitespace-nowrap">{entry.count} Qs</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
