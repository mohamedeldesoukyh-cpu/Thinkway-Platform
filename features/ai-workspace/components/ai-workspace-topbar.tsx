"use client";

import { HelpCircleIcon, SettingsIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { AI_WORKSPACE_COPY } from "../constants/ai-copy";
import { WorkspaceContextBadge } from "./workspace-context-badge";
import { AiOrbIcon } from "./ai-orb-icon";
import type { WorkspaceUrlParams } from "../types";

type AiWorkspaceTopbarProps = {
  workspace?: WorkspaceUrlParams;
  workspaceLabel?: string;
  className?: string;
};

export function AiWorkspaceTopbar({
  workspace,
  workspaceLabel,
  className,
}: AiWorkspaceTopbarProps) {
  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-5",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <AiOrbIcon size="sm" pulse />
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-bold tracking-tight text-foreground">
            {AI_WORKSPACE_COPY.title}
          </h1>
          <p className="truncate text-[11px] text-muted-foreground">
            {AI_WORKSPACE_COPY.subtitle}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <WorkspaceContextBadge workspace={workspace} label={workspaceLabel} />
        <button
          type="button"
          aria-label="Help"
          className="hidden size-[30px] items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-[#0057FF]/30 hover:text-[#0057FF] sm:flex"
        >
          <HelpCircleIcon className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Settings"
          className="hidden size-[30px] items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-[#0057FF]/30 hover:text-[#0057FF] sm:flex"
        >
          <SettingsIcon className="size-3.5" />
        </button>
      </div>
    </header>
  );
}
