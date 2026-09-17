"use client";

import { RouteError } from "@/components/route-error";

export default function QuestionGeneratorError({
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
      title="The question generator hit a problem"
      description="We couldn't load your previous question sets. Trying again often clears it."
    />
  );
}
