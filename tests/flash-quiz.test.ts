import { beforeEach, describe, expect, it, vi } from "vitest";

const requireViewer = vi.fn();
const chargeOr402 = vi.fn();
const refundOnFailure = vi.fn();
const enforceAiRateLimit = vi.fn();

vi.mock("@/lib/api-guard", () => ({
  requireViewer,
  chargeOr402,
  refundOnFailure,
  enforceAiRateLimit,
}));

vi.mock("@/lib/prompts", () => ({ renderPrompt: () => "a prompt" }));

const generateFlashcarQuiz = vi.fn();

vi.mock("@/lib/llm/flashCards_Quiz", () => ({ generateFlashcarQuiz }));

const deckCreate = vi.fn();
const quizCreate = vi.fn();
const deckFindMany = vi.fn();
const quizFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    flashcardDeck: { create: deckCreate, findMany: deckFindMany },
    quiz: { create: quizCreate, findMany: quizFindMany },
  },
}));

const { GET, POST } = await import("@/app/api/flash-quiz-mode/route");

const viewer = { userId: "user_1", kind: "guest" };

const quizRequest = () =>
  new Request("http://localhost/api/flash-quiz-mode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "quiz", topic: "monads" }),
  });

const modelQuiz = {
  questions: [
    {
      question: "What is a monad?",
      options: { a: "A burrito", b: "A monoid in the category of endofunctors" },
      answer: "b",
      explanation: "It is a monoid in the category of endofunctors.",
    },
  ],
};

/** The row Prisma would return for the projection the route asks for — answers excluded. */
const persistedQuiz = {
  id: "quiz_1",
  deckId: null,
  title: "Quiz: monads",
  topic: "monads",
  sourceType: "TOPIC",
  sourceName: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  questions: [
    {
      id: "q_1",
      quizId: "quiz_1",
      order: 0,
      question: "What is a monad?",
      options: ["A burrito", "A monoid in the category of endofunctors"],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  requireViewer.mockResolvedValue(viewer);
  chargeOr402.mockResolvedValue(null);
  enforceAiRateLimit.mockResolvedValue(null);
  generateFlashcarQuiz.mockResolvedValue(modelQuiz);
  quizCreate.mockResolvedValue(persistedQuiz);
  deckCreate.mockResolvedValue({
    id: "deck_1",
    cards: [],
  });
  deckFindMany.mockResolvedValue([]);
  quizFindMany.mockResolvedValue([]);
});

describe("POST /api/flash-quiz-mode — the response carries no answers", () => {
  it("returns a quiz the client cannot read the answers out of", async () => {
    const response = await POST(quizRequest());
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).not.toContain("correctAnswer");
    expect(body).not.toContain("explanation");
  });

  it("never asks the database for the answer columns", async () => {
    // The projection is the actual guard: an answer that is never selected cannot be forwarded.
    await POST(quizRequest());

    const [args] = quizCreate.mock.calls[0] as [
      { select: { questions: { select: Record<string, unknown> } } },
    ];

    expect(args.select.questions.select).not.toHaveProperty("correctAnswer");
    expect(args.select.questions.select).not.toHaveProperty("explanation");
  });

  it("does not forward the raw model output", async () => {
    // The response used to spread `...result`, which carried the model's own `answer` field.
    const response = await POST(quizRequest());
    const body = await response.text();

    expect(body).not.toMatch(/"answer"\s*:/);
  });

  it("stores the resolved option text rather than the model's letter", async () => {
    await POST(quizRequest());

    const [args] = quizCreate.mock.calls[0] as [
      { data: { questions: { create: Array<{ correctAnswer: string }> } } },
    ];

    expect(args.data.questions.create[0]?.correctAnswer).toBe(
      "A monoid in the category of endofunctors",
    );
  });

  it("returns the persisted deck for a flashcards request, without the model output", async () => {
    generateFlashcarQuiz.mockResolvedValue({
      flashcards: [{ front: "front", back: "back", hint: "hint", answer: "leak" }],
    });

    const response = await POST(
      new Request("http://localhost/api/flash-quiz-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "flashcards", topic: "monads" }),
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"deck"');
    expect(body).not.toContain("leak");
  });
});

describe("POST /api/flash-quiz-mode — billing", () => {
  it("rejects an unknown action without charging", async () => {
    const response = await POST(
      new Request("http://localhost/api/flash-quiz-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "essay", topic: "monads" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(chargeOr402).not.toHaveBeenCalled();
  });

  it("rejects a malformed request without charging", async () => {
    const response = await POST(
      new Request("http://localhost/api/flash-quiz-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quiz" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(chargeOr402).not.toHaveBeenCalled();
  });

  it("refunds the credit when generation fails after the charge", async () => {
    generateFlashcarQuiz.mockRejectedValue(new Error("model unavailable"));

    const response = await POST(quizRequest());

    expect(response.status).toBe(500);
    expect(refundOnFailure).toHaveBeenCalledWith(
      viewer,
      "flash-quiz",
      "generation-failed",
    );
  });

  it("does not refund when the request was rejected before the charge", async () => {
    const response = await POST(
      new Request("http://localhost/api/flash-quiz-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "essay", topic: "monads" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(refundOnFailure).not.toHaveBeenCalled();
  });

  it("refunds when the model returns an unusable shape", async () => {
    generateFlashcarQuiz.mockResolvedValue({ unexpected: true });

    const response = await POST(quizRequest());

    expect(response.status).toBe(500);
    expect(refundOnFailure).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/flash-quiz-mode — the library carries no answers", () => {
  it("returns decks and quizzes with no answer fields anywhere", async () => {
    deckFindMany.mockResolvedValue([
      { id: "deck_1", title: "Deck", cards: [{ id: "c_1", front: "a", back: "b" }] },
    ]);
    quizFindMany.mockResolvedValue([persistedQuiz]);

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).not.toContain("correctAnswer");
    expect(body).not.toContain("explanation");
  });

  it("never asks the database for the answer columns", async () => {
    await GET();

    const [quizArgs] = quizFindMany.mock.calls[0] as [
      { select: { questions: { select: Record<string, unknown> } } },
    ];

    expect(quizArgs.select.questions.select).not.toHaveProperty("correctAnswer");
    expect(quizArgs.select.questions.select).not.toHaveProperty("explanation");
  });

  it("bounds both collections so the response cannot grow with the account", async () => {
    await GET();

    expect(deckFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
    expect(quizFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it("scopes both queries to the session's own user", async () => {
    await GET();

    expect(deckFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: viewer.userId } }),
    );
    expect(quizFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: viewer.userId } }),
    );
  });

  it("does not leak the owner id back to the client", async () => {
    await GET();

    const [deckArgs] = deckFindMany.mock.calls[0] as [
      { select: Record<string, unknown> },
    ];
    const [quizArgs] = quizFindMany.mock.calls[0] as [
      { select: Record<string, unknown> },
    ];

    expect(deckArgs.select).not.toHaveProperty("userId");
    expect(quizArgs.select).not.toHaveProperty("userId");
  });
});
