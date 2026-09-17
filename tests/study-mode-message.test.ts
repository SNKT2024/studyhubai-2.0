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

const studyChatFindFirst = vi.fn();
const studyMessageCreate = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    studyChat: { findFirst: studyChatFindFirst, update: vi.fn() },
    studyMessage: { create: studyMessageCreate },
    $transaction: transaction,
  },
}));

const streamChatMessage = vi.fn();

vi.mock("@/lib/llm/chatBot", () => ({ streamChatMessage }));

const { POST } = await import("@/app/api/study-mode/[chatId]/route");

const viewer = { userId: "user_1", kind: "guest" };

const params = { params: Promise.resolve({ chatId: "chat_1" }) };

function post(body: unknown, raw?: string) {
  return POST(
    new Request("http://localhost/api/study-mode/chat_1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw ?? JSON.stringify(body),
    }),
    params,
  );
}

/** Callbacks the route handed to the streaming helper. */
type StreamCallbacks = {
  onFinish: (content: string, responseId: string) => Promise<void>;
  onError: (error: unknown) => Promise<void>;
};

function capturedCallbacks(): StreamCallbacks {
  const call = streamChatMessage.mock.calls.at(-1) as unknown[];
  return { onFinish: call[2] as StreamCallbacks["onFinish"], onError: call[3] as StreamCallbacks["onError"] };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireViewer.mockResolvedValue(viewer);
  chargeOr402.mockResolvedValue(null);
  enforceAiRateLimit.mockResolvedValue(null);
  studyChatFindFirst.mockResolvedValue({
    id: "chat_1",
    latestResponseId: null,
  });
  studyMessageCreate.mockResolvedValue({});
  transaction.mockResolvedValue([]);
  streamChatMessage.mockReturnValue({
    toTextStreamResponse: () => new Response("streamed", { status: 200 }),
  });
});

describe("POST /api/study-mode/[chatId] — input validation", () => {
  const rejected: Array<[string, () => Promise<Response>]> = [
    ["a missing content field", () => post({})],
    ["a null content field", () => post({ content: null })],
    ["an empty string", () => post({ content: "" })],
    ["whitespace only", () => post({ content: "   \n\t  " })],
    ["a non-string content", () => post({ content: 42 })],
    ["an array", () => post({ content: ["hello"] })],
    ["an object", () => post({ content: { text: "hello" } })],
    ["content past the length cap", () => post({ content: "a".repeat(9_000) })],
  ];

  for (const [description, send] of rejected) {
    it(`rejects ${description} with a 400`, async () => {
      const response = await send();

      expect(response.status).toBe(400);
    });
  }

  it("stores nothing and charges nothing for a rejected message", async () => {
    await post({ content: "   " });

    expect(studyMessageCreate).not.toHaveBeenCalled();
    expect(chargeOr402).not.toHaveBeenCalled();
    expect(streamChatMessage).not.toHaveBeenCalled();
  });

  it("rejects before it looks the chat up, so a bad body is never billed", async () => {
    await post({ content: "" });

    expect(studyChatFindFirst).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON without storing or charging", async () => {
    const response = await post(undefined, "not json at all");

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(studyMessageCreate).not.toHaveBeenCalled();
    expect(chargeOr402).not.toHaveBeenCalled();
  });

  it("accepts a message exactly at the length cap", async () => {
    const response = await post({ content: "a".repeat(8_000) });

    expect(response.status).toBe(200);
  });

  it("trims before storing so the model never sees a padded prompt", async () => {
    await post({ content: "  what is a monad?  " });

    expect(studyMessageCreate).toHaveBeenCalledWith({
      data: { chatId: "chat_1", content: "what is a monad?", role: "user" },
    });
  });

  it("fixes the role rather than trusting the body", async () => {
    await post({ content: "hello", role: "assistant" });

    const [args] = studyMessageCreate.mock.calls[0] as [{ data: { role: string } }];
    expect(args.data.role).toBe("user");
  });
});

describe("POST /api/study-mode/[chatId] — metering order", () => {
  it("throttles before charging, so a throttled message is never billed", async () => {
    enforceAiRateLimit.mockResolvedValue(
      Response.json({ code: "RATE_LIMITED" }, { status: 429 }),
    );

    const response = await post({ content: "hello" });

    expect(response.status).toBe(429);
    expect(chargeOr402).not.toHaveBeenCalled();
    expect(studyMessageCreate).not.toHaveBeenCalled();
  });

  it("returns the 402 and stores nothing when the balance is empty", async () => {
    chargeOr402.mockResolvedValue(
      Response.json({ code: "INSUFFICIENT_CREDITS" }, { status: 402 }),
    );

    const response = await post({ content: "hello" });

    expect(response.status).toBe(402);
    expect(studyMessageCreate).not.toHaveBeenCalled();
    expect(streamChatMessage).not.toHaveBeenCalled();
  });

  it("404s a chat owned by someone else before charging", async () => {
    studyChatFindFirst.mockResolvedValue(null);

    const response = await post({ content: "hello" });

    expect(response.status).toBe(404);
    expect(chargeOr402).not.toHaveBeenCalled();
  });

  it("scopes the chat lookup to the session's own user", async () => {
    await post({ content: "hello" });

    expect(studyChatFindFirst).toHaveBeenCalledWith({
      where: { userId: viewer.userId, id: "chat_1" },
      select: { id: true, latestResponseId: true },
    });
  });
});

describe("POST /api/study-mode/[chatId] — refund when the stream fails", () => {
  it("refunds the credit when the stream errors", async () => {
    await post({ content: "hello" });

    await capturedCallbacks().onError(new Error("upstream reset"));

    expect(refundOnFailure).toHaveBeenCalledTimes(1);
    expect(refundOnFailure).toHaveBeenCalledWith(
      viewer,
      "study-message",
      "stream-failed",
    );
  });

  it("does not refund a stream that finished", async () => {
    await post({ content: "hello" });

    await capturedCallbacks().onFinish("the answer", "resp_1");

    expect(refundOnFailure).not.toHaveBeenCalled();
  });

  it("does not refund twice when a finished stream then reports an error", async () => {
    // The `settled` guard exists for exactly this: a late error after the answer landed.
    await post({ content: "hello" });

    const { onFinish, onError } = capturedCallbacks();
    await onFinish("the answer", "resp_1");
    await onError(new Error("late failure"));

    expect(refundOnFailure).not.toHaveBeenCalled();
  });

  it("does not refund twice when the error callback fires more than once", async () => {
    await post({ content: "hello" });

    const { onError } = capturedCallbacks();
    await onError(new Error("first"));
    await onError(new Error("second"));

    expect(refundOnFailure).toHaveBeenCalledTimes(1);
  });

  it("leaves the user's own turn in place so it can be retried", async () => {
    await post({ content: "hello" });

    await capturedCallbacks().onError(new Error("upstream reset"));

    // The refund is the compensation, not a rollback of the user's message.
    expect(studyMessageCreate).toHaveBeenCalledTimes(1);
  });
});
