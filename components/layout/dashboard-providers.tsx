"use client";

import { useState } from "react";

import { KeyboardHelpDialog } from "@/components/help/keyboard-help-dialog";
import { KeyboardShortcutsProvider } from "@/lib/productivity/keyboard-shortcuts";

type DashboardProvidersProps = {
  children: React.ReactNode;
};

export function DashboardProviders({ children }: DashboardProvidersProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <KeyboardShortcutsProvider helpOpen={helpOpen} onHelpOpenChange={setHelpOpen}>
      <div className="relative min-h-screen">
        {children}
        <KeyboardHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      </div>
    </KeyboardShortcutsProvider>
  );
}
