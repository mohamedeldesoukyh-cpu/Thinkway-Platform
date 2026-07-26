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
        {children}
        <Toaster richColors closeButton position="top-right" />
      </PwaProvider>
    </ThemeProvider>
  );
}
