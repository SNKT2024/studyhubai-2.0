/**
 * Lets the AI call sites tell the header badge to re-read the balance without threading state
 * through the whole tree. A window event is enough here — the badge is the only listener, and
 * it lives in the layout while the call sites are scattered across the pages.
 */
export const CREDITS_CHANGED_EVENT = "credits:changed";

export function notifyCreditsChanged() {
  window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
}

export type CreditBalance = {
  credits: number;
  /**
   * `"none"` means the visitor has no identity at all — no guest cookie, or they have hit the
   * per-IP cap on minting guest identities. The badge offers sign-up instead of a number.
   */
  kind: "user" | "guest" | "none";
};

/** True when a response body is the 402 the API sends once the balance is gone. */
export function isOutOfCredits(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { code?: unknown }).code === "INSUFFICIENT_CREDITS"
  );
}
