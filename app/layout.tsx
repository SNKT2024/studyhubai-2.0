import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

import "./globals.css";
import { Geist } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/toast";
export const metadata: Metadata = {
  // Resolves relative URLs in openGraph/images. Without it Next warns and falls back to localhost.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: {
    default: "StudyHub AI",
    template: "%s | StudyHub AI",
  },
  description: "Web App for students with power of AI",
  applicationName: "StudyHub AI",
  openGraph: {
    type: "website",
    siteName: "StudyHub AI",
    title: "StudyHub AI",
    description:
      "Study chat, flashcards, quizzes and question sets — generated for you, powered by AI.",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "StudyHub AI" }],
  },
  twitter: {
    card: "summary",
    title: "StudyHub AI",
    description:
      "Study chat, flashcards, quizzes and question sets — generated for you, powered by AI.",
    images: ["/logo.png"],
  },
  icons: { icon: "/favicon.ico" },
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
