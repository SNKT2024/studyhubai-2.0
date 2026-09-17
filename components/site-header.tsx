"use client";

import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { GraduationCap, House, Layers, Menu, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CreditsBadge } from "./credits-badge";

const navLinks = [
  { href: "/", label: "Home", icon: House },
  { href: "/study-mode", label: "Study Mode", icon: GraduationCap },
  { href: "/flash-quiz", label: "Flashcards & Quiz", icon: Layers },
  { href: "/question-generator", label: "Question Generator", icon: Sparkles },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  // `useAuth` rather than Clerk's `<Show>`: in the App Router `<Show>` is an async Server
  // Component, and this header is a client component.
  const { isLoaded, isSignedIn } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  const headerRef = useRef<HTMLElement>(null);

  // "/" would match every route under a prefix test, so it is compared exactly.
  function isCurrent(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  // Navigating away — including via back/forward — should never leave the panel
  // hanging open. Adjusted during render rather than in an effect, so the closed
  // state is committed in the same pass as the new route.
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setIsMenuOpen(false);
  }

  useEffect(() => {
    if (!isMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  const linkClass = (active: boolean) =>
    `flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
      active
        ? "border-secondary bg-secondary font-medium text-primary"
        : "border-transparent hover:border-secondary/40 hover:bg-secondary/10"
    }`;

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b border-secondary/20 bg-primary text-secondary"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold tracking-wide"
        >
          <GraduationCap className="size-6" aria-hidden="true" />
          StudyHub AI
        </Link>

        <div className="flex items-center gap-2">
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-1.5">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={isCurrent(link.href) ? "page" : undefined}
                    className={linkClass(isCurrent(link.href))}
                  >
                    <link.icon className="size-4" aria-hidden="true" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Shown to everyone, guests included — the remaining balance is the whole point of
              the guest tier, and Clerk counts a guest as signed out. */}
          <CreditsBadge />

          {isLoaded ? (
            isSignedIn ? (
              <UserButton />
            ) : (
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="cursor-pointer rounded-lg border border-secondary/40 px-3 py-1.5 text-sm transition-colors hover:bg-secondary/10 focus-visible:ring-3 focus-visible:ring-secondary/50 focus-visible:outline-none"
                >
                  Sign in
                </button>
              </SignInButton>
            )
          ) : null}

          <button
            type="button"
            aria-expanded={isMenuOpen}
            aria-controls="site-nav-mobile"
            aria-label={isMenuOpen ? "Close main menu" : "Open main menu"}
            onClick={() => setIsMenuOpen((open) => !open)}
            className="-mr-1 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent transition-colors hover:border-secondary/40 hover:bg-secondary/10 focus-visible:ring-3 focus-visible:ring-secondary/50 focus-visible:outline-none md:hidden"
          >
            {isMenuOpen ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <nav
          id="site-nav-mobile"
          aria-label="Main"
          className="border-t border-secondary/20 md:hidden"
        >
          <ul className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-3">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isCurrent(link.href) ? "page" : undefined}
                  onClick={() => setIsMenuOpen(false)}
                  className={`${linkClass(isCurrent(link.href))} min-h-11 px-3`}
                >
                  <link.icon className="size-5" aria-hidden="true" />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
