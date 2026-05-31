"use client";

import { Toaster } from "@/components/ui/sonner";

import { ThemeProvider } from "./theme-provider";

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider>
      {children}
      <Toaster richColors closeButton position="top-right" />
    </ThemeProvider>
  );
}
