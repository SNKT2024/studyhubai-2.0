"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { toast } from "@/components/ui/toast";
import type { FlashcardDeck } from "@/lib/types";

export function FlashcardRunner({
  deck,
  onCardMastered,
  onBackToLibrary,
}: {
  deck: FlashcardDeck;
  onCardMastered: (cardId: string, isMastered: boolean) => void;
  onBackToLibrary: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);

  const total = deck.cards.length;
  const card = deck.cards[index];

  useEffect(() => {
    if (total === 0) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        setIndex((current) => Math.min(current + 1, total - 1));
      }

      if (event.key === "ArrowLeft") {
        setIndex((current) => Math.max(current - 1, 0));
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [total]);

  if (total === 0) {
    return (
      <Panel className="shadow-none">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>This deck is empty</EmptyTitle>
            <EmptyDescription>
              The model didn&apos;t return any cards for &ldquo;{deck.topic}
              &rdquo;. Try a more specific topic.
            </EmptyDescription>
          </EmptyHeader>
          <Button
            type="button"
            onClick={onBackToLibrary}
            className="text-secondary"
          >
            Back to library
          </Button>
        </Empty>
      </Panel>
    );
  }

  const masteredCount = deck.cards.filter((entry) => entry.isMastered).length;
  const progress = Math.round((masteredCount / total) * 100);

  function goTo(nextIndex: number) {
    setIndex(nextIndex);
    setIsFlipped(false);
  }

  async function toggleMastered() {
    if (pendingCardId === card.id) return;

    const nextValue = !card.isMastered;
    setPendingCardId(card.id);
    onCardMastered(card.id, nextValue); // optimistic

    try {
      const response = await fetch(`/api/flash-quiz-mode/card/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isMastered: nextValue }),
      });

      if (!response.ok) {
        throw new Error("Failed to update the card");
      }
    } catch (error) {
      console.error("Failed to update flashcard:", error);
      onCardMastered(card.id, !nextValue); // revert
      toast.add({
        title: "Couldn't update that card",
        description: "Your change wasn't saved. Please try again.",
        type: "error",
      });
    } finally {
      setPendingCardId(null);
    }
  }

  return (
    <Panel>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold">{deck.topic}</h2>
          <p className="text-sm opacity-70">
            {total} {total === 1 ? "card" : "cards"} • {masteredCount} mastered
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

      <div
        className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-primary/20"
        role="progressbar"
        aria-valuenow={masteredCount}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Cards mastered"
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="[perspective:1200px]">
        <button
          type="button"
          onClick={() => setIsFlipped((current) => !current)}
          aria-pressed={isFlipped}
          aria-label={
            isFlipped
              ? "Showing the answer. Activate to show the question."
              : "Showing the question. Activate to reveal the answer."
          }
          className={`relative block h-64 w-full cursor-pointer rounded-2xl text-left transition-transform duration-500 [transform-style:preserve-3d] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${
            isFlipped ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-8 text-center text-secondary [backface-visibility:hidden]">
            <span className="text-xs uppercase tracking-widest opacity-60">
              Question
            </span>
            <p className="text-lg font-medium">{card.front}</p>
            {card.hint && (
              <p className="text-xs opacity-60">Hint: {card.hint}</p>
            )}
            <span className="mt-2 text-xs opacity-50">
              Click or press Space to flip
            </span>
          </div>

          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-background px-6 py-8 text-center text-foreground [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <span className="text-xs uppercase tracking-widest opacity-60 text-secondary">
              Answer
            </span>
            <p className="text-lg font-medium text-secondary">{card.back}</p>
            <span className="mt-2 text-xs opacity-50 text-secondary">
              Click or press Space to flip back
            </span>
          </div>
        </button>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => goTo(Math.max(index - 1, 0))}
          disabled={index === 0}
          aria-label="Previous card"
          className="border-primary text-secondary hover:bg-primary hover:text-secondary"
        >
          <ArrowLeft aria-hidden="true" />
          Prev
        </Button>

        <span className="text-sm font-medium tabular-nums opacity-80">
          {index + 1} / {total}
        </span>

        <Button
          type="button"
          variant="outline"
          onClick={() => goTo(Math.min(index + 1, total - 1))}
          disabled={index === total - 1}
          aria-label="Next card"
          className="border-primary text-secondary hover:bg-primary hover:text-secondary"
        >
          Next
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>

      <Button
        type="button"
        onClick={toggleMastered}
        disabled={pendingCardId === card.id}
        aria-pressed={card.isMastered}
        className={`mt-3 w-full ${
          card.isMastered
            ? "bg-primary text-secondary hover:bg-primary/80"
            : "text-secondary"
        }`}
      >
        {card.isMastered ? (
          <>
            <Check aria-hidden="true" />
            Mastered — click to unmark
          </>
        ) : (
          <>
            <RotateCcw aria-hidden="true" />
            Mark as mastered
          </>
        )}
      </Button>
    </Panel>
  );
}
