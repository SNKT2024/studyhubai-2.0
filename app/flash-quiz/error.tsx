"use client";

import { RouteError } from "@/components/route-error";

export default function FlashQuizError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="Flashcards & Quiz hit a problem"
      description="We couldn't load your library. Trying again often clears it — nothing you saved has been lost."
    />
  );
}
