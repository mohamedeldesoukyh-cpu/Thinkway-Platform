"use client";

import { cn } from "@/lib/utils";

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
        "inline-flex rounded-lg border border-border/60 bg-muted/30 p-0.5",
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
          "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          mode === "presentation"
            ? "bg-background text-foreground shadow-sm"
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
          "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          mode === "decision"
            ? "bg-[#1D9E75]/10 text-[#1D9E75] shadow-sm"
            : "text-muted-foreground hover:text-foreground",
          (disabled || decisionDisabled) && "cursor-not-allowed opacity-50"
        )}
      >
        Decision Mode
      </button>
    </div>
  );
}
