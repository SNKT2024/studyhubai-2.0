"use client";

import { Spinner } from "@/components/ui/spinner";
import type { QuestionSet } from "@/lib/types";
import { useState } from "react";

type PreviousQuestionsProps = {
  previousQuestions: QuestionSet[];
  onSelectSet: (questionSet: QuestionSet) => void;
};

export function PreviousQuestions({
  previousQuestions,
  onSelectSet,
}: PreviousQuestionsProps) {
  return (
    <div className="p-4 flex flex-col gap-3 border-secondary border bg-secondary rounded-2xl">
      <h5>Previous Question Sets</h5>

      {previousQuestions.length === 0 ? (
        <div className="flex w-full items-center justify-center py-8">
          <Spinner className="size-7 text-primary" />
        </div>
      ) : (
        <ul>
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
      )}
    </div>
  );
}
