import { PageShell } from "@/components/page-shell";

import { ChatWindow } from "../ChatWindow";

export default function Chat() {
  return (
    <PageShell maxWidth="3xl" fill>
      <ChatWindow />
    </PageShell>
  );
}
