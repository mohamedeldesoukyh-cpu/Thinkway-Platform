"use client";

import { ListIcon, ZapIcon } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { CampaignStudioLayoutMode } from "../types/campaign-studio";

import { CAMPAIGN_STUDIO_COPY } from "../constants/copy";
import { STUDIO_REF_CLASSES } from "../constants/campaign-studio-ref-tokens";
import { STUDIO_CLASSES } from "../constants/studio-tokens";
import { resolveStudioReadinessLabel } from "../services/section-data-resolver";
import { CampaignProposalExportActions } from "./campaign-proposal-export-actions";

type StudioTopChromeProps = {
  /** Campaign display name for meta title (brand — campaign). Falls back to workflowName. */
  displayTitle?: string;
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
  compact?: boolean;
  refMode?: boolean;
  /** Review finding count — mast CTA opens the review drawer. */
  reviewCount?: number;
  onOpenReview?: () => void;
  /** Optional campaign id chip (e.g. TW-2026-0124). */
  campaignCode?: string;
  /** Extra mast actions (e.g. New Campaign) — stays in shared chrome, not mode bodies. */
  mastExtras?: ReactNode;
};

function publishChromeHeight(el: HTMLElement) {
  const height = `${el.offsetHeight}px`;
  el.style.setProperty("--studio-chrome-height", height);
  el.closest<HTMLElement>(".studio-shell-chat")?.style.setProperty(
    "--studio-chrome-height",
    height
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const radius = 15.5;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const readyLabel = resolveStudioReadinessLabel(percent);

  return (
    <div className={STUDIO_REF_CLASSES.progressRingWrap}>
      <svg className={STUDIO_REF_CLASSES.progressRing} viewBox="0 0 36 36" aria-hidden>
        <circle cx="18" cy="18" r={radius} fill="none" stroke="#e3e8f2" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="#10b981"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={`${offset}`}
          transform="rotate(-90 18 18)"
        />
      </svg>
      <div className={STUDIO_REF_CLASSES.progressLabel}>
        <b>{percent}%</b>
        <span>{readyLabel}</span>
      </div>
    </div>
  );
}

export function StudioTopChrome({
  displayTitle,
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
  compact = false,
  refMode = false,
  reviewCount = 0,
  onOpenReview,
  campaignCode,
  mastExtras,
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
  }, [
    displayTitle,
    workflowName,
    currentSectionTitle,
    showExportActions,
    showNavToggle,
    isChatLayout,
    refMode,
    reviewCount,
  ]);

  const metaTitle = displayTitle?.trim() || workflowName;
  const readinessLabel = resolveStudioReadinessLabel(progressPercent);
  const statusRisk = progressPercent < 100 || reviewCount > 0;

  if (refMode) {
    return (
      <header
        ref={headerRef}
        data-studio-top-chrome
        className={cn(STUDIO_REF_CLASSES.frozen, className)}
      >
        <div className={STUDIO_REF_CLASSES.mast}>
          <div className={STUDIO_REF_CLASSES.mastHead}>
            <span className={STUDIO_REF_CLASSES.mastMark} aria-hidden>
              <i />
              <u />
            </span>
            <span className={STUDIO_REF_CLASSES.mastWord}>
              THINK<em>WAY</em>
            </span>
            <span className={STUDIO_REF_CLASSES.mastDivider} aria-hidden />
            {campaignCode || campaignObjectId ? (
              <span className={STUDIO_REF_CLASSES.mastId}>
                {(campaignCode || campaignObjectId || "").slice(0, 14)}
              </span>
            ) : null}
            <h1>{metaTitle}</h1>
            <span className={STUDIO_REF_CLASSES.mastSub}>{currentSectionTitle}</span>
            <span
              className={cn(
                STUDIO_REF_CLASSES.mastStatus,
                statusRisk && STUDIO_REF_CLASSES.mastStatusRisk
              )}
            >
              {readinessLabel} · {progressPercent}%
            </span>
            <div className={STUDIO_REF_CLASSES.mastActions}>
              {onOpenReview ? (
                <button
                  type="button"
                  className={cn(STUDIO_REF_CLASSES.mastBtn, STUDIO_REF_CLASSES.mastBtnPri)}
                  onClick={onOpenReview}
                >
                  Review · {reviewCount}
                </button>
              ) : null}
              {showExportActions && campaignObjectId ? (
                <span className="inline-flex [&_button]:h-[27px] [&_button]:rounded-lg [&_button]:border [&_button]:border-white/35 [&_button]:bg-white/14 [&_button]:px-2.5 [&_button]:text-[11.5px] [&_button]:font-semibold [&_button]:text-white">
                  <CampaignProposalExportActions
                    campaignObjectId={campaignObjectId}
                    conversationId={conversationId}
                  />
                </span>
              ) : null}
              {mastExtras}
              <ProgressRing percent={progressPercent} />
            </div>
          </div>
        </div>
        {studioModeToggle ? <div>{studioModeToggle}</div> : null}
      </header>
    );
  }

  return (
    <header
      ref={headerRef}
      data-studio-top-chrome
      className={cn(
        isChatLayout
          ? STUDIO_CLASSES.topChromeChat
          : compact
            ? STUDIO_CLASSES.topChromeDesktop
            : STUDIO_CLASSES.topChrome,
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-2">
        {showNavToggle ? (
          <button
            type="button"
            onClick={onOpenNav}
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-lg border border-[#0B0F1A]/8 bg-white text-foreground shadow-sm lg:hidden dark:border-border dark:bg-background",
              compact ? "size-7" : "size-8"
            )}
            aria-label="Open section navigation"
          >
            <ListIcon className={compact ? "size-3.5" : "size-4"} aria-hidden />
          </button>
        ) : null}
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#7C3AED] to-[#0057FF] shadow-[0_4px_10px_rgba(124,58,237,0.28)]",
            compact ? "size-6" : "size-[30px]"
          )}
        >
          <ZapIcon className={cn("fill-white text-white", compact ? "size-3" : "size-3.5")} aria-hidden />
        </div>
        <div className="shrink-0">
          <p className="leading-none text-[10px] font-extrabold tracking-[0.6px] text-[#7C3AED] uppercase dark:text-violet-400">
            {CAMPAIGN_STUDIO_COPY.studioLabel}
          </p>
          <h2
            className={cn(
              "mt-0.5 font-extrabold leading-tight tracking-[-0.3px] text-foreground",
              compact ? "text-[14px]" : "text-[17px] sm:text-[19px]"
            )}
          >
            {metaTitle}
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
          <p className="leading-none text-[10px] font-semibold text-muted-foreground">Progress</p>
          <p
            className={cn(
              "mt-0.5 font-extrabold leading-none text-[#0057FF]",
              compact ? "text-xs" : "text-sm"
            )}
          >
            {progressPercent}%
          </p>
        </div>
      </div>
    </header>
  );
}
