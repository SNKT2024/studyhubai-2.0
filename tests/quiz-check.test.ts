import { beforeEach, describe, expect, it, vi } from "vitest";

const requireViewer = vi.fn();

vi.mock("@/lib/api-guard", () => ({ requireViewer }));

const questionFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { quizQuestion: { findFirst: questionFindFirst } },
}));

const enforceRateLimit = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { quizCheck: { limit: 200, windowMs: 600_000 } },
  enforceRateLimit,
}));

const { POST } = await import("@/app/api/flash-quiz-mode/check/route");

const viewer = { userId: "user_1", kind: "guest" };

function check(body: unknown) {
  return POST(
    new Request("http://localhost/api/flash-quiz-mode/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const validBody = { quizId: "quiz_1", questionId: "q_1", chosen: "Beta" };

const question = {
  options: ["Alpha", "Beta", "Gamma"],
  correctAnswer: "Beta",
  explanation: "Beta is the second letter.",
};

beforeEach(() => {
  vi.clearAllMocks();
  requireViewer.mockResolvedValue(viewer);
  enforceRateLimit.mockResolvedValue(null);
  questionFindFirst.mockResolvedValue(question);
});

describe("POST /api/flash-quiz-mode/check — grading", () => {
  it("grades a correct choice", async () => {
    const response = await check(validBody);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      isCorrect: true,
      correctOptionIndex: 1,
    });
  });

  it("grades a wrong choice and still reveals the answer", async () => {
    const response = await check({ ...validBody, chosen: "Gamma" });

    await expect(response.json()).resolves.toMatchObject({
      isCorrect: false,
      correctOptionIndex: 1,
      correctAnswer: "Beta",
      explanation: "Beta is the second letter.",
    });
  });

  it("grades a legacy letter answer against the right option", async () => {
    questionFindFirst.mockResolvedValue({ ...question, correctAnswer: "b" });

    const response = await check(validBody);

    await expect(response.json()).resolves.toMatchObject({
      isCorrect: true,
      correctOptionIndex: 1,
    });
  });

  it("grades an answer that is not one of the options as wrong", async () => {
    const response = await check({ ...validBody, chosen: "Epsilon" });

    await expect(response.json()).resolves.toMatchObject({ isCorrect: false });
  });

  it("does not charge a credit for a database read", async () => {
    // Only the model routes bill; this one is a single row lookup.
    await check(validBody);

    expect(questionFindFirst).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/flash-quiz-mode/check — ownership", () => {
  it("404s a question belonging to another user's quiz", async () => {
    // The lookup is scoped through the quiz, so a foreign id is indistinguishable from a
    // missing one and cannot be graded.
    questionFindFirst.mockResolvedValue(null);

    const response = await check(validBody);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      message: "Question not found",
    });
  });

  it("scopes the lookup to the session's own user", async () => {
    await check(validBody);

    expect(questionFindFirst).toHaveBeenCalledWith({
      where: {
        id: "q_1",
        quizId: "quiz_1",
        quiz: { userId: viewer.userId },
      },
      select: { options: true, correctAnswer: true, explanation: true },
    });
  });

  it("rejects a body missing the quiz id", async () => {
    const response = await check({ questionId: "q_1", chosen: "Beta" });

    expect(response.status).toBe(400);
    expect(questionFindFirst).not.toHaveBeenCalled();
  });

  it("rejects a body missing the chosen answer", async () => {
    const response = await check({ quizId: "quiz_1", questionId: "q_1" });

    expect(response.status).toBe(400);
    expect(questionFindFirst).not.toHaveBeenCalled();
  });
});

describe("POST /api/flash-quiz-mode/check — throttling", () => {
  it("returns the 429 and reads nothing when the caller is over the limit", async () => {
    enforceRateLimit.mockResolvedValue(
      Response.json({ code: "RATE_LIMITED" }, { status: 429 }),
    );

    const response = await check(validBody);

    expect(response.status).toBe(429);
    expect(questionFindFirst).not.toHaveBeenCalled();
  });

  it("keys the limit per viewer", async () => {
    await check(validBody);

    expect(enforceRateLimit).toHaveBeenCalledWith(
      `quiz-check:${viewer.userId}`,
      expect.objectContaining({ limit: 200 }),
    );
  });
});

describe("POST /api/flash-quiz-mode/check — failure", () => {
  it("reports a read failure as a 500 without leaking the error", async () => {
    questionFindFirst.mockRejectedValue(
      new Error('relation "quizquestion" does not exist'),
    );

    const response = await check(validBody);
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).not.toContain("quizquestion");
  });
});
