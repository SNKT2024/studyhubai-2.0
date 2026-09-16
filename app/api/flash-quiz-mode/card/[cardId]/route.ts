import { prisma } from "@/lib/prisma";
import z from "zod";

const cardUpdateSchema = z.object({
  isMastered: z.boolean(),
});

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/flash-quiz-mode/card/[cardId]">,
) {
  try {
    const { cardId } = await ctx.params;

    const parsedRequest = cardUpdateSchema.safeParse(await request.json());

    if (!parsedRequest.success) {
      return Response.json(
        { message: "Invalid flashcard update" },
        { status: 400 },
      );
    }

    const card = await prisma.flashcard.update({
      where: { id: cardId },
      data: { isMastered: parsedRequest.data.isMastered },
    });

    return Response.json({ card });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return Response.json({ message: "Flashcard not found" }, { status: 404 });
    }

    console.error("Flashcard update error:", error);

    return Response.json(
      { message: "Failed to update the flashcard" },
      { status: 500 },
    );
  }
}
