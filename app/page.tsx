import { GraduationCap } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { PageTitle } from "@/components/page-title";

import { ContextSelector } from "./study-mode/ContextSelector";

export default function Home() {
  return (
    <PageShell maxWidth="4xl">
      <PageTitle
        icon={GraduationCap}
        title="Study Mode"
        subtitle="Pick a topic and a context mode, then start a session."
      />
      <ContextSelector />
    </PageShell>
  );
}
