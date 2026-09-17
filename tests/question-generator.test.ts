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

const generateQuestions = vi.fn();

vi.mock("@/lib/llm/generateQuestions", () => ({ generateQuestions }));

const findMany = vi.fn();
const create = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { questionSet: { findMany, create } },
}));

const { GET, POST } = await import("@/app/api/question-generator/route");

const viewer = { userId: "user_1", kind: "guest" };

const validBody = {
  topic: "closures",
  question_format: "MCQ",
  experience: "FRESHER_0_1",
  count: 5,
  includeAnswers: true,
};

function post(body: unknown = validBody) {
  return POST(
    new Request("http://localhost/api/question-generator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  requireViewer.mockResolvedValue(viewer);
  chargeOr402.mockResolvedValue(null);
  enforceAiRateLimit.mockResolvedValue(null);
  findMany.mockResolvedValue([]);
  create.mockResolvedValue({});
  generateQuestions.mockResolvedValue({ questions: [] });
});

describe("GET /api/question-generator — a failure is not reported as success", () => {
  it("returns 500, not 200, when the query fails", async () => {
    // This used to return the raw error object under a 200, so a failure looked like a success.
    findMany.mockRejectedValue(new Error('relation "questionset" does not exist'));

    const response = await GET();

    expect(response.status).toBe(500);
  });

  it("keeps the error details server-side", async () => {
    findMany.mockRejectedValue(
      new Error(
        'relation "questionset" does not exist at character 42 — SELECT id, topic FROM questionset',
      ),
    );

    const response = await GET();
    const body = await response.text();

    expect(body).not.toContain("questionset");
    expect(body).not.toContain("SELECT");
    expect(body).not.toContain("character 42");
  });

  it("responds with a message and no error field", async () => {
    findMany.mockRejectedValue(new Error("boom"));

    const json = (await (await GET()).json()) as Record<string, unknown>;

    expect(json).toEqual({ message: "Failed to load previous questions" });
    expect(json).not.toHaveProperty("error");
  });

  it("returns the sets on the happy path", async () => {
    findMany.mockResolvedValue([{ id: "set_1", topic: "closures" }]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      questions: [{ id: "set_1", topic: "closures" }],
    });
  });

  it("bounds the history and scopes it to the session's own user", async () => {
    await GET();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: viewer.userId },
        take: 20,
      }),
    );
  });

  it("does not ask for the owner id back", async () => {
    await GET();

    const [args] = findMany.mock.calls[0] as [{ select: Record<string, unknown> }];
    expect(args.select).not.toHaveProperty("userId");
  });
});

describe("POST /api/question-generator — billing", () => {
  it("rejects malformed input without charging", async () => {
    const response = await post({ topic: "closures" });

    expect(response.status).toBe(400);
    expect(chargeOr402).not.toHaveBeenCalled();
  });

  it("rejects a count past the cap without charging", async () => {
    const response = await post({ ...validBody, count: 25 });

    expect(response.status).toBe(400);
    expect(chargeOr402).not.toHaveBeenCalled();
  });

  it("refunds the credit when generation fails after the charge", async () => {
    generateQuestions.mockRejectedValue(new Error("model unavailable"));

    const response = await post();

    expect(response.status).toBe(500);
    expect(refundOnFailure).toHaveBeenCalledWith(
      viewer,
      "question-set",
      "generation-failed",
    );
  });

  it("does not refund when the request was rejected before the charge", async () => {
    await post({ topic: "" });

    expect(refundOnFailure).not.toHaveBeenCalled();
  });
});
