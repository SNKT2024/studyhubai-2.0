import { GUEST_CREDITS, USER_CREDITS, getViewer, type Viewer } from "./auth";
import {
  InsufficientCreditsError,
  refundCredit,
  spendCredit,
  type CreditFeature,
} from "./credits";
import { RATE_LIMITS, enforceRateLimit } from "./rate-limit";

/**
 * Resolves the caller's identity. Returns a `Response` when they have none, so every route
 * opens the same way:
 *
 *   const viewer = await requireViewer();
 *   if (viewer instanceof Response) return viewer;
 */
export async function requireViewer(): Promise<Viewer | Response> {
  const viewer = await getViewer();

  if (!viewer) {
    // The `NO_IDENTITY` code is what the badge keys off to offer the sign-up path. Reloading
    // cannot help: either there is no cookie at all, or the guest identity cap has been hit —
    // and in the second case the client would be told to reload forever.
    return Response.json(
      {
        message: "We couldn't identify this session. Please sign in to continue.",
        code: "NO_IDENTITY",
      },
      { status: 401 },
    );
  }

  return viewer;
}

/** The 402 the client keys off to decide whether to offer the sign-up path. */
export function insufficientCredits(viewer: Viewer): Response {
  return Response.json(
    {
      message:
        viewer.kind === "guest"
          ? `You've used all ${GUEST_CREDITS} guest AI credits. Sign up to get ${USER_CREDITS} more.`
          : "You've used all your AI credits.",
      code: "INSUFFICIENT_CREDITS",
      credits: 0,
      kind: viewer.kind,
    },
    { status: 402 },
  );
}

/**
 * Charges an already-resolved viewer. Returns the 402 to send when the balance is short, or
 * `null` when the charge went through.
 *
 * Deliberately not folded into `requireViewer`: every gated route has work to do before it can
 * bill — validating the body, or looking the chat up so a missing one 404s — and a combined
 * helper would charge for requests that should never have cost anything.
 */
export async function chargeOr402(
  viewer: Viewer,
  feature: CreditFeature,
): Promise<Response | null> {
  try {
    await spendCredit(viewer, feature);
    return null;
  } catch (error) {
    if (error instanceof InsufficientCreditsError) return insufficientCredits(viewer);
    throw error;
  }
}

/**
 * Hands a credit back after the work it paid for failed.
 *
 * Every LLM route charges before it calls the model — deliberately, because the streaming chat
 * route cannot send a 402 once the response has started — so without this a model outage bills
 * the user for nothing.
 *
 * Swallows its own failures. The caller is already reporting an error to the user, and a
 * refund problem must not replace that with a second, more confusing one. The ledger will show
 * the charge without its reversal, which is the signal to reconcile manually.
 */
export async function refundOnFailure(
  viewer: Viewer,
  feature: CreditFeature,
  reason: string,
): Promise<void> {
  try {
    await refundCredit(viewer, feature, reason);
  } catch (error) {
    console.error("Failed to refund a credit:", {
      userId: viewer.userId,
      feature,
      reason,
      error,
    });
  }
}

/**
 * Burst guard for an AI route, keyed per viewer so one caller cannot spend another's budget.
 *
 * Separate from the credit check on purpose: credits cap *how much* a caller can spend, this
 * caps how fast. It is checked first so a throttled request is never billed.
 */
export async function enforceAiRateLimit(
  viewer: Viewer,
  scope: "chat" | "question-set" | "flash-quiz",
): Promise<Response | null> {
  return enforceRateLimit(`${scope}:${viewer.userId}`, RATE_LIMITS.aiFeature);
}
