import type { Metadata } from "next";

import "./globals.css";
import { Geist } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
export const metadata: Metadata = {
  title: "StudyHub AI",
  description: "Web App for students with power of AI",
};

const geist = Geist({ subsets: ["latin"] });

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={geist.className}>
      <body className="min-h-full flex flex-col">{children}</body>
      <Toaster />;
    </html>
  );
}
