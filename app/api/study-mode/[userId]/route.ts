import { prisma } from "@/lib/prisma";

type Params = {
  userId: string;
};

type ChatParams = {
  chatId: string;
};
export async function GET(
  request: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    const { userId } = await params;
    const response = await prisma.studyChat.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ chats: response });
  } catch (error) {
    console.error("Failed to fetch study chats:", error);
    return Response.json(
      { error: "Unable to load previous chats." },
      { status: 500 },
    );
  }
}
