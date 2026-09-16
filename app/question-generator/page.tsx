import { Sparkles } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { PageTitle } from "@/components/page-title";

import { QuestionGenerator } from "./QuestionGenerator";

export default function QuestionGeneratorPage() {
  return (
    <PageShell maxWidth="5xl">
      <PageTitle
        icon={Sparkles}
        title="Question Generator"
        subtitle="Build a focused practice set in seconds."
      />
      <QuestionGenerator />
    </PageShell>
  );
}
