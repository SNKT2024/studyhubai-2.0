"use client";

import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { ContextMode } from "@/lib/generated/prisma/enums";
import { notifyCreditsChanged } from "@/lib/credits-client";
// Add Trash2 to your lucide-react imports
import { Bot, LoaderCircle, Trash2 } from "lucide-react";
import { FaArrowUp } from "react-icons/fa";
import { useParams, useRouter } from "next/navigation";
import { Fragment, memo, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { toast, Toaster } from "@/components/ui/toast";

type ChatMessage = {
  id: string;
  content: string;
  role: "user" | "assistant";
};

type Chat = {
  id: string;
  title: string;
  messages: ChatMessage[];
  contextMode: ContextMode;
};

/** Thrown when the API answers 402, so the catch block can word the toast differently. */
class OutOfCreditsError extends Error {}

const markdownComponents = {
  code({ className, children, ...props }: React.ComponentProps<"code">) {
    const language = className?.match(/language-(\w+)/)?.[1];

    if (!language) {
      return (
        <code
          className="rounded bg-background/70 px-1.5 py-0.5 font-mono text-[0.9em]"
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        PreTag="div"
        className="my-2 rounded-lg border border-secondary text-sm"
      >
        {String(children).replace(/\n$/, "")}
      </SyntaxHighlighter>
    );
  },
};

const ChatMessageView = memo(function ChatMessageView({
  message,
  scrollAnchor,
  isStreaming = false,
}: {
  message: ChatMessage;
  scrollAnchor: boolean;
  isStreaming?: boolean;
}) {
  if (!message.content) return null;

  return (
    <MessageScrollerItem scrollAnchor={scrollAnchor}>
      <Message align={message.role === "user" ? "end" : "start"} className={``}>
        <MessageContent
          className={`max-w-[85%] rounded-xl text-white px-4 py-3 bg-primary`}
        >
          {isStreaming ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown
              components={markdownComponents}
              remarkPlugins={[remarkGfm]}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  );
});

export function ChatWindow() {
  const { chatId } = useParams<{ chatId: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // NEW: Add state to manage deletion loading
  const [isDeleting, setIsDeleting] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastMessageLength = messages.at(-1)?.content.length ?? 0;
  const router = useRouter();

  useEffect(() => {
    if (!chatId) return;

    async function getChat() {
      const response = await fetch(`/api/study-mode/${chatId}`);
      if (!response.ok) throw new Error("Failed to fetch chat");

      const result = await response.json();
      setChat(result.chat);
      setMessages(result.chat.messages);
      setLoadError(null);
    }

    getChat()
      .catch((error) => {
        console.error("Something went wrong while fetching chat:", error);
        setLoadError("We couldn't load this chat.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [chatId]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (viewport)
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "auto" });
    });

    return () => cancelAnimationFrame(frame);
  }, [lastMessageLength, isSending]);

  useEffect(() => {
    if (!isLoading && !isSending && !isDeleting) {
      textareaRef.current?.focus();
    }
  }, [isLoading, isSending, isDeleting]);

  // NEW: Handle Chat Deletion
  async function handleDeleteChat() {
    if (!confirm("Are you sure you want to delete this chat?")) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/study-mode/${chatId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete chat");

      // Replace '/study-mode' with wherever you want the user to go after deletion
      router.push("/study-mode");
      // Important: Forces Next.js to re-fetch Server Components (like the sidebar chat list)
      router.refresh();
    } catch (error) {
      console.error("Delete failed:", error);
      toast.add({
        title: "Error",
        description: "Failed to delete chat.",
      });
      setIsDeleting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = input.trim();
    if (!content || !chatId || isSending) return;

    setIsSending(true);
    setInput("");
    const assistantMessageId = crypto.randomUUID();

    const optimisticMessage: ChatMessage = {
      id: crypto.randomUUID(),
      content,
      role: "user",
    };
    setMessages((currentMessages) => [
      ...currentMessages,
      optimisticMessage,
      { id: assistantMessageId, content: "", role: "assistant" },
    ]);

    try {
      const response = await fetch(`/api/study-mode/${chatId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      // 402 arrives with no stream body at all — the server charges before it opens the stream.
      if (response.status === 402) {
        const result = await response.json().catch(() => null);
        throw new OutOfCreditsError(
          result?.message ?? "You've used all your AI credits.",
        );
      }

      if (!response.ok) throw new Error("Failed to send message");

      if (!response.body)
        throw new Error("The response did not contain a stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        setMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === assistantMessageId
              ? { ...message, content: message.content + chunk }
              : message,
          ),
        );
      }

      const finalChunk = decoder.decode();
      if (finalChunk) {
        setMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === assistantMessageId
              ? { ...message, content: message.content + finalChunk }
              : message,
          ),
        );
      }

      notifyCreditsChanged();
    } catch (error) {
      console.error("Something went wrong while sending the message:", error);

      if (error instanceof OutOfCreditsError) {
        toast.add({ title: "Out of AI credits", description: error.message });
      } else {
        toast.add({
          title: "Error",
          description: "Failed to send message. Please try again.",
        });
      }

      setMessages((currentMessages) =>
        currentMessages.filter(
          (message) =>
            message.id !== optimisticMessage.id &&
            message.id !== assistantMessageId,
        ),
      );
      setInput(content);
      notifyCreditsChanged();
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  if (isLoading) {
    return (
      <div className="flex min-h-64 flex-1 w-full items-center justify-center rounded-xl border-primary bg-secondary">
        <div className="flex items-center gap-3 text-primary" role="status">
          <LoaderCircle className="size-5 animate-spin" />
          <span>Loading your study chat...</span>
        </div>
      </div>
    );
  }

  if (loadError || !chat) {
    return (
      <div className="flex min-h-64 flex-1 w-full flex-col items-center justify-center rounded-xl px-6 text-center bg-secondary text-primary gap-3">
        {loadError ?? "This chat could not be found."}
        <Button
          className="text-secondary p-4 cursor-pointer"
          onClick={() => router.push(`/study-mode`)}
        >
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <MessageScrollerProvider>
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <Card className="min-h-0 flex-1 bg-secondary">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-row flex-wrap items-center gap-3">
              <CardTitle className="bg-primary uppercase font-normal rounded-lg border-primary w-fit max-w-full truncate px-3 py-1 text-secondary">
                {chat.title}
              </CardTitle>
              <CardAction className="bg-primary font-normal rounded-lg border-primary w-fit max-w-full truncate px-3 py-1 text-secondary">
                {chat.contextMode}
              </CardAction>
            </div>
            <Button
              variant="destructive"
              size="icon"
              onClick={handleDeleteChat}
              disabled={isDeleting}
              className="ml-auto flex-shrink-0 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
            >
              {isDeleting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </Button>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            {messages.length === 0 ? (
              <Empty className="h-full">
                <EmptyHeader>
                  <EmptyMedia variant="icon" />
                  <EmptyTitle>Start a study session</EmptyTitle>
                  <EmptyDescription>
                    Ask a question to begin your conversation.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <MessageScroller>
                <MessageScrollerViewport ref={viewportRef}>
                  <MessageScrollerContent
                    aria-busy={isSending}
                    className="p-(--card-spacing)"
                  >
                    {messages.map((message, index) => (
                      <Fragment key={message.id}>
                        {isSending &&
                          index === messages.length - 1 &&
                          message.role === "assistant" && (
                            <MessageScrollerItem>
                              <Message aria-live="polite">
                                <MessageContent className="flex w-fit flex-row items-center gap-2 rounded-xl bg-muted px-4 py-3 bg-primary">
                                  <Bot className="size-4 text-secondary" />
                                  <span className="flex items-center gap-1 text-secondary">
                                    AI is thinking
                                    <LoaderCircle className="size-4 animate-spin text-secondary" />
                                  </span>
                                </MessageContent>
                              </Message>
                            </MessageScrollerItem>
                          )}
                        <ChatMessageView
                          message={message}
                          scrollAnchor={index === messages.length - 1}
                          isStreaming={
                            isSending && index === messages.length - 1
                          }
                        />
                      </Fragment>
                    ))}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton className="bg-primary text-secondary border-secondary hover:bg-secondary hover:text-primary" />
              </MessageScroller>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-2 ">
            <form
              className="w-full bg-primary rounded-2xl"
              onSubmit={handleSubmit}
            >
              <InputGroup
                className="min-h-16 rounded-2xl border-transparent bg-primary focus-within:border-transparent focus-within:ring-0 has-[[data-slot=input-group-control]:focus-visible]:border-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-0"
                style={{ boxShadow: "none", outline: "none" }}
              >
                <InputGroupTextarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a study question..."
                  aria-label="Message"
                  disabled={isSending || isDeleting}
                  className="placeholder:text-secondary text-secondary"
                  style={{ boxShadow: "none", outline: "none" }}
                  rows={2}
                />
                <InputGroupAddon align="block-end" className="pt-1">
                  <InputGroupButton
                    type="submit"
                    variant="default"
                    size="icon-sm"
                    className={`ml-auto`}
                    disabled={!input.trim() || isSending || isDeleting}
                  >
                    <FaArrowUp className="text-secondary" />
                    <span className="sr-only">Send message</span>
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </form>
          </CardFooter>
        </Card>
      </div>
    </MessageScrollerProvider>
  );
}
