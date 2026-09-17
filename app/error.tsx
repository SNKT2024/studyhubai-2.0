"use client";

import { RouteError } from "@/components/route-error";

/** Catches a failure anywhere below the root layout. See components/route-error.tsx. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} />;
}
