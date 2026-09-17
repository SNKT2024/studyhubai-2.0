import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

import "./globals.css";
import { Geist } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/toast";
export const metadata: Metadata = {
  title: "StudyHub AI",
  description: "Web App for students with power of AI",
};

const geist = Geist({ subsets: ["latin"] });

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning className={geist.className}>
        <body className="flex min-h-dvh flex-col bg-background text-foreground transition-colors duration-300">
          <SiteHeader />
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
