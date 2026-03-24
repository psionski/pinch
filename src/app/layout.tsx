import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { getSettingsService } from "@/lib/api/services";
import { TimezoneInit } from "@/components/timezone-init";
import { InteractiveTour } from "@/components/tour/interactive-tour";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pinch",
  description: "AI-powered personal finance tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settingsService = getSettingsService();
  const timezone = settingsService.getTimezone() ?? "UTC";
  const tutorial = settingsService.get("tutorial") === "true";

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <TimezoneInit timezone={timezone} />
        <InteractiveTour initialTutorial={tutorial} />
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <header className="flex h-14 items-center gap-2 border-b px-4">
                <SidebarTrigger />
              </header>
              <div className="flex-1 p-4 md:p-6">{children}</div>
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
