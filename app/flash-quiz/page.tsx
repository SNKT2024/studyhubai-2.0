import { Layers } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { PageTitle } from "@/components/page-title";

import { FlashQuizStudio } from "./FlashQuizStudio";

export default function FlashQuizPage() {
  return (
    <PageShell maxWidth="5xl">
      <PageTitle
        icon={Layers}
        title="Flashcards & Quiz"
        subtitle="Generate a deck, then study it until it sticks."
      />
      <FlashQuizStudio />
    </PageShell>
  );
}
