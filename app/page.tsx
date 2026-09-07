import StudyMode from "./study-mode/page";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground font-mono transition-colors duration-300 mx-auto">
      <main className="w-fit mx-auto">
        <StudyMode />
      </main>
    </div>
  );
}
