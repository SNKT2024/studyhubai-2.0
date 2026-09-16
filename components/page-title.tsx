import { cn } from "cn";
import type { LucideIcon } from "lucide-react";

/**
 * The heading block every mode opens with. Rendering the icon here (at a fixed
 * size) is what keeps the four modes looking like one app.
 */
export function PageTitle({
  icon: Icon,
  title,
  subtitle,
  className,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <header className={cn("flex items-start gap-3", className)}>
      <div className="shrink-0 rounded-xl bg-primary p-2.5 text-secondary">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-wide text-secondary">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-secondary/80">{subtitle}</p>
        ) : null}
      </div>
    </header>
  );
}
