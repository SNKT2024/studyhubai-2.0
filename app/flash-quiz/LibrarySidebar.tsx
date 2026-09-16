"use client";

import { Spinner } from "@/components/ui/spinner";
import type { FlashcardDeck, Quiz } from "@/lib/types";

type LibrarySidebarProps = {
  decks: FlashcardDeck[];
  quizzes: Quiz[];
  isLoading: boolean;
  loadError: string | null;
  activeId: string | null;
  onSelectDeck: (id: string) => void;
  onSelectQuiz: (id: string) => void;
  onRetry: () => void;
};

type LibraryRow = {
  id: string;
  title: string;
  meta: string;
  isMasteredCount?: number;
  isFromPdf: boolean;
};

export function LibrarySidebar({
  decks,
  quizzes,
  isLoading,
  loadError,
  activeId,
  onSelectDeck,
  onSelectQuiz,
  onRetry,
}: LibrarySidebarProps) {
  const isEmpty = decks.length === 0 && quizzes.length === 0;

  return (
    <aside className="w-full max-w-md rounded-2xl border border-secondary bg-secondary p-4 lg:w-80 lg:shrink-0">
      <h2 className="mb-3 font-semibold">Your library</h2>

      <div className="scrollbar-none max-h-112 overflow-y-auto" aria-live="polite">
        {isLoading ? (
          <div
            className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-primary"
            role="status"
          >
            <Spinner className="size-5" />
            <span>Loading your library...</span>
          </div>
        ) : loadError ? (
          <div
            className="flex h-40 flex-col items-center justify-center gap-3 px-4 text-center text-sm text-primary"
            role="alert"
          >
            <p>{loadError}</p>
            <button
              type="button"
              onClick={onRetry}
              className="cursor-pointer rounded-lg border border-primary px-3 py-1.5 text-primary transition-colors hover:bg-primary hover:text-secondary"
            >
              Try again
            </button>
          </div>
        ) : isEmpty ? (
          <p className="flex h-40 items-center justify-center px-4 text-center text-sm text-primary">
            Nothing here yet. Generate a deck or a quiz to get started.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {decks.length > 0 && (
              <LibraryGroup
                heading="Flashcard decks"
                rows={decks.map((deck) => ({
                  id: deck.id,
                  title: deck.title,
                  meta: `${deck.cards.length} ${
                    deck.cards.length === 1 ? "card" : "cards"
                  }`,
                  isMasteredCount: deck.cards.filter((card) => card.isMastered)
                    .length,
                  isFromPdf: deck.sourceType === "PDF",
                }))}
                activeId={activeId}
                onSelect={onSelectDeck}
              />
            )}

            {quizzes.length > 0 && (
              <LibraryGroup
                heading="Quizzes"
                rows={quizzes.map((quiz) => ({
                  id: quiz.id,
                  title: quiz.title,
                  meta: `${quiz.questions.length} ${
                    quiz.questions.length === 1 ? "question" : "questions"
                  }`,
                  isFromPdf: quiz.sourceType === "PDF",
                }))}
                activeId={activeId}
                onSelect={onSelectQuiz}
              />
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function LibraryGroup({
  heading,
  rows,
  activeId,
  onSelect,
}: {
  heading: string;
  rows: LibraryRow[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section>
      <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-primary/70">
        {heading}
      </h3>

      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => {
          const isActive = row.id === activeId;
          const masteredSuffix =
            row.isMasteredCount !== undefined && row.isMasteredCount > 0
              ? ` • ${row.isMasteredCount} mastered`
              : "";

          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => onSelect(row.id)}
                aria-current={isActive ? "true" : undefined}
                className={`flex w-full cursor-pointer flex-col gap-1 rounded-2xl border px-4 py-2.5 text-left transition-all duration-100 ${
                  isActive
                    ? "border-secondary bg-primary text-secondary"
                    : "border-transparent bg-primary/90 text-secondary hover:border-primary hover:bg-secondary hover:text-primary"
                }`}
              >
                <span className="truncate text-sm font-medium">
                  {row.title}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-light opacity-80">
                  {row.isFromPdf && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        isActive
                          ? "bg-secondary text-primary"
                          : "bg-secondary/80 text-primary"
                      }`}
                    >
                      PDF
                    </span>
                  )}
                  <span className="truncate">
                    {row.meta}
                    {masteredSuffix}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
