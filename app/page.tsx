import QuestionGenerator from "./question-generator/page";
import StudyMode from "./study-mode/page";

export default function Home() {
  return (
    <div className="min-h-screen w-full max-w-7xl bg-background text-foreground   transition-colors duration-300 mx-auto px-4 md:px-8">
      <main className="">
        <StudyMode />
      </main>
    </div>
  );
}
