import { PreviousQuestions } from "./PreviousQuestions";
import { GET as getPreviousQuestions } from "../api/question-generator/route";
import { GeneratorQuestion } from "./GeneratorQuestion";

export default async function QuestionGenerator() {
  const response = await getPreviousQuestions();
  const { questions } = await response.json();

  return (
    <div className="flex flex-row gap-3 justify-center mt-4">
      <PreviousQuestions previousQuestions={questions} />
      <GeneratorQuestion />
    </div>
  );
}
