import { cn } from "cn";

const MAX_WIDTH = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
} as const;

/**
 * The page shell every route wraps its content in. It owns the horizontal
 * padding, the content column width, and the vertical space left under the
 * sticky site header.
 *
 * `flex-1` (rather than `min-h-screen`) is what makes the shell fill the body's
 * flex column, so a page can never end up taller than one viewport.
 */
export function PageShell({
  children,
  maxWidth = "5xl",
  fill = false,
  className,
}: {
  children: React.ReactNode;
  maxWidth?: keyof typeof MAX_WIDTH;
  /** Let a child fill the remaining height, for viewports like the chat. */
  fill?: boolean;
  className?: string;
}) {
  return (
    <main
      // Marks a page whose child owns the scrolling — see the `body:has()` rule in
      // globals.css, which pins the body to the viewport so the child has a height
      // to fill. Rendered as an attribute rather than a class so the rule can match
      // it from the body, which a page cannot reach with its own class names.
      data-fill={fill ? "" : undefined}
      className={cn(
        "mx-auto flex w-full flex-1 flex-col gap-4 px-4 py-6 md:px-8",
        MAX_WIDTH[maxWidth],
        fill && "min-h-0",
        className,
      )}
    >
      {children}
    </main>
  );
}
