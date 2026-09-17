import { beforeEach, describe, expect, it, vi } from "vitest";

const requireViewer = vi.fn();

vi.mock("@/lib/api-guard", () => ({ requireViewer }));

const enforceRateLimit = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { pdfExtract: { limit: 20, windowMs: 3_600_000 } },
  clientIp: (headers: Headers) =>
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  enforceRateLimit,
}));

const extractText = vi.fn();

vi.mock("unpdf", () => ({ extractText }));

const { POST } = await import("@/app/api/flash-quiz-mode/extract/route");

const viewer = { userId: "user_1", kind: "guest" };

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * A request standing in for a multipart upload. The body is never serialised, so a file can be
 * declared over the size cap without allocating 10 MB of PDF to prove the cap works.
 */
function uploadRequest(options: {
  file?: unknown;
  ip?: string | null;
}): Request {
  const { file, ip = "203.0.113.5" } = options;

  const headers = new Headers();
  if (ip) headers.set("x-forwarded-for", ip);

  return {
    headers,
    formData: async () => ({ get: () => file }),
  } as unknown as Request;
}

/**
 * A real `File` whose `size` is declared, so the route's `instanceof File` check is satisfied
 * without allocating megabytes of PDF just to prove the cap works. The route compares `size`
 * before it reads any bytes, so the declared value is the only one it ever sees.
 */
function upload(name: string, type: string, size: number): File {
  const file = new File([], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function pdf(name = "notes.pdf", size = 1024) {
  return upload(name, "application/pdf", size);
}

beforeEach(() => {
  vi.clearAllMocks();
  requireViewer.mockResolvedValue(viewer);
  enforceRateLimit.mockResolvedValue(null);
});

describe("POST /api/flash-quiz-mode/extract — access", () => {
  it("401s an unauthenticated caller before touching the body", async () => {
    requireViewer.mockResolvedValue(
      Response.json({ code: "NO_IDENTITY" }, { status: 401 }),
    );

    const response = await POST(uploadRequest({ file: pdf() }));

    expect(response.status).toBe(401);
  });

  it("does not even read the IP for a caller with no identity", async () => {
    requireViewer.mockResolvedValue(
      Response.json({ code: "NO_IDENTITY" }, { status: 401 }),
    );

    await POST(uploadRequest({ file: pdf() }));

    expect(enforceRateLimit).not.toHaveBeenCalled();
  });

  it("throttles by IP so rotating guest identities does not reset the allowance", async () => {
    await POST(uploadRequest({ file: pdf(), ip: "203.0.113.5" }));

    expect(enforceRateLimit).toHaveBeenCalledWith(
      "extract:203.0.113.5",
      expect.objectContaining({ limit: 20 }),
    );
  });

  it("returns the 429 when the IP is over the hourly cap", async () => {
    enforceRateLimit.mockResolvedValue(
      Response.json({ code: "RATE_LIMITED" }, { status: 429 }),
    );

    const response = await POST(uploadRequest({ file: pdf() }));

    expect(response.status).toBe(429);
  });

  it("skips the IP limit rather than sharing one bucket when no IP is available", async () => {
    const response = await POST(uploadRequest({ file: pdf(), ip: null }));

    expect(enforceRateLimit).not.toHaveBeenCalled();
    // No IP means no throttle, but the request is still identified and still size-checked.
    expect(response.status).not.toBe(401);
  });
});

describe("POST /api/flash-quiz-mode/extract — input", () => {
  it("400s a request with no file at all", async () => {
    const response = await POST(uploadRequest({ file: null }));

    expect(response.status).toBe(400);
  });

  it("400s a field that is not a File", async () => {
    const response = await POST(uploadRequest({ file: "notes.pdf" }));

    expect(response.status).toBe(400);
  });

  it("400s a non-PDF upload", async () => {
    const response = await POST(
      uploadRequest({ file: upload("notes.txt", "text/plain", 100) }),
    );

    expect(response.status).toBe(400);
  });

  it("413s an upload past the size cap", async () => {
    const response = await POST(
      uploadRequest({ file: pdf("huge.pdf", MAX_UPLOAD_BYTES + 1) }),
    );

    expect(response.status).toBe(413);
  });

  it("accepts an upload exactly at the cap rather than one byte under", async () => {
    // Parsing a real 10 MB PDF is not what this asserts; only that the boundary is not off by one.
    const response = await POST(
      uploadRequest({ file: pdf("exact.pdf", MAX_UPLOAD_BYTES) }),
    );

    expect(response.status).not.toBe(413);
  });

  it("rejects before parsing, so an oversized upload is never buffered into a PDF parser", async () => {
    const response = await POST(
      uploadRequest({ file: pdf("huge.pdf", MAX_UPLOAD_BYTES + 1) }),
    );

    expect(response.status).toBe(413);
    expect(extractText).not.toHaveBeenCalled();
  });

  it("does not parse a non-PDF either", async () => {
    await POST(uploadRequest({ file: upload("notes.txt", "text/plain", 100) }));

    expect(extractText).not.toHaveBeenCalled();
  });
});
