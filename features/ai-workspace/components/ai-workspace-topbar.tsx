"use client";

import { forwardRef } from "react";
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

export const AiWorkspaceTopbar = forwardRef<HTMLElement, AiWorkspaceTopbarProps>(
  function AiWorkspaceTopbar({ workspace, workspaceLabel, className }, ref) {
  return (
    <header
      ref={ref}
      data-ai-topbar
      className={cn(
        "ai-glass-dark ai-topbar-float pointer-events-auto flex h-[var(--ai-topbar-height,52px)] shrink-0 items-center justify-between px-5",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <AiOrbIcon size="sm" pulse />
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-bold tracking-tight text-foreground">
            {AI_WORKSPACE_COPY.title}
          </h1>
          <p className="truncate text-[11px] text-foreground/55">
            {AI_WORKSPACE_COPY.subtitle}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <WorkspaceContextBadge
          workspace={workspace}
          label={workspaceLabel}
          className="border-black/[0.06] bg-white/60 text-foreground/80 shadow-none [&_svg]:text-[#0057FF]"
        />
        <button
          type="button"
          aria-label="Help"
          className="hidden size-[30px] items-center justify-center rounded-full border border-black/[0.06] bg-white/60 text-foreground/65 transition-colors hover:border-black/[0.12] hover:bg-white/80 hover:text-foreground sm:flex"
        >
          <HelpCircleIcon className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Settings"
          className="hidden size-[30px] items-center justify-center rounded-full border border-black/[0.06] bg-white/60 text-foreground/65 transition-colors hover:border-black/[0.12] hover:bg-white/80 hover:text-foreground sm:flex"
        >
          <SettingsIcon className="size-3.5" />
        </button>
      </div>
    </header>
  );
});
