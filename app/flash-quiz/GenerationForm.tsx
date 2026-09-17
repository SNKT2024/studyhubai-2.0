"use client";

import { FileText, LoaderCircle, Sparkles, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/components/ui/toast";
import { notifyCreditsChanged } from "@/lib/credits-client";
import type { FlashcardDeck, Quiz } from "@/lib/types";

import type { FlashQuizMode } from "./FlashQuizStudio";

const modeOptions: { value: FlashQuizMode; label: string; blurb: string }[] = [
  {
    value: "flashcards",
    label: "Flashcards",
    blurb: "Front and back cards with a hint, for active recall.",
  },
  {
    value: "quiz",
    label: "Quiz",
    blurb: "Four-option questions that are graded as you go.",
  },
];

/** Mirrors the `SourceType` enum, kept as a literal so this stays a plain UI file. */
type SourceKind = "TOPIC" | "PDF";

/** Shape returned by /api/flash-quiz-mode/extract. */
type ExtractedPdf = {
  fileName: string;
  totalPages: number;
  characters: number;
  text: string;
  truncated: boolean;
};

export function GenerationForm({
  mode,
  onModeChange,
  onDeckGenerated,
  onQuizGenerated,
}: {
  mode: FlashQuizMode;
  onModeChange: (mode: FlashQuizMode) => void;
  onDeckGenerated: (deck: FlashcardDeck) => void;
  onQuizGenerated: (quiz: Quiz) => void;
}) {
  const [topic, setTopic] = useState("");
  const [source, setSource] = useState<SourceKind>("TOPIC");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<null | "extracting" | "generating">(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = stage !== null;

  async function extractPdf(selected: File): Promise<ExtractedPdf> {
    const body = new FormData();
    body.append("file", selected);

    const response = await fetch("/api/flash-quiz-mode/extract", {
      method: "POST",
      body,
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.text) {
      throw new Error(result?.message ?? "Couldn't read that PDF.");
    }

    return result as ExtractedPdf;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const isPdf = source === "PDF";
    let inputText = topic.trim();
    let sourceName: string | null = null;

    if (isPdf) {
      if (!file) {
        setError("Choose a PDF to upload.");
        return;
      }
    } else if (!inputText) {
      setError("Enter a study topic.");
      return;
    }

    try {
      if (isPdf && file) {
        setStage("extracting");

        const extracted = await extractPdf(file);
        inputText = extracted.text;
        sourceName = extracted.fileName;

        if (extracted.truncated) {
          toast.add({
            title: "Long PDF trimmed",
            description: `Only the first ${extracted.characters.toLocaleString()} characters were used.`,
            type: "info",
          });
        }
      }

      setStage("generating");

      const response = await fetch("/api/flash-quiz-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          topic: inputText,
          sourceType: isPdf ? "PDF" : "TOPIC",
          sourceName,
        }),
      });

      const result = await response.json().catch(() => null);

      // The balance changed either way, so let the header badge re-read it.
      notifyCreditsChanged();

      if (!response.ok) {
        throw new Error(result?.message ?? "Unable to generate right now.");
      }

      if (mode === "flashcards") {
        if (!result?.deck) {
          throw new Error("The generated deck was invalid.");
        }

        onDeckGenerated(result.deck as FlashcardDeck);
        toast.add({
          title: "Deck ready",
          description: `${result.deck.cards?.length ?? 0} flashcards created.`,
          type: "success",
        });
      } else {
        if (!result?.quiz) {
          throw new Error("The generated quiz was invalid.");
        }

        onQuizGenerated(result.quiz as Quiz);
        toast.add({
          title: "Quiz ready",
          description: `${result.quiz.questions?.length ?? 0} questions created.`,
          type: "success",
        });
      }

      setTopic("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (submissionError) {
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to generate right now.";

      setError(message);
      toast.add({
        title: "Generation failed",
        description: message,
        type: "error",
      });
    } finally {
      setStage(null);
    }
  }

  const submitLabel =
    stage === "extracting"
      ? "Reading PDF..."
      : stage === "generating"
        ? "Generating..."
        : mode === "flashcards"
          ? "Generate flashcards"
          : "Generate quiz";

  return (
    <Panel>
      <form onSubmit={handleSubmit} className="space-y-6">
        <FieldGroup>
          <Field>
            <FieldLabel>What do you want to make?</FieldLabel>
            <RadioGroup
              value={mode}
              onValueChange={(value) => onModeChange(value as FlashQuizMode)}
              className="grid gap-2 sm:grid-cols-2"
            >
              {modeOptions.map((option) => (
                <FieldLabel
                  htmlFor={option.value}
                  key={option.value}
                  className="cursor-pointer border-primary text-primary has-data-checked:border-primary has-data-checked:bg-primary has-data-checked:text-secondary"
                >
                  <Field
                    orientation="horizontal"
                    className="h-full rounded-md px-3 py-2.5 transition-colors hover:bg-primary hover:text-secondary"
                  >
                    <div className="flex flex-col gap-1">
                      <FieldTitle>{option.label}</FieldTitle>
                      <span className="text-xs font-normal opacity-70">
                        {option.blurb}
                      </span>
                    </div>
                    <RadioGroupItem
                      value={option.value}
                      id={option.value}
                      className="border-primary bg-secondary text-secondary data-checked:border-secondary data-checked:bg-secondary [&>span>span]:bg-primary"
                    />
                  </Field>
                </FieldLabel>
              ))}
            </RadioGroup>
          </Field>

          <Field>
            <FieldLabel>Source</FieldLabel>
            <RadioGroup
              value={source}
              onValueChange={(value) => {
                setSource(value as SourceKind);
                setError("");
              }}
              className="grid gap-2 sm:grid-cols-2"
            >
              {(
                [
                  { value: "TOPIC", label: "Topic", blurb: "Type a subject." },
                  {
                    value: "PDF",
                    label: "PDF",
                    blurb: "Upload notes or a chapter.",
                  },
                ] as const
              ).map((option) => (
                <FieldLabel
                  htmlFor={`source-${option.value}`}
                  key={option.value}
                  className="cursor-pointer border-primary text-primary has-data-checked:border-primary has-data-checked:bg-primary has-data-checked:text-secondary"
                >
                  <Field
                    orientation="horizontal"
                    className="h-full rounded-md px-3 py-2.5 transition-colors hover:bg-primary hover:text-secondary"
                  >
                    <div className="flex flex-col gap-1">
                      <FieldTitle>{option.label}</FieldTitle>
                      <span className="text-xs font-normal opacity-70">
                        {option.blurb}
                      </span>
                    </div>
                    <RadioGroupItem
                      value={option.value}
                      id={`source-${option.value}`}
                      className="border-primary bg-secondary text-secondary data-checked:border-secondary data-checked:bg-secondary [&>span>span]:bg-primary"
                    />
                  </Field>
                </FieldLabel>
              ))}
            </RadioGroup>
          </Field>

          {source === "TOPIC" ? (
            <Field>
              <FieldLabel htmlFor="flash-quiz-topic">Study topic</FieldLabel>
              <Input
                id="flash-quiz-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="e.g. Arrays in C++"
                className="border-primary placeholder:text-primary"
              />
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor="flash-quiz-pdf">PDF file</FieldLabel>

              <input
                id="flash-quiz-pdf"
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setError("");
                }}
              />

              {file ? (
                <div className="flex items-center gap-3 rounded-lg border border-primary bg-primary/5 px-3 py-2.5">
                  <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {file.name}
                  </span>
                  <span className="shrink-0 text-xs opacity-60">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <button
                    type="button"
                    aria-label="Remove the selected PDF"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="shrink-0 cursor-pointer rounded-md p-1 text-primary transition-colors hover:bg-primary hover:text-secondary"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-primary px-4 py-6 text-sm text-primary transition-colors hover:bg-primary hover:text-secondary"
                >
                  <Upload className="size-5" aria-hidden="true" />
                  Choose a PDF (max 10 MB)
                </button>
              )}

              <p className="text-xs text-secondary-foreground/60">
                The text is read on the server and used as the source material.
              </p>
            </Field>
          )}
        </FieldGroup>

        <Button
          type="submit"
          size="lg"
          className="w-full text-secondary"
          disabled={isLoading}
        >
          {isLoading ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles aria-hidden="true" />
          )}
          {submitLabel}
        </Button>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
    </Panel>
  );
}
