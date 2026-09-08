"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HiOutlineLightBulb } from "react-icons/hi";
import { MdMenuBook, MdWork } from "react-icons/md";

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

export function ContextSelector() {
  const router = useRouter();
  const topicTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [contextMode, setContextMode] = useState("");
  const [studyTopic, setStudyTopic] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const userId = "123";

  useEffect(() => {
    topicTextareaRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isCreating) return;
    setIsCreating(true);
    try {
      const response = await fetch(
        `/api/study-mode/${userId}/create-new-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            topic: studyTopic,
            contextMode,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Something went wrong while creating the chat");
      }

      const result = await response.json();
      console.log(result);

      router.push(`/study-mode/${result.userId}/${result.chatId}`);
    } catch (error) {
      console.error(error);
      setIsCreating(false);
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

  return (
    <form
      className="mx-auto bg-secondary rounded-3xl  w-full max-w-md px-4 py-5"
      onSubmit={handleSubmit}
    >
      <div className="text-center">
        <h3 className="text-2xl uppercase font-bold">Study Mode</h3>
      </div>
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

      <div className="mt-2 grid w-full grid-cols-3 gap-2">
        {ContextData.map((context) => {
          return (
            <Button
              type="button"
              variant="outline"
              key={context.id}
              className={`flex min-h-40 w-full flex-col items-center bg-primary justify-start rounded-lg border-secondary hover:border-primary  px-1.5 py-3 text-center text-secondary whitespace-normal cursor-pointer  hover:bg-secondary ${contextMode === context.value ? "text-primary bg-secondary border-primary" : ""}`}
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
  );
}
