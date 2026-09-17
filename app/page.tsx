import { ArrowRight, GraduationCap, Layers, Sparkles } from "lucide-react";
import Link from "next/link";

import { PageShell } from "@/components/page-shell";
import { buttonVariants } from "@/components/ui/button";

/**
 * The product entry point. `/` used to render the Study Mode form directly, which
 * meant the app had no front door and the nav had no Home entry. The modes keep
 * their own routes; this page only introduces them.
 */
const MODES = [
  {
    href: "/study-mode",
    label: "Study Mode",
    icon: GraduationCap,
    description:
      "Start a chat about any topic. Pick the context the answers should come from — exam prep, coursework, or open exploration — and work through it turn by turn.",
    action: "Start a session",
  },
  {
    href: "/flash-quiz",
    label: "Flashcards & Quiz",
    icon: Layers,
    description:
      "Generate a deck from a topic or your own notes, then flip through the cards or take a graded quiz. Progress is saved so you can pick up where you left off.",
    action: "Generate a deck",
  },
  {
    href: "/question-generator",
    label: "Question Generator",
    icon: Sparkles,
    description:
      "Build a practice set at the format, difficulty and length you choose, and revisit every set you have generated before.",
    action: "Build a set",
  },
] as const;

export default function Home() {
  return (
    <PageShell maxWidth="5xl" className="gap-8">
      <section className="pt-6 text-secondary sm:pt-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-secondary/30 px-3 py-1 text-xs uppercase tracking-widest">
          <Sparkles className="size-3.5" aria-hidden="true" />
          Powered by AI
        </span>

        <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-wide text-balance sm:text-4xl">
          Turn any topic into a study session
        </h1>

        <p className="mt-4 max-w-2xl text-base text-pretty text-secondary/80">
          StudyHub AI writes the material so you can spend your time on the part
          that actually matters — working through it. Ask questions in a guided
          chat, drill flashcards, take a quiz, or build a practice question set.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            href="/study-mode"
            className={buttonVariants({
              className: "text-secondary",
            })}
          >
            Start studying
            <ArrowRight aria-hidden="true" />
          </Link>
          <Link
            href="/flash-quiz"
            className="text-sm underline underline-offset-4"
          >
            Or generate a flashcard deck
          </Link>
        </div>
      </section>

      <section aria-labelledby="modes-heading">
        <h2 id="modes-heading" className="sr-only">
          Study modes
        </h2>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((mode) => (
            <li key={mode.href} className="flex">
              {/*
                The whole card is the link, so a click anywhere is one target and
                there is no nested-anchor problem: the visual "action" below is a
                span, not a second link.
              */}
              <Link
                href={mode.href}
                className="group flex w-full flex-col gap-3 rounded-2xl border border-secondary/30 bg-secondary/5 p-5 text-secondary transition-colors hover:border-secondary hover:bg-secondary/10 focus-visible:ring-3 focus-visible:ring-secondary/50 focus-visible:outline-none"
              >
                <span className="w-fit rounded-xl bg-secondary p-2.5 text-primary">
                  <mode.icon className="size-5" aria-hidden="true" />
                </span>

                <span className="text-lg font-medium">{mode.label}</span>

                <span className="text-sm text-pretty text-secondary/80">
                  {mode.description}
                </span>

                <span className="mt-auto flex items-center gap-1.5 pt-2 text-sm font-medium opacity-80 group-hover:opacity-100">
                  {mode.action}
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="pb-6 text-sm text-secondary/70">
        <p>
          Every account starts with a handful of free AI credits — enough to try
          each mode — and no card is required.
        </p>
      </section>
    </PageShell>
  );
}
