"use client";

import { ListIcon, ZapIcon } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { CampaignStudioLayoutMode } from "../types/campaign-studio";

import { CAMPAIGN_STUDIO_COPY } from "../constants/copy";
import { STUDIO_CLASSES } from "../constants/studio-tokens";
import { CampaignProposalExportActions } from "./campaign-proposal-export-actions";

type StudioTopChromeProps = {
  workflowName: string;
  currentSectionTitle: string;
  campaignObjectId?: string;
  conversationId?: string;
  progressPercent: number;
  showExportActions: boolean;
  studioModeToggle?: ReactNode;
  onOpenNav?: () => void;
  showNavToggle?: boolean;
  layoutMode?: CampaignStudioLayoutMode;
  className?: string;
};

function publishChromeHeight(el: HTMLElement) {
  const height = `${el.offsetHeight}px`;
  el.style.setProperty("--studio-chrome-height", height);
  el.closest<HTMLElement>(".studio-shell-chat")?.style.setProperty(
    "--studio-chrome-height",
    height
  );
}

export function StudioTopChrome({
  workflowName,
  currentSectionTitle,
  campaignObjectId,
  conversationId,
  progressPercent,
  showExportActions,
  studioModeToggle,
  onOpenNav,
  showNavToggle,
  layoutMode = "panel",
  className,
}: StudioTopChromeProps) {
  const headerRef = useRef<HTMLElement>(null);
  const isChatLayout = layoutMode === "chat";

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    publishChromeHeight(el);

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => publishChromeHeight(el))
        : null;
    observer?.observe(el);

    return () => observer?.disconnect();
  }, [workflowName, currentSectionTitle, showExportActions, showNavToggle, isChatLayout]);

  return (
    <header
      ref={headerRef}
      data-studio-top-chrome
      className={cn(
        isChatLayout ? STUDIO_CLASSES.topChromeChat : STUDIO_CLASSES.topChrome,
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-2.5">
        {showNavToggle ? (
          <button
            type="button"
            onClick={onOpenNav}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#0B0F1A]/8 bg-white text-foreground shadow-sm lg:hidden dark:border-border dark:bg-background"
            aria-label="Open section navigation"
          >
            <ListIcon className="size-4" aria-hidden />
          </button>
        ) : null}
        <div className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#7C3AED] to-[#0057FF] shadow-[0_4px_10px_rgba(124,58,237,0.28)]">
          <ZapIcon className="size-3.5 fill-white text-white" aria-hidden />
        </div>
        <div className="shrink-0">
          <p className="leading-none text-[10px] font-extrabold tracking-[0.6px] text-[#7C3AED] uppercase dark:text-violet-400">
            {CAMPAIGN_STUDIO_COPY.studioLabel}
          </p>
          <h2 className="mt-0.5 leading-tight text-[17px] font-extrabold tracking-[-0.3px] text-foreground sm:text-[19px]">
            {workflowName}
          </h2>
        </div>
        <span className="hidden shrink-0 text-[#0B0F1A]/15 sm:inline dark:text-border" aria-hidden>
          /
        </span>
        <p className="hidden shrink-0 text-xs font-semibold leading-tight text-[#6B7280] sm:block">
          {currentSectionTitle}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
        {showExportActions && campaignObjectId ? (
          <CampaignProposalExportActions
            campaignObjectId={campaignObjectId}
            conversationId={conversationId}
          />
        ) : null}
        {studioModeToggle}
        <div className="hidden shrink-0 text-right sm:block">
          <p className="leading-none text-[11px] font-semibold text-muted-foreground">Progress</p>
          <p className="mt-0.5 text-sm font-extrabold leading-none text-[#0057FF]">
            {progressPercent}%
          </p>
        </div>
      </div>
    </header>
  );
}
