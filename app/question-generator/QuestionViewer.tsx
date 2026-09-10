import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import type { QuestionSet } from "@/lib/types";
import { Plus } from "lucide-react";

export function QuestionViewer({
  questionSet,
  onReset,
}: {
  questionSet: QuestionSet;
  onReset: () => void;
}) {
  return (
    <div className="w-full max-w-2xl rounded-2xl border border-secondary bg-secondary p-5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">{questionSet.topic}</h2>
          <p className="text-sm opacity-70">
            {questionSet.format} • {questionSet.count} Questions
          </p>
        </div>
        <Button
          onClick={onReset}
          variant="default"
          className="gap-2 text-secondary hover:text-primary hover:bg-secondary hover:border-primary cursor-pointer"
        >
          <Plus className="size-4" /> Create New Set
        </Button>
      </div>
      <Accordion className="w-full space-y-3">
        {questionSet.questions.map((q, index) => {
          const hasAnswer = Boolean(q.answer);

          return (
            <AccordionItem
              key={q.question_id || index}
              value={`item-${index}`}
              className="border rounded-xl bg-background px-4 data-[state=open]:bg-muted/50 text-secondary"
              disabled={!hasAnswer} // Prevents opening if there is no answer
            >
              <AccordionTrigger
                className={`hover:no-underline ${!hasAnswer ? "cursor-default [&>svg]:hidden" : ""}`}
              >
                <div className="text-left flex flex-col gap-2">
                  <span className="font-medium text-sm">
                    {index + 1}. {q.question}
                  </span>

                  {/* Conditional MCQ Options Display */}
                  {questionSet.format === "MCQ" && q.options && (
                    <ul className="pl-4 space-y-1 mt-2 list-disc list-inside font-normal text-sm  text-secondary">
                      {Object.entries(q.options).map(([key, option]) => (
                        <li key={key}>{option}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </AccordionTrigger>

              {hasAnswer && (
                <AccordionContent className="pt-2 pb-4 text-sm text-secondary">
                  <span className="font-semibold mr-2">Answer:</span>
                  {q.answer}
                </AccordionContent>
              )}
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
