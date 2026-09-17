import { Compass } from "lucide-react";
import Link from "next/link";

import { PageShell } from "@/components/page-shell";
import { Panel } from "@/components/panel";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/** Rendered for any unmatched route, and by `notFound()` in a page. */
export default function NotFound() {
  return (
    <PageShell maxWidth="4xl">
      <Panel className="shadow-none">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Compass aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>We couldn&apos;t find that page</EmptyTitle>
            <EmptyDescription>
              The link may be out of date, or the page may have been moved.
            </EmptyDescription>
          </EmptyHeader>

          {/*
            `buttonVariants` on a Link rather than a Button wrapping one: the button primitive
            renders a real <button>, and nesting an anchor inside it is invalid HTML.
          */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/" className={buttonVariants({ className: "text-secondary" })}>
              Back to home
            </Link>
            <Link
              href="/flash-quiz"
              className="text-sm underline underline-offset-4"
            >
              Go to Flashcards &amp; Quiz
            </Link>
          </div>
        </Empty>
      </Panel>
    </PageShell>
  );
}
