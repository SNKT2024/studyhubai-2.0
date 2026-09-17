"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { PageShell } from "@/components/page-shell";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * The body of every route's `error.tsx`, so each of those files is a two-line wrapper.
 *
 * An error boundary has to be a client component, which is why this one carries the directive
 * even though everything it renders is presentational.
 */
export function RouteError({
  error,
  reset,
  title = "Something went wrong",
  description = "This page couldn't load. Trying again often clears it.",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}) {
  useEffect(() => {
    // Next already logs the error in development; this keeps it visible in production too,
    // where the boundary is the only thing that sees it.
    console.error("Route error boundary caught:", error);
  }, [error]);

  return (
    <PageShell maxWidth="4xl">
      <Panel className="shadow-none">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TriangleAlert aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{title}</EmptyTitle>
            <EmptyDescription>{description}</EmptyDescription>
          </EmptyHeader>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              onClick={reset}
              className="text-secondary"
            >
              Try again
            </Button>
            <Link
              href="/"
              className="text-sm underline underline-offset-4"
            >
              Back to home
            </Link>
          </div>

          {/* Server errors arrive with the real message stripped and a digest to trace instead. */}
          {error.digest && (
            <p className="text-xs opacity-60">Reference: {error.digest}</p>
          )}
        </Empty>
      </Panel>
    </PageShell>
  );
}
