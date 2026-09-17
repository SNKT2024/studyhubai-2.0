import { requireViewer } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import z from "zod";

const cardUpdateSchema = z.object({
  isMastered: z.boolean(),
});

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/flash-quiz-mode/card/[cardId]">,
) {
  const viewer = await requireViewer();
  if (viewer instanceof Response) return viewer;

  try {
    const { cardId } = await ctx.params;

    const parsedRequest = cardUpdateSchema.safeParse(await request.json());

    if (!parsedRequest.success) {
      return Response.json(
        { message: "Invalid flashcard update" },
        { status: 400 },
      );
    }

    // Ownership is checked through the deck, so a card belonging to someone else reads as
    // missing rather than being quietly editable.
    const owned = await prisma.flashcard.findFirst({
      where: { id: cardId, deck: { userId: viewer.userId } },
      select: { id: true },
    });

    if (!owned) {
      return Response.json({ message: "Flashcard not found" }, { status: 404 });
    }

    const card = await prisma.flashcard.update({
      where: { id: owned.id },
      data: { isMastered: parsedRequest.data.isMastered },
    });

    return Response.json({ card });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return Response.json({ message: "Flashcard not found" }, { status: 404 });
    }

    console.error("Flashcard update error:", error);

    return Response.json(
      { message: "Failed to update the flashcard" },
      { status: 500 },
    );
  }
}
