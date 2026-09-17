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
 *
 * Wrapped in a transaction so the balance and the ledger row commit together. Without it a
 * failure between the two calls takes the credit and leaves no audit entry, which is the one
 * thing the ledger exists to prevent.
 */
export async function spendCredit(
  viewer: Viewer,
  feature: CreditFeature,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({
      where: { id: viewer.userId, credits: { gte: 1 } },
      data: { credits: { decrement: 1 } },
    });

    // Thrown from inside the callback, so the transaction rolls back and no ledger row is
    // written for a spend that never happened.
    if (count === 0) throw new InsufficientCreditsError();

    await tx.creditLedger.create({
      data: { userId: viewer.userId, feature, cost: 1 },
    });

    const updated = await tx.user.findUnique({
      where: { id: viewer.userId },
      select: { credits: true },
    });

    return updated?.credits ?? 0;
  });
}

/**
 * Gives a spent credit back, returning the restored balance.
 *
 * The ledger row is written with `cost: -1` rather than deleted or edited, so `SUM(cost)` still
 * equals the credits actually spent and the history shows both the charge and its reversal.
 */
export async function refundCredit(
  viewer: Viewer,
  feature: CreditFeature,
  reason: string,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: viewer.userId },
      data: { credits: { increment: 1 } },
      select: { credits: true },
    });

    await tx.creditLedger.create({
      data: { userId: viewer.userId, feature, cost: -1, reason },
    });

    return updated.credits;
  });
}
