"use client";

import { useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";

import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { QuestionSet } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const QuestionFormat = ["MCQ", "SENTENCE_BASED", "INTERVIEW_BASED"];
const experienceOptions = [
  { value: "FRESHER_0_1", label: "Beginner" },
  { value: "EXPERIENCED_3_PLUS", label: "Experienced" },
];

export function GeneratorQuestion({
  onSuccess,
}: {
  onSuccess: (questionSet: Omit<QuestionSet, "id">) => void;
}) {
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState("MCQ");
  const [experience, setExperience] = useState("FRESHER_0_1");
  const [count, setCount] = useState("5");
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [questions, setQuestions] = useState<
    { question_id: number; question: string; answer: string | null }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const trimmedTopic = topic.trim();
    const questionCount = Number(count);
    if (!trimmedTopic) {
      setError("Enter a study topic.");
      return;
    }

    if (
      !Number.isInteger(questionCount) ||
      questionCount < 1 ||
      questionCount > 10
    ) {
      setError("Choose between 1 and 10 questions.");
      return;
    }

    setQuestions([]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/question-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: trimmedTopic,
          question_format: format,
          experience,
          count: questionCount,
          includeAnswers,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message ?? "Unable to generate questions.");
      }

      if (!Array.isArray(result.questions)) {
        throw new Error("The generated response was invalid.");
      }

      setQuestions(result.questions);
      onSuccess({
        topic: trimmedTopic,
        format,
        experienceLevel: experience,
        count: questionCount,
        questions: result.questions,
      });
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
    <Panel>
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
              className="border-primary placeholder:text-primary"
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
                  className="cursor-pointer border-primary text-primary has-data-checked:border-primary has-data-checked:bg-primary has-data-checked:text-secondary"
                >
                  <Field
                    orientation="horizontal"
                    className="h-full rounded-md px-3 py-2.5 transition-colors hover:bg-primary hover:text-secondary"
                  >
                    <FieldTitle className="uppercase">
                      {questionFormat.replaceAll("_", " ").toLowerCase()}
                    </FieldTitle>
                    <RadioGroupItem
                      value={questionFormat}
                      id={questionFormat}
                      className="border-primary bg-secondary text-secondary data-checked:border-secondary data-checked:bg-secondary [&>span>span]:bg-primary"
                    />
                  </Field>
                </FieldLabel>
              ))}
            </RadioGroup>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="experience">Experience level</FieldLabel>

              <Select
                value={experience}
                onValueChange={(value) => setExperience(value ?? "")}
              >
                <SelectTrigger
                  id="experience"
                  className="w-full border-primary"
                >
                  <SelectValue placeholder="Select experience" />
                </SelectTrigger>

                <SelectContent className="bg-primary text-secondary">
                  <SelectGroup>
                    <SelectLabel className="text-secondary">
                      Experience
                    </SelectLabel>
                    {experienceOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="mb-1 cursor-pointer border border-secondary hover:bg-secondary hover:text-primary"
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="question-count">
                Number of questions
              </FieldLabel>

              <Input
                id="question-count"
                type="number"
                min={1}
                className="border-primary"
                max={10}
                aria-describedby="question-count-help"
                value={count}
                onChange={(event) => setCount(event.target.value)}
                required
              />
              <p
                id="question-count-help"
                className="text-xs text-secondary-foreground/60"
              >
                Choose 1 to 10 questions.
              </p>
            </Field>
          </div>

          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <Input
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
    </Panel>
  );
}
