import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Outbound Personalization — Vercel SDR",
  description: "AI-powered outbound email personalization pipeline for Vercel SDR teams.",
};

import { Triangle, Home, Inbox, BarChart, Settings } from "lucide-react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full flex bg-background text-foreground overflow-hidden">
        <TooltipProvider>
          {/* Rail: quieter than main content; zinc not pure white */}
          <aside
            className="w-16 border-r border-border bg-muted/60 flex flex-col items-center py-4 gap-8 shrink-0 z-50"
            aria-label="App"
          >
            <div className="w-8 h-8 bg-foreground text-background flex items-center justify-center rounded-md shrink-0 shadow-sm" aria-hidden>
              <Triangle size={16} fill="currentColor" />
            </div>
            <nav className="flex flex-col gap-6 w-full items-center text-muted-foreground" aria-label="Primary">
              <span className="opacity-40" title="Not in prototype">
                <Home size={20} aria-hidden />
              </span>
              <span className="text-foreground" title="Review queue" aria-current="page">
                <Inbox size={20} aria-hidden />
              </span>
              <span className="opacity-40" title="Not in prototype">
                <BarChart size={20} aria-hidden />
              </span>
              <span className="opacity-40 mt-auto" title="Not in prototype">
                <Settings size={20} aria-hidden />
              </span>
            </nav>
          </aside>
          
          <main className="flex-1 flex flex-col min-w-0 bg-background">
            {children}
          </main>
        </TooltipProvider>
      </body>
    </html>
  );
}
