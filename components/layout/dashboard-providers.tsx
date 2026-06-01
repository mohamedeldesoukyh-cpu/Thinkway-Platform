"use client";

import { useState } from "react";

import { HelpMenuButton, KeyboardHelpDialog } from "@/components/help/keyboard-help-dialog";
import { KeyboardShortcutsProvider } from "@/lib/productivity/keyboard-shortcuts";

type DashboardProvidersProps = {
  children: React.ReactNode;
};

export function DashboardProviders({ children }: DashboardProvidersProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <KeyboardShortcutsProvider helpOpen={helpOpen} onHelpOpenChange={setHelpOpen}>
      <div className="relative min-h-screen">
        <div className="pointer-events-none fixed top-3 right-3 z-50 md:right-8">
          <div className="pointer-events-auto">
            <HelpMenuButton onClick={() => setHelpOpen(true)} />
          </div>
        </div>
        {children}
        <KeyboardHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      </div>
    </KeyboardShortcutsProvider>
  );
}
