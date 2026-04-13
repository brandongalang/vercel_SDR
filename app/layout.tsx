import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Triangle, Home, Inbox, BarChart, Settings } from "lucide-react";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-dvh flex flex-col bg-background text-foreground md:h-dvh md:flex-row md:overflow-hidden">
        <TooltipProvider>
          {/* Rail: left on md+; bottom tab bar on small screens (keeps main width usable) */}
          <aside
            className="fixed bottom-0 left-0 right-0 z-50 flex h-[3.5rem] items-center justify-around border-t border-border bg-muted/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md supports-[backdrop-filter]:bg-muted/80 md:static md:h-auto md:w-16 md:shrink-0 md:flex-col md:justify-start md:gap-8 md:border-r md:border-t-0 md:bg-muted/60 md:py-4 md:pb-4 md:backdrop-blur-none"
            aria-label="App"
          >
            <div className="hidden md:flex w-8 h-8 bg-foreground text-background items-center justify-center rounded-md shrink-0 shadow-sm" aria-hidden>
              <Triangle size={16} fill="currentColor" />
            </div>
            <nav className="flex w-full flex-row items-center justify-around gap-0 text-muted-foreground md:w-full md:flex-col md:justify-start md:gap-6" aria-label="Primary">
              <span className="opacity-40 max-md:px-3 max-md:py-1" title="Not in prototype">
                <Home size={20} aria-hidden />
              </span>
              <span className="text-foreground max-md:px-3 max-md:py-1" title="Review queue" aria-current="page">
                <Inbox size={20} aria-hidden />
              </span>
              <span className="opacity-40 max-md:px-3 max-md:py-1" title="Not in prototype">
                <BarChart size={20} aria-hidden />
              </span>
              <span className="opacity-40 max-md:px-3 max-md:py-1 md:mt-auto" title="Not in prototype">
                <Settings size={20} aria-hidden />
              </span>
            </nav>
          </aside>

          <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </main>
        </TooltipProvider>
      </body>
    </html>
  );
}
