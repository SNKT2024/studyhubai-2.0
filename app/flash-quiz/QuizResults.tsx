"use client";

import { Check, RotateCcw, Sparkles, X } from "lucide-react";

import { Panel } from "@/components/panel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { optionLetter } from "@/lib/quiz";
import type { Quiz, QuizAttemptRecord } from "@/lib/types";

function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds === null) return "—";

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function scoreHeadline(percentage: number): string {
  if (percentage === 100) return "Perfect score.";
  if (percentage >= 80) return "Strong pass.";
  if (percentage >= 50) return "Getting there.";
  return "Worth another pass.";
}

export function QuizResults({
  attempt,
  quiz,
  onRetake,
  onBackToLibrary,
}: {
  attempt: QuizAttemptRecord;
  quiz: Quiz;
  onRetake: () => void;
  onBackToLibrary: () => void;
}) {
  const { review } = attempt;

  return (
    <Panel>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold">{quiz.topic}</h2>
          <p className="text-sm opacity-70">{scoreHeadline(attempt.percentage)}</p>
        </div>
        <Button
          type="button"
          onClick={onBackToLibrary}
          className="shrink-0 text-secondary"
        >
          <Sparkles aria-hidden="true" />
          Create another
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Score" value={`${attempt.score} / ${attempt.totalQuestions}`} />
        <Stat label="Percentage" value={`${attempt.percentage}%`} />
        <Stat label="Time" value={formatDuration(attempt.timeSpent)} />
      </div>

      <h3 className="mb-3 font-semibold">Review</h3>

      <Accordion className="w-full space-y-3">
        {review.map((item, index) => (
          <AccordionItem
            key={item.questionId}
            value={`review-${index}`}
            className="rounded-xl border-secondary bg-background px-4 text-secondary data-[state=open]:bg-muted/50"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex flex-col gap-2 text-left">
                <span className="text-sm font-medium">
                  {index + 1}. {item.question}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                    item.isCorrect ? "text-emerald-700" : "text-destructive"
                  }`}
                >
                  {item.isCorrect ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    <X className="size-3.5" aria-hidden="true" />
                  )}
                  {item.isCorrect ? "Correct" : "Incorrect"}
                  <span className="sr-only">
                    {item.isCorrect
                      ? "You answered this correctly."
                      : "You answered this incorrectly."}
                  </span>
                </span>
              </div>
            </AccordionTrigger>

            <AccordionContent className="pb-4 text-sm text-secondary">
              <ul className="mb-3 space-y-1">
                {item.options.map((option, optionIndex) => {
                  const isCorrect = optionIndex === item.correctOptionIndex;
                  const isChosen = option === item.chosen;

                  return (
                    <li
                      key={`${item.questionId}-${optionIndex}`}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1 ${
                        isCorrect
                          ? "bg-emerald-700/15 font-medium"
                          : isChosen
                            ? "bg-destructive/15"
                            : ""
                      }`}
                    >
                      <span className="text-xs font-semibold uppercase opacity-60">
                        {optionLetter(optionIndex)}
                      </span>
                      <span className="flex-1">{option}</span>
                      {isChosen && (
                        <span className="text-xs opacity-70">your answer</span>
                      )}
                      {isCorrect && (
                        <Check className="size-3.5 shrink-0" aria-hidden="true" />
                      )}
                    </li>
                  );
                })}
              </ul>

              {item.chosen === null && (
                <p className="mb-2 text-xs opacity-70">You skipped this one.</p>
              )}

              {item.correctOptionIndex === -1 && (
                <p className="mb-2 text-xs text-destructive">
                  This question&apos;s stored answer doesn&apos;t match any
                  option, so it couldn&apos;t be graded.
                </p>
              )}

              {item.explanation && <p className="text-xs">{item.explanation}</p>}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button type="button" size="lg" onClick={onRetake} className="flex-1 text-secondary">
          <RotateCcw aria-hidden="true" />
          Retake quiz
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={onBackToLibrary}
          className="flex-1 border-primary text-primary hover:bg-primary hover:text-secondary"
        >
          Back to library
        </Button>
      </div>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-primary px-3 py-3 text-center text-secondary">
      <p className="text-xs uppercase tracking-wide opacity-60">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
