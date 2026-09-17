"use client";

import "./globals.css";

/**
 * The last-resort boundary: this renders *instead of* the root layout, so it has to provide its
 * own `<html>` and `<body>` — and import the stylesheet itself, since the one in layout.tsx is
 * not part of this render.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
        <h1 className="text-2xl font-semibold">StudyHub AI couldn&apos;t load</h1>
        <p className="max-w-md text-sm opacity-80">
          Something failed before the page could render. Trying again often clears it.
        </p>

        <button
          type="button"
          onClick={reset}
          className="cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>

        {error.digest && (
          <p className="text-xs opacity-60">Reference: {error.digest}</p>
        )}
      </body>
    </html>
  );
}
