"use client";

import { cn } from "@/lib/utils";
import { STUDIO_CLASSES } from "@/features/campaign-studio/constants/studio-tokens";

export type StudioWorkspaceMode = "presentation" | "decision";

type StudioModeToggleProps = {
  mode: StudioWorkspaceMode;
  onModeChange: (mode: StudioWorkspaceMode) => void;
  disabled?: boolean;
  decisionDisabled?: boolean;
  className?: string;
};

export function StudioModeToggle({
  mode,
  onModeChange,
  disabled,
  decisionDisabled,
  className,
}: StudioModeToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex gap-0.5 rounded-[11px] bg-[#EEF1F8] p-[3px] dark:bg-muted/50",
        className
      )}
      role="tablist"
      aria-label="Campaign Studio mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "presentation"}
        disabled={disabled}
        onClick={() => onModeChange("presentation")}
        className={cn(
          "rounded-[9px] px-3.5 py-1.5 text-xs font-bold transition-colors",
          STUDIO_CLASSES.focusRingInset,
          mode === "presentation"
            ? "bg-white text-foreground shadow-[0_1px_2px_rgba(6,8,16,0.05)] dark:bg-background"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Presentation
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "decision"}
        disabled={disabled || decisionDisabled}
        title={decisionDisabled ? "Available when the studio workflow completes" : undefined}
        onClick={() => onModeChange("decision")}
        className={cn(
          "rounded-[9px] px-3.5 py-1.5 text-xs font-bold transition-colors",
          STUDIO_CLASSES.focusRingInset,
          mode === "decision"
            ? "bg-white text-[#0057FF] shadow-[0_1px_2px_rgba(6,8,16,0.05)] dark:bg-background"
            : "text-muted-foreground hover:text-foreground",
          (disabled || decisionDisabled) && "cursor-not-allowed opacity-50"
        )}
      >
        Decision Mode
      </button>
    </div>
  );
}
