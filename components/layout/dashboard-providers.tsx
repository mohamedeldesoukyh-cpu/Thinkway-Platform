"use client";

import { useState } from "react";

import { KeyboardHelpDialog } from "@/components/help/keyboard-help-dialog";
import { ConfirmActionProvider } from "@/components/shared/confirm-action-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KeyboardShortcutsProvider } from "@/lib/productivity/keyboard-shortcuts";

type DashboardProvidersProps = {
  children: React.ReactNode;
};

export function DashboardProviders({ children }: DashboardProvidersProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <TooltipProvider>
      <ConfirmActionProvider>
        <KeyboardShortcutsProvider helpOpen={helpOpen} onHelpOpenChange={setHelpOpen}>
          {children}
          <KeyboardHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
        </KeyboardShortcutsProvider>
      </ConfirmActionProvider>
    </TooltipProvider>
  );
}
