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
        if (!response.ok) return;

        setBalance(await response.json());
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

  const isOut = balance.credits === 0;
  const label =
    balance.kind === "guest"
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
      <span aria-hidden="true">{balance.credits}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
