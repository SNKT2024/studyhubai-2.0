"use client";

import { useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const QuestionFormat = ["MCQ", "SENTENCE_BASED", "INTERVIEW_BASED"];

export function GeneratorQuestion() {
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState("MCQ");
  const [experience, setExperience] = useState("FRESHER_0_1");
  const [count, setCount] = useState("5");
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [questions, setQuestions] = useState<
    { question_id: string; question: string; answer: string | null }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/question-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          question_format: format,
          experience,
          count: Number(count),
          includeAnswers,
        }),
      });

      if (!response.ok) throw new Error("Unable to generate questions.");

      const result = await response.json();
      setQuestions(result.questions ?? []);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to generate questions.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-secondary/30 bg-secondary p-5 text-secondary-foreground shadow-xl shadow-black/10 sm:p-7">
      <div className="mb-6 flex items-start gap-3">
        <div className="rounded-xl bg-primary p-2.5 text-secondary">
          <Sparkles className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-wide">
            Question Generator
          </h1>
          <p className="mt-1 text-sm text-secondary-foreground/70">
            Build a focused practice set in seconds.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="study-topic">Study topic</FieldLabel>
            <Input
              id="study-topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="e.g. React state management"
              required
            />
          </Field>

          <Field>
            <FieldLabel>Question format</FieldLabel>
            <RadioGroup
              value={format}
              onValueChange={setFormat}
              className="grid gap-2 sm:grid-cols-3"
            >
              {QuestionFormat.map((questionFormat) => (
                <FieldLabel
                  htmlFor={questionFormat}
                  key={questionFormat}
                  className="cursor-pointer"
                >
                  <Field
                    orientation="horizontal"
                    className="h-full rounded-lg border border-secondary-foreground/15 px-3 py-2.5 transition-colors hover:bg-secondary-foreground/10"
                  >
                    <FieldTitle className="uppercase">
                      {questionFormat.replaceAll("_", " ").toLowerCase()}
                    </FieldTitle>
                    <RadioGroupItem
                      value={questionFormat}
                      id={questionFormat}
                    />
                  </Field>
                </FieldLabel>
              ))}
            </RadioGroup>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="experience">Experience level</FieldLabel>
              <select
                id="experience"
                value={experience}
                onChange={(event) => setExperience(event.target.value)}
                className="h-9 rounded-lg border border-secondary-foreground/20 bg-secondary px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-primary/30"
              >
                <option value="FRESHER_0_1">Beginner</option>
                <option value="EXPERIENCED_3_PLUS">Experienced</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="question-count">
                Number of questions
              </FieldLabel>
              <Input
                id="question-count"
                type="number"
                min="1"
                max="10"
                value={count}
                onChange={(event) => setCount(event.target.value)}
                required
              />
            </Field>
          </div>

          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={includeAnswers}
              onChange={(event) => setIncludeAnswers(event.target.checked)}
              className="size-4 accent-primary"
            />
            Include answers
          </label>
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
          {isLoading ? "Generating..." : "Generate questions"}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>

      {questions.length > 0 && (
        <section
          className="mt-8 border-t border-secondary-foreground/15 pt-6"
          aria-live="polite"
        >
          <h2 className="mb-3 font-semibold">Your practice set</h2>
          <ol className="space-y-3">
            {questions.map((question, index) => (
              <li
                key={question.question_id}
                className="rounded-xl bg-secondary-foreground/10 p-4 text-sm"
              >
                <p>
                  <span className="mr-2 font-semibold">{index + 1}.</span>
                  {question.question}
                </p>
                {includeAnswers && question.answer && (
                  <p className="mt-2 text-xs font-medium opacity-70">
                    Answer: {question.answer}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
