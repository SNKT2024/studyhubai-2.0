"use client";

import { useEffect, useState } from "react";

import type { QuestionSet } from "@/lib/types";

import { PreviousQuestions } from "./PreviousQuestions";
import { GeneratorQuestion } from "./GeneratorQuestion";
import { QuestionViewer } from "./QuestionViewer";

export function QuestionGenerator({
  initialHistory = [],
}: {
  initialHistory?: QuestionSet[];
}) {
  const [activeSet, setActiveSet] = useState<QuestionSet | null>(null);
  const [history, setHistory] = useState<QuestionSet[]>(initialHistory);

  useEffect(() => {
    if (initialHistory.length > 0) return;

    async function loadHistory() {
      const response = await fetch("/api/question-generator");
      if (!response.ok) return;

      const result: { questions: QuestionSet[] } = await response.json();
      setHistory((currentHistory) => {
        const currentIds = new Set(
          currentHistory.map((questionSet) => questionSet.id),
        );
        return [
          ...currentHistory,
          ...result.questions.filter(
            (questionSet) => !currentIds.has(questionSet.id),
          ),
        ];
      });
    }

    void loadHistory();
  }, [initialHistory.length]);

  function handleGeneratedSet(questionSet: Omit<QuestionSet, "id">) {
    const generatedSet = {
      ...questionSet,
      id: `generated-${Date.now()}`,
    };

    setHistory((currentHistory) => [generatedSet, ...currentHistory]);
    setActiveSet(generatedSet);
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
      <PreviousQuestions
        previousQuestions={history}
        onSelectSet={setActiveSet}
      />
      {activeSet ? (
        <QuestionViewer
          questionSet={activeSet}
          onReset={() => setActiveSet(null)}
        />
      ) : (
        <GeneratorQuestion onSuccess={handleGeneratedSet} />
      )}
    </div>
  );
}
