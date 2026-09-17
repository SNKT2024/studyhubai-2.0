"use client";

import { Check, ChevronRight, LoaderCircle, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { toast } from "@/components/ui/toast";
import { optionLetter } from "@/lib/quiz";
import type { Quiz, QuizAttemptRecord, QuizQuestionCheck } from "@/lib/types";

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** A graded answer, tagged with the question it belongs to. */
type Reveal = QuizQuestionCheck & { questionId: string };

export function QuizRunner({
  quiz,
  onFinished,
  onBackToLibrary,
}: {
  quiz: Quiz;
  onFinished: (attempt: QuizAttemptRecord) => void;
  onBackToLibrary: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const startedAtRef = useRef(0);
  const total = quiz.questions.length;
  const question = quiz.questions[index];

  useEffect(() => {
    // Set on mount rather than during render — Date.now() is impure and React forbids it there.
    startedAtRef.current = Date.now();

    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (total === 0) {
    return (
      <Panel className="shadow-none">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>This quiz has no questions</EmptyTitle>
            <EmptyDescription>
              The model didn&apos;t return any questions for &ldquo;{quiz.topic}
              &rdquo;. Try a more specific topic.
            </EmptyDescription>
          </EmptyHeader>
          <Button type="button" onClick={onBackToLibrary} className="text-secondary">
            Back to library
          </Button>
        </Empty>
      </Panel>
    );
  }

  const selected = answers[question.id] ?? null;
  // Tagged by question id, so a result from the previous question can never colour this one.
  const currentReveal = reveal?.questionId === question.id ? reveal : null;
  const isRevealed = currentReveal !== null;
  const correctIndex = currentReveal?.correctOptionIndex ?? -1;
  const isLastQuestion = index === total - 1;
  const answeredCount = Object.keys(answers).length;

  function choose(optionText: string) {
    if (isRevealed) return;
    setAnswers((current) => ({ ...current, [question.id]: optionText }));
  }

  /**
   * Asks the server whether `selected` was right.
   *
   * The answers are not in the payload we were given — see `PUBLIC_QUESTION_SELECT` in
   * lib/quiz.ts — so this round trip is what replaces reading `question.correctAnswer` locally.
   */
  async function revealAnswer() {
    if (selected === null || isChecking) return;

    setIsChecking(true);

    try {
      const response = await fetch("/api/flash-quiz-mode/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: quiz.id,
          questionId: question.id,
          chosen: selected,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || typeof result?.isCorrect !== "boolean") {
        throw new Error(result?.message ?? "Couldn't check that answer.");
      }

      setReveal({ ...(result as QuizQuestionCheck), questionId: question.id });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Couldn't check that answer.";

      toast.add({
        title: "Couldn't check that answer",
        description: message,
        type: "error",
      });
    } finally {
      setIsChecking(false);
    }
  }

  async function finish() {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/flash-quiz-mode/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: quiz.id,
          answers,
          timeSpent: Math.floor((Date.now() - startedAtRef.current) / 1000),
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.attempt) {
        throw new Error(result?.message ?? "Couldn't save your attempt.");
      }

      onFinished(result.attempt as QuizAttemptRecord);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Couldn't save your attempt.";

      toast.add({ title: "Couldn't save your score", description: message, type: "error" });
      setIsSubmitting(false);
    }
  }

  function next() {
    if (isLastQuestion) {
      void finish();
      return;
    }

    setIndex((current) => current + 1);
    setReveal(null);
  }

  return (
    <Panel>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold">{quiz.topic}</h2>
          <p className="text-sm opacity-70">
            {answeredCount} of {total} answered • {formatDuration(elapsed)}
          </p>
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

      <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${((index + (isRevealed ? 1 : 0)) / total) * 100}%` }}
        />
      </div>

      <p className="mb-3 text-sm font-medium opacity-70">
        Question {index + 1} of {total}
      </p>
      <p className="mb-5 text-lg font-medium">{question.question}</p>

      {/*
        A hand-rolled radiogroup rather than components/ui/radio-group: each option needs its own
        correct / chosen-wrong treatment once the answer is revealed, which the primitive's
        internals don't expose. The ARIA wiring below is what that component provides anyway.
      */}
      <div
        role="radiogroup"
        aria-label={`Options for question ${index + 1}`}
        className="flex flex-col gap-2"
      >
        {question.options.map((option, optionIndex) => {
          const isChosen = selected === option;
          const isCorrect = optionIndex === correctIndex;

          let stateClasses =
            "border-primary/40 bg-background text-foreground hover:border-primary hover:bg-primary hover:text-secondary";

          if (isRevealed) {
            if (isCorrect) {
              stateClasses = "border-emerald-700 bg-emerald-700/15 text-emerald-950";
            } else if (isChosen) {
              stateClasses =
                "border-destructive bg-destructive/15 text-destructive";
            } else {
              stateClasses = "border-primary/20 bg-background/60 text-foreground/60";
            }
          } else if (isChosen) {
            stateClasses = "border-primary bg-primary text-secondary";
          }

          return (
            <button
              key={`${question.id}-${optionIndex}`}
              type="button"
              role="radio"
              aria-checked={isChosen}
              disabled={isRevealed}
              onClick={() => choose(option)}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors disabled:cursor-default ${stateClasses}`}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold uppercase">
                {optionLetter(optionIndex)}
              </span>
              <span className="flex-1">{option}</span>
              {isRevealed && isCorrect && (
                <Check className="size-4 shrink-0" aria-hidden="true" />
              )}
              {isRevealed && isChosen && !isCorrect && (
                <X className="size-4 shrink-0" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {currentReveal && (
        <div
          className="mt-4 rounded-xl bg-background/70 p-4 text-sm"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold">
            {currentReveal.isCorrect ? "Correct" : "Not quite"}
          </p>
          {/* -1 means the stored answer matched no option, so there is nothing to show. */}
          {correctIndex !== -1 && (
            <p className="mt-1 opacity-80">
              Answer: {question.options[correctIndex]}
            </p>
          )}
          {/* explanation is null for every row the current generator writes; render if present. */}
          {currentReveal.explanation && (
            <p className="mt-1 opacity-80">{currentReveal.explanation}</p>
          )}
        </div>
      )}

      <div className="mt-5">
        {isRevealed ? (
          <Button
            type="button"
            size="lg"
            onClick={next}
            disabled={isSubmitting}
            className="w-full text-secondary"
          >
            {isSubmitting ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <ChevronRight aria-hidden="true" />
            )}
            {isSubmitting
              ? "Saving..."
              : isLastQuestion
                ? "See results"
                : "Next question"}
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={() => void revealAnswer()}
            disabled={selected === null || isChecking}
            className="w-full text-secondary"
          >
            {isChecking ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Check aria-hidden="true" />
            )}
            {isChecking ? "Checking..." : "Check answer"}
          </Button>
        )}
      </div>
    </Panel>
  );
}
