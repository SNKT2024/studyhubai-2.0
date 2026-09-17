"use client";

import { RouteError } from "@/components/route-error";

export default function StudyModeError({
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
      title="Study Mode hit a problem"
      description="We couldn't open your study session. Trying again often clears it — your chats and credits are untouched."
    />
  );
}
