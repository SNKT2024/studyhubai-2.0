import { cn } from "cn";

/**
 * The content card shared by every mode. `Card` is not reused here because it
 * is white with a ring, while these panels are `secondary` with a border and a
 * shadow.
 *
 * Empty/loading states pass `className="shadow-none"` to sit flat.
 */
export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-2xl rounded-2xl border border-secondary/30 bg-secondary p-5 text-secondary-foreground shadow-xl shadow-black/10 sm:p-7",
        className,
      )}
    >
      {children}
    </div>
  );
}
