"use client";

import { cn } from "@/lib/utils";

import { CHIP_ACTIONS } from "./ai-welcome-screen-chips";
import type { AiIntent } from "@/features/ai";
import type { AiMessage, WorkspaceUrlParams } from "../types";
import { filterContextualActions } from "../constants/ai-copy";

type SuggestedActionsBarProps = {
  onSelect: (prompt: string, intent?: AiIntent) => void;
  disabled?: boolean;
  messages?: AiMessage[];
  workspace?: WorkspaceUrlParams;
  className?: string;
  variant?: "default" | "reference";
};

/** Compact chip row shown below messages when a conversation is active. */
export function SuggestedActionsBar({
  onSelect,
  disabled,
  messages,
  workspace,
  className,
  variant = "default",
}: SuggestedActionsBarProps) {
  const actions = filterContextualActions(CHIP_ACTIONS, {
    workspace,
    messages,
    isStreaming: disabled,
  });

  if (actions.length === 0) return null;

  const isReference = variant === "reference";

  return (
    <div
      className={cn(
        isReference
          ? "sc-suggested-bar"
          : "flex flex-wrap items-center justify-center gap-1.5 px-4 pb-3",
        className
      )}
    >
      {actions.map((chip) => {
        const Icon = chip.icon;
        return (
          <button
            key={chip.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(chip.prompt, chip.intent)}
            className={cn(
              isReference
                ? "sc-suggested-chip"
                : cn(
                    "inline-flex h-[30px] items-center gap-1.5 rounded-full border border-border bg-background px-3.5 text-[11px] font-medium text-foreground/80 transition-all",
                    "hover:-translate-y-px hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700",
                    "disabled:pointer-events-none disabled:opacity-50",
                    "dark:hover:border-violet-800 dark:hover:bg-violet-950/40 dark:hover:text-violet-300"
                  )
            )}
          >
            <Icon className="size-3" />
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
