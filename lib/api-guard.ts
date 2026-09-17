import { GUEST_CREDITS, USER_CREDITS, getViewer, type Viewer } from "./auth";
import {
  InsufficientCreditsError,
  spendCredit,
  type CreditFeature,
} from "./credits";

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
    return Response.json(
      {
        message:
          "We couldn't identify this session. Please reload the page and try again.",
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
