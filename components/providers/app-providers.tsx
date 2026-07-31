"use client";

import { PwaProvider } from "@/components/pwa/pwa-provider";
import { Toaster } from "@/components/ui/sonner";

import { ThemeProvider } from "./theme-provider";

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <PwaProvider>
        {/* Flex column fills body under the root layout height lock. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
        <Toaster richColors closeButton position="top-right" />
      </PwaProvider>
    </ThemeProvider>
  );
}
