import { extractText } from "unpdf";

import { requireViewer } from "@/lib/api-guard";
import { RATE_LIMITS, clientIp, enforceRateLimit } from "@/lib/rate-limit";

/** Upload cap. Kept modest because the extracted text is fed straight into a prompt. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Long PDFs would blow up the prompt, so the tail is dropped and the client is told. */
const MAX_CHARACTERS = 40_000;

export async function POST(req: Request) {
  // Gated before the body is touched: this route buffers up to 10 MB and parses it, which made
  // it the cheapest thing in the app to abuse when it was open to anyone.
  const viewer = await requireViewer();
  if (viewer instanceof Response) return viewer;

  // Keyed by IP rather than viewer: this is a resource limit, and a caller rotating guest
  // identities should not get a fresh allowance with each one.
  const ip = clientIp(req.headers);

  if (ip) {
    const throttled = await enforceRateLimit(
      `extract:${ip}`,
      RATE_LIMITS.pdfExtract,
    );
    if (throttled) return throttled;
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json(
        { message: "Attach a PDF file to upload." },
        { status: 400 },
      );
    }

    const looksLikePdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!looksLikePdf) {
      return Response.json(
        { message: "Only PDF files are supported." },
        { status: 400 },
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json(
        { message: "That PDF is larger than 10 MB." },
        { status: 413 },
      );
    }

    const { text, totalPages } = await extractText(
      new Uint8Array(await file.arrayBuffer()),
      { mergePages: true },
    );

    const trimmed = text.trim();

    if (!trimmed) {
      return Response.json(
        {
          message:
            "No text could be read from that PDF. It may be scanned images rather than selectable text.",
        },
        { status: 422 },
      );
    }

    return Response.json({
      fileName: file.name,
      totalPages,
      characters: trimmed.length,
      text: trimmed.slice(0, MAX_CHARACTERS),
      truncated: trimmed.length > MAX_CHARACTERS,
    });
  } catch (error) {
    console.error("PDF extraction error:", error);

    return Response.json(
      { message: "Failed to read that PDF." },
      { status: 500 },
    );
  }
}
