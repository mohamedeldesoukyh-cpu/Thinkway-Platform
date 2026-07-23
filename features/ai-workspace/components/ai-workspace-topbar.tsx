"use client";

import { forwardRef } from "react";
import { HelpCircleIcon, SettingsIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { AI_WORKSPACE_COPY } from "../constants/ai-copy";
import { STUDIO_CHAT_CLASSES } from "../constants/studio-chat-tokens";
import { WorkspaceContextBadge } from "./workspace-context-badge";
import type { WorkspaceUrlParams } from "../types";

function IntelligenceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.4 1 1.2 1 2.3h6c0-1.1.4-1.9 1-2.3A7 7 0 0 0 12 2z" />
    </svg>
  );
}

type AiWorkspaceTopbarProps = {
  workspace?: WorkspaceUrlParams;
  workspaceLabel?: string;
  className?: string;
};

export const AiWorkspaceTopbar = forwardRef<HTMLElement, AiWorkspaceTopbarProps>(
  function AiWorkspaceTopbar({ workspace, workspaceLabel, className }, ref) {
    return (
      <header ref={ref} data-ai-topbar className={cn(STUDIO_CHAT_CLASSES.chatHead, className)}>
        <div className="sc-chat-head-left">
          <div className="sc-chat-ico">
            <IntelligenceIcon />
          </div>
          <div className="min-w-0">
            <h1>{AI_WORKSPACE_COPY.title}</h1>
            <p>{AI_WORKSPACE_COPY.subtitle}</p>
          </div>
        </div>

        <div className="sc-chat-head-actions">
          {workspaceLabel ? (
            <WorkspaceContextBadge
              workspace={workspace}
              label={workspaceLabel}
              className="sc-context-badge max-sm:hidden [&_svg]:text-[#0057FF]"
            />
          ) : null}
          <button type="button" aria-label="Help" className={STUDIO_CHAT_CLASSES.iconBtn}>
            <HelpCircleIcon strokeWidth={2} />
          </button>
          <button type="button" aria-label="Settings" className={STUDIO_CHAT_CLASSES.iconBtn}>
            <SettingsIcon strokeWidth={2} />
          </button>
        </div>
      </header>
    );
  }
);
