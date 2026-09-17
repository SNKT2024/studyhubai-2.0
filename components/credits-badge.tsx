"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

import {
  CREDITS_CHANGED_EVENT,
  type CreditBalance,
} from "@/lib/credits-client";

/**
 * Shows the remaining AI credits. Renders nothing until the first read lands, so the header
 * never flashes a wrong number.
 */
export function CreditsBadge() {
  const [balance, setBalance] = useState<CreditBalance | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch("/api/credits", { signal: controller.signal });
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          // A 401 means there is no identity to show a balance for. Rendering the sign-up
          // prompt is the useful response; staying hidden would leave the visitor with no
          // explanation for why every feature is failing.
          setBalance(
            body?.code === "NO_IDENTITY"
              ? { credits: 0, kind: "none" }
              : null,
          );
          return;
        }

        setBalance(body);
      } catch {
        // Leave the badge hidden rather than showing a stale or invented balance.
      }
    }

    void load();
    window.addEventListener(CREDITS_CHANGED_EVENT, load);

    return () => {
      controller.abort();
      window.removeEventListener(CREDITS_CHANGED_EVENT, load);
    };
  }, []);

  if (!balance) return null;

  const isUnidentified = balance.kind === "none";
  const isOut = isUnidentified || balance.credits === 0;

  const label = isUnidentified
    ? "Sign up to get 50 AI credits"
    : balance.kind === "guest"
      ? `${balance.credits} guest AI credits left`
      : `${balance.credits} AI credits left`;

  return (
    <span
      title={label}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums ${
        isOut
          ? "border-red-400/60 text-red-300"
          : "border-secondary/40 text-secondary"
      }`}
    >
      <Zap className="size-3.5" aria-hidden="true" />
      <span aria-hidden="true">
        {isUnidentified ? "Sign up" : balance.credits}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
