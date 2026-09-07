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
import { Bot, LoaderCircle } from "lucide-react";
import { FaArrowUp } from "react-icons/fa";
import { useParams } from "next/navigation";
import { Fragment, memo, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

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
            <ReactMarkdown components={markdownComponents}>
              {message.content}
            </ReactMarkdown>
          )}
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  );
});

export function ChatWindow() {
  const { userId, chatId } = useParams<{ userId: string; chatId: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastMessageLength = messages.at(-1)?.content.length ?? 0;

  useEffect(() => {
    if (!userId || !chatId) return;

    async function getChat() {
      const response = await fetch(`/api/study-mode/${userId}/${chatId}`);
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
  }, [userId, chatId]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (viewport)
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "auto" });
    });

    return () => cancelAnimationFrame(frame);
  }, [lastMessageLength, isSending]);

  useEffect(() => {
    if (!isLoading && !isSending) {
      textareaRef.current?.focus();
    }
  }, [isLoading, isSending]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = input.trim();
    if (!content || !userId || !chatId || isSending) return;

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
      const response = await fetch(`/api/study-mode/${userId}/${chatId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, role: "user" }),
      });

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
    } catch (error) {
      console.error("Something went wrong while sending the message:", error);
      setMessages((currentMessages) =>
        currentMessages.filter(
          (message) =>
            message.id !== optimisticMessage.id &&
            message.id !== assistantMessageId,
        ),
      );
      setInput(content);
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
      <div className="flex min-h-[min(80vh,52rem)] w-full items-center justify-center rounded-xl border-primary bg-secondary">
        <div
          className="flex items-center gap-3 text-muted-foreground"
          role="status"
        >
          <LoaderCircle className="size-5 animate-spin" />
          <span>Loading your study chat...</span>
        </div>
      </div>
    );
  }

  if (loadError || !chat) {
    return (
      <div className="flex min-h-[min(80vh,52rem)] w-full items-center justify-center rounded-xl border bg-card px-6 text-center text-muted-foreground">
        {loadError ?? "This chat could not be found."}
      </div>
    );
  }

  return (
    <MessageScrollerProvider>
      <div className="flex w-150 flex-col gap-4">
        <Card className="h-[min(80vh,52rem)] bg-secondary">
          <CardHeader className="items-center">
            <CardTitle className="bg-primary font-normal rounded-lg border-primary w-fit px-3 py-1 text-secondary">
              {chat.title}
            </CardTitle>
            <CardAction className="bg-primary font-normal rounded-lg border-primary w-fit px-3 py-1 text-secondary">
              {chat.contextMode}
            </CardAction>
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
                                <MessageContent className="flex w-fit flex-row items-center gap-2 rounded-xl bg-muted px-4 py-3 text-muted-foreground">
                                  <Bot className="size-4" />
                                  <span className="flex items-center gap-1">
                                    AI is thinking
                                    <LoaderCircle className="size-4 animate-spin" />
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
                  disabled={isSending}
                  className="placeholder:text-secondary text-secondary focus-visible:!border-transparent focus-visible:!ring-0"
                  style={{ boxShadow: "none", outline: "none" }}
                  rows={2}
                />
                <InputGroupAddon align="block-end" className="pt-1">
                  <InputGroupButton
                    type="submit"
                    variant="default"
                    size="icon-sm"
                    className={`ml-auto`}
                    disabled={!input.trim() || isSending}
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
