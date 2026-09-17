import type { Viewer } from "./auth";
import { prisma } from "./prisma";

/** Which feature spent the credit. Stored on each ledger row so usage can be broken down. */
export const CREDIT_FEATURES = {
  studyChat: "study-chat",
  studyMessage: "study-message",
  questionSet: "question-set",
  flashQuiz: "flash-quiz",
} as const;

export type CreditFeature =
  (typeof CREDIT_FEATURES)[keyof typeof CREDIT_FEATURES];

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Not enough AI credits");
    this.name = "InsufficientCreditsError";
  }
}

/**
 * Spends one credit, returning the remaining balance.
 *
 * The `gte` guard and the decrement are a single UPDATE, which is what makes this safe under
 * concurrency: two requests racing for the last credit cannot both see a balance of 1, because
 * only one of them can match the WHERE clause.
 */
export async function spendCredit(
  viewer: Viewer,
  feature: CreditFeature,
): Promise<number> {
  const { count } = await prisma.user.updateMany({
    where: { id: viewer.userId, credits: { gte: 1 } },
    data: { credits: { decrement: 1 } },
  });

  if (count === 0) throw new InsufficientCreditsError();

  await prisma.creditLedger.create({
    data: { userId: viewer.userId, feature, cost: 1 },
  });

  const updated = await prisma.user.findUnique({
    where: { id: viewer.userId },
    select: { credits: true },
  });

  return updated?.credits ?? 0;
}
