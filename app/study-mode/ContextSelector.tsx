"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { notifyCreditsChanged } from "@/lib/credits-client";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HiOutlineLightBulb } from "react-icons/hi";
import { MdMenuBook, MdWork } from "react-icons/md";
import { MdDelete } from "react-icons/md";
import { toast } from "@/components/ui/toast";

const ContextData = [
  {
    id: 1,
    title: "NORMAL",
    description: "Access everyday language.",
    value: "NORMAL",
    icon: <HiOutlineLightBulb size={28} />,
  },
  {
    id: 2,
    title: "EXAM REVISION",
    value: "EXAM_REVISION",
    description:
      "Focuses on textbook definitions, marking schemes, and key theoretical terms.",
    icon: <MdMenuBook size={28} />,
  },
  {
    id: 3,
    title: "INTERVIEW BASED",
    value: "INTERVIEW_BASED",
    description:
      "Focuses on industry trade-offs, scalability, and how to explain it in 60 seconds.",
    icon: <MdWork size={28} />,
  },
];

type Chat = {
  id: string;
  userId: string;
  title: string;
  contextMode: string;
  createdAt: string;
  updatedAt: string;
  latestResponseId: string | null;
};

export function ContextSelector() {
  const router = useRouter();
  const topicTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [contextMode, setContextMode] = useState("");
  const [studyTopic, setStudyTopic] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [allchats, setAllChats] = useState<Chat[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chatLoadAttempt, setChatLoadAttempt] = useState(0);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    topicTextareaRef.current?.focus();
  }, []);

  useEffect(() => {
    async function getAllChats() {
      try {
        setIsLoading(true);
        setLoadError(null);

        const response = await fetch("/api/study-mode");
        const result = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(result?.error ?? "Failed to fetch previous chats");
        }

        if (!Array.isArray(result?.chats)) {
          throw new Error("The previous chats response was invalid");
        }

        setAllChats(result.chats);
      } catch (error) {
        console.error("Something went wrong while fetching all chats:", error);
        setLoadError("We couldn't load previous chats. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    getAllChats();
  }, [chatLoadAttempt]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isCreating) return;
    setIsCreating(true);
    try {
      const response = await fetch("/api/study-mode/create-new-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: studyTopic,
          contextMode,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        // 402 means the balance is gone; the header badge reflects it too.
        if (response.status === 402) {
          toast.add({
            title: "Out of AI credits",
            description: result?.message ?? "You've used all your AI credits.",
          });
        }
        throw new Error(result?.error ?? result?.message ?? "Failed");
      }

      notifyCreditsChanged();
      router.push(`/study-mode/${result.chatId}`);
    } catch (error) {
      console.error(error);
      setIsCreating(false);
    }
  };

  const previousChat = async (previousChatId: string) => {
    previousChatId.trim();
    try {
      router.push(`/study-mode/${previousChatId}`);
    } catch (error) {
      console.error(error);
    }
  };
  if (isCreating) {
    return (
      <div className="flex min-h-64 w-full items-center justify-center px-4">
        <div
          className="flex flex-col items-center gap-3 text-center"
          role="status"
        >
          <LoaderCircle className="size-7 animate-spin text-secondary" />
          <p className="text-lg font-semibold text-secondary">
            Creating Your Chat
          </p>
          <p className="text-sm text-secondary">
            Preparing your personalized study session...
          </p>
        </div>
      </div>
    );
  }

  const handleDeleteChat = async (chatId: string) => {
    if (deletingChatId) return;

    setDeletingChatId(chatId);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/study-mode/${chatId}`, {
        method: "DELETE",
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error ?? "Failed to delete chat");
      }

      setAllChats((chats) => chats.filter((chat) => chat.id !== chatId));
    } catch (error) {
      console.error("Failed to delete chat:", error);
      setDeleteError(
        error instanceof Error
          ? error.message
          : "We couldn't delete that chat. Please try again.",
      );
    } finally {
      setDeletingChatId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <form
        className="bg-secondary rounded-3xl w-full max-w-md px-4 py-5"
        onSubmit={handleSubmit}
      >
        <div className="mb-4">
          <label htmlFor="study-topic" className="text-sm font-medium">
            Study Topic:
          </label>
          <Textarea
            id="study-topic"
            ref={topicTextareaRef}
            placeholder="e.g., Dijkstra's algorithm, Python variables, Cellular respiration"
            className="mt-1.5 min-h-16 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-secondary"
            onChange={(e) => setStudyTopic(e.target.value)}
          />
        </div>
        <h3 className="text-sm font-medium">Choose Context Mode:</h3>
        <div className="mt-2 grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
          {ContextData.map((context) => {
            return (
              <Button
                type="button"
                variant="outline"
                key={context.id}
                className={`flex min-h-24 w-full flex-col items-center bg-primary justify-start rounded-lg border-secondary hover:border-primary  px-1.5 py-3 text-center text-secondary whitespace-normal cursor-pointer  hover:bg-secondary sm:min-h-40 ${contextMode === context.value ? "text-primary bg-secondary border-primary" : ""}`}
                onClick={() => setContextMode(context.value)}
              >
                <span className="mb-2 flex size-9  items-center  justify-center ">
                  {context.icon}
                </span>
                <h5 className="text-[12px] font-semibold uppercase leading-tight tracking-wide">
                  {context.title}
                </h5>
                <p className="mt-1 text-[11px] text-center  ">
                  {context.description}
                </p>
              </Button>
            );
          })}
        </div>
        <Button
          type="submit"
          className="mt-3 h-10 w-full rounded-full bg-primary text-secondary text-md   font-light cursor-pointer active:translate-y-0 hover:bg-secondary hover:border-primary hover:text-primary"
        >
          Start Study Session
        </Button>
        <p className="font-ligh text-xs mt-3">
          Note: Enter the topic you want to study about and select the context
          mode according to your requriments and start the study session.
        </p>
      </form>
      <div className="bg-secondary rounded-3xl w-full max-w-md px-4 py-5">
        <div
          className="h-72 scroll-fade scrollbar-none overflow-y-auto"
          aria-live="polite"
        >
          <h3 className="text-center font-semibold">Previous Chats</h3>
          {isLoading ? (
            <div
              className="flex h-56 flex-col items-center justify-center gap-2 text-sm text-primary"
              role="status"
            >
              <LoaderCircle className="size-5 animate-spin" />
              <span>Loading previous chats...</span>
            </div>
          ) : loadError ? (
            <div
              className="flex h-56 flex-col items-center justify-center gap-3 px-4 text-center text-sm text-primary"
              role="alert"
            >
              <p>{loadError}</p>
              <Button
                type="button"
                variant="outline"
                className="border-primary text-primary hover:bg-primary hover:text-secondary"
                onClick={() => setChatLoadAttempt((attempt) => attempt + 1)}
              >
                Try again
              </Button>
            </div>
          ) : allchats.length === 0 ? (
            <p className="flex h-56 items-center justify-center px-4 text-center text-sm text-primary">
              No previous chats yet.
            </p>
          ) : (
            <div className="flex  flex-col gap-1.5 p-1.5">
              {deleteError && (
                <p
                  className="px-2 text-center text-sm text-red-700"
                  role="alert"
                >
                  {deleteError}
                </p>
              )}
              {allchats.map((chat) => (
                <div
                  key={chat.id}
                  className="flex items-center flex-row  justify-evenly"
                >
                  <Button
                    type="button"
                    className="min-w-0 flex-1 truncate rounded-lg bg-primary text-secondary hover:bg-secondary hover:text-primary hover:border-primary cursor-pointer px-3 py-2.5 text-sm"
                    onClick={() => previousChat(chat.id)}
                  >
                    {chat.title}
                  </Button>
                  <Button
                    type="button"
                    className="shrink-0 text-secondary hover:bg-secondary hover:text-primary hover:border-primary cursor-pointer"
                    disabled={deletingChatId === chat.id}
                    onClick={() => handleDeleteChat(chat.id)}
                  >
                    {deletingChatId === chat.id ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <MdDelete />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
