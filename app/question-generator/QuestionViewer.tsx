import { Panel } from "@/components/panel";
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
    <Panel>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold">{questionSet.topic}</h2>
          <p className="text-sm opacity-70">
            {questionSet.format} • {questionSet.count} Questions
          </p>
        </div>
        <Button
          onClick={onReset}
          variant="default"
          className="shrink-0 gap-2 text-secondary hover:text-primary hover:bg-secondary hover:border-primary cursor-pointer"
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
              className="border-secondary text-secondary rounded-xl bg-background px-4 data-[state=open]:bg-muted/50"
              disabled={!hasAnswer} // Prevents opening if there is no answer
            >
              <AccordionTrigger
                className={`hover:no-underline ${!hasAnswer ? "cursor-default [&>svg]:hidden" : ""}`}
              >
                <div className="text-left flex flex-col gap-2">
                  <span className="font-medium text-sm ">
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
    </Panel>
  );
}
