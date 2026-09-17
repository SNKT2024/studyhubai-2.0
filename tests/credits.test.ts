import { beforeEach, describe, expect, it, vi } from "vitest";

const userUpdateMany = vi.fn();
const userUpdate = vi.fn();
const userFindUnique = vi.fn();
const ledgerCreate = vi.fn();

/**
 * An interactive transaction: the callback is handed a client, so `tx` and the top-level
 * `prisma` are the same doubles here. That is enough to assert *what* is written together —
 * the atomicity itself is Postgres's, not something a unit test can prove.
 */
const transaction = vi.fn(
  async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
);

const tx = {
  user: {
    updateMany: userUpdateMany,
    update: userUpdate,
    findUnique: userFindUnique,
  },
  creditLedger: { create: ledgerCreate },
};

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: transaction },
}));

const { CREDIT_FEATURES, InsufficientCreditsError, refundCredit, spendCredit } =
  await import("@/lib/credits");

const viewer = { userId: "user_1", kind: "guest", credits: 5 } as const;

beforeEach(() => {
  vi.clearAllMocks();
  userUpdateMany.mockResolvedValue({ count: 1 });
  userFindUnique.mockResolvedValue({ credits: 4 });
  userUpdate.mockResolvedValue({ credits: 5 });
  ledgerCreate.mockResolvedValue({});
});

describe("spendCredit", () => {
  it("decrements the balance and writes the ledger row inside one transaction", async () => {
    const remaining = await spendCredit(viewer, CREDIT_FEATURES.studyChat);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(remaining).toBe(4);

    expect(userUpdateMany).toHaveBeenCalledWith({
      where: { id: viewer.userId, credits: { gte: 1 } },
      data: { credits: { decrement: 1 } },
    });
    expect(ledgerCreate).toHaveBeenCalledWith({
      data: {
        userId: viewer.userId,
        feature: CREDIT_FEATURES.studyChat,
        cost: 1,
      },
    });
  });

  it("guards the decrement on a positive balance", async () => {
    // The `gte: 1` in the WHERE clause is what makes two concurrent spends of the last credit
    // safe: only one of them can match.
    await spendCredit(viewer, CREDIT_FEATURES.studyChat);

    const [args] = userUpdateMany.mock.calls[0] as [
      { where: { credits: { gte: number } } },
    ];
    expect(args.where.credits.gte).toBe(1);
  });

  it("throws InsufficientCreditsError and writes no ledger row when the balance is empty", async () => {
    userUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      spendCredit(viewer, CREDIT_FEATURES.studyChat),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);

    // Thrown from inside the callback, so the transaction rolls back.
    expect(ledgerCreate).not.toHaveBeenCalled();
  });

  it("treats an empty balance as no credits rather than a negative one", async () => {
    userUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      spendCredit(viewer, CREDIT_FEATURES.studyChat),
    ).rejects.toMatchObject({ name: "InsufficientCreditsError" });
  });
});

describe("refundCredit", () => {
  it("increments the balance and records a negative ledger row", async () => {
    const restored = await refundCredit(
      viewer,
      CREDIT_FEATURES.flashQuiz,
      "generation-failed",
    );

    expect(restored).toBe(5);
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: viewer.userId },
      data: { credits: { increment: 1 } },
      select: { credits: true },
    });
    expect(ledgerCreate).toHaveBeenCalledWith({
      data: {
        userId: viewer.userId,
        feature: CREDIT_FEATURES.flashQuiz,
        cost: -1,
        reason: "generation-failed",
      },
    });
  });

  it("writes the reversal as a row rather than editing the spend", async () => {
    // So SUM(cost) still equals the credits actually spent and the history shows both halves.
    await refundCredit(viewer, CREDIT_FEATURES.flashQuiz, "generation-failed");

    const [args] = ledgerCreate.mock.calls[0] as [{ data: { cost: number } }];
    expect(args.data.cost).toBe(-1);
    expect(userUpdate).toHaveBeenCalledTimes(1);
  });
});
