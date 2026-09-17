import "server-only";

import { prisma } from "./prisma";

/**
 * Deletes guest accounts that have been idle for `retentionDays`.
 *
 * Guests accumulate a row per identity, and the per-IP cap in lib/auth.ts limits how fast new
 * ones appear but never removes the old ones. Cascade deletes on User remove each guest's
 * chats, question sets, decks, quizzes and ledger rows with them — which is the intent for an
 * abandoned guest, and is also why this only ever touches `isGuest` rows.
 */
export async function cleanupStaleGuests(retentionDays = 30): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const { count } = await prisma.user.deleteMany({
    where: {
      isGuest: true,
      // A guest row is touched on every spend, so `updatedAt` is a good activity proxy.
      updatedAt: { lt: cutoff },
      // Belt and braces: never delete a row that has somehow been claimed by a real account.
      email: null,
    },
  });

  return count;
}
