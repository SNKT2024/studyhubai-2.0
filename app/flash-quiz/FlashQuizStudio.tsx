"use client";

import { useEffect, useState } from "react";

import type { FlashcardDeck, Quiz, QuizAttemptRecord } from "@/lib/types";

import { FlashcardRunner } from "./FlashcardRunner";
import { GenerationForm } from "./GenerationForm";
import { LibrarySidebar } from "./LibrarySidebar";
import { QuizResults } from "./QuizResults";
import { QuizRunner } from "./QuizRunner";

export type FlashQuizMode = "flashcards" | "quiz";

type Selection =
  | { kind: "deck"; id: string }
  | { kind: "quiz"; id: string }
  | null;

export function FlashQuizStudio() {
  const [mode, setMode] = useState<FlashQuizMode>("flashcards");
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [attempt, setAttempt] = useState<QuizAttemptRecord | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLibrary() {
      try {
        setIsLoading(true);
        setLoadError(null);

        const response = await fetch("/api/flash-quiz-mode", {
          signal: controller.signal,
        });
        const result = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(result?.message ?? "Failed to load your library");
        }

        if (!Array.isArray(result?.decks) || !Array.isArray(result?.quizzes)) {
          throw new Error("The library response was invalid");
        }

        setDecks(result.decks);
        setQuizzes(result.quizzes);
      } catch (error) {
        if (controller.signal.aborted) return;

        console.error("Failed to load flashcards and quizzes:", error);
        setLoadError("We couldn't load your flashcards and quizzes.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadLibrary();

    return () => controller.abort();
  }, [loadAttempt]);

  const selectedDeck =
    selection?.kind === "deck"
      ? (decks.find((deck) => deck.id === selection.id) ?? null)
      : null;
  const selectedQuiz =
    selection?.kind === "quiz"
      ? (quizzes.find((quiz) => quiz.id === selection.id) ?? null)
      : null;

  function handleDeckGenerated(deck: FlashcardDeck) {
    setDecks((current) => [deck, ...current]);
    setAttempt(null);
    setSelection({ kind: "deck", id: deck.id });
  }

  function handleQuizGenerated(quiz: Quiz) {
    setQuizzes((current) => [quiz, ...current]);
    setAttempt(null);
    setSelection({ kind: "quiz", id: quiz.id });
  }

  function handleCardMastered(cardId: string, isMastered: boolean) {
    setDecks((current) =>
      current.map((deck) => ({
        ...deck,
        cards: deck.cards.map((card) =>
          card.id === cardId ? { ...card, isMastered } : card,
        ),
      })),
    );
  }

  function showLibrary() {
    setAttempt(null);
    setSelection(null);
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
      <LibrarySidebar
        decks={decks}
        quizzes={quizzes}
        isLoading={isLoading}
        loadError={loadError}
        activeId={selection?.id ?? null}
        onSelectDeck={(id) => {
          setAttempt(null);
          setSelection({ kind: "deck", id });
        }}
        onSelectQuiz={(id) => {
          setAttempt(null);
          setSelection({ kind: "quiz", id });
        }}
        onRetry={() => setLoadAttempt((current) => current + 1)}
      />

      {attempt && selectedQuiz ? (
        <QuizResults
          attempt={attempt}
          quiz={selectedQuiz}
          onRetake={() => setAttempt(null)}
          onBackToLibrary={showLibrary}
        />
      ) : selectedDeck ? (
        <FlashcardRunner
          deck={selectedDeck}
          onCardMastered={handleCardMastered}
          onBackToLibrary={showLibrary}
        />
      ) : selectedQuiz ? (
        <QuizRunner
          quiz={selectedQuiz}
          onFinished={setAttempt}
          onBackToLibrary={showLibrary}
        />
      ) : (
        <GenerationForm
          mode={mode}
          onModeChange={setMode}
          onDeckGenerated={handleDeckGenerated}
          onQuizGenerated={handleQuizGenerated}
        />
      )}
    </div>
  );
}
