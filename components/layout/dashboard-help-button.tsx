"use client";

import { HelpMenuButton } from "@/components/help/keyboard-help-dialog";
import { useKeyboardShortcuts } from "@/lib/productivity/keyboard-shortcuts";

export function DashboardHelpButton() {
  const { openHelp } = useKeyboardShortcuts();
  return <HelpMenuButton onClick={openHelp} />;
}
