"use client";

import { ListIcon, ZapIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

import { ThinkwayLogo } from "@/components/brand/thinkway-logo";
import { cn } from "@/lib/utils";

import type { CampaignStudioLayoutMode } from "../types/campaign-studio";

import { CAMPAIGN_STUDIO_COPY } from "../constants/copy";
import { STUDIO_REF_CLASSES } from "../constants/campaign-studio-ref-tokens";
import { STUDIO_CLASSES } from "../constants/studio-tokens";
import type { StudioReadinessStatus } from "../services/studio-readiness-status";
import { CampaignProposalExportActions } from "./campaign-proposal-export-actions";

type StudioTopChromeProps = {
  /** Campaign display name for meta title (brand — campaign). Falls back to workflowName. */
  displayTitle?: string;
  workflowName: string;
  currentSectionTitle: string;
  campaignObjectId?: string;
  conversationId?: string;
  progressPercent: number;
  /**
   * The one readiness status — `resolveStudioReadinessStatus`, fed by the
   * Package readiness service. The mast used to relabel the completion
   * percentage itself ("Ready" at 75%+), which is how the header said "Ready"
   * while the Package screen said "Not ready".
   */
  readiness: StudioReadinessStatus;
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

/**
 * Claim the page's application header for the campaign mast.
 *
 * The Studio route rendered the white global Thinkway header AND this blue
 * campaign header. Campaign Mode's own contract is that "the Campaign Studio
 * *is* the application" — the mast is the first header, as on the Shortlist and
 * Quotation workspaces. The route cannot drop the shell header server-side
 * because the same route renders plain Copilot chat, which needs it, so the
 * mast marks the shell while it is mounted and releases it on unmount.
 */
function claimShellChrome(el: HTMLElement): () => void {
  const root = el.closest<HTMLElement>("[data-dashboard-shell-root]");
  if (!root) return () => undefined;
  root.dataset.pageOwnsChrome = "true";
  return () => {
    delete root.dataset.pageOwnsChrome;
  };
}

function ProgressRing({
  percent,
  readyLabel,
}: {
  percent: number;
  readyLabel: string;
}) {
  const radius = 15.5;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

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
  readiness,
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
    // Only the reference mast is a full application header; the legacy compact
    // chrome sits under the shell header and must not remove it.
    const releaseChrome = refMode ? claimShellChrome(el) : () => undefined;

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => publishChromeHeight(el))
        : null;
    observer?.observe(el);

    return () => {
      observer?.disconnect();
      releaseChrome();
    };
  }, [
    displayTitle,
    workflowName,
    currentSectionTitle,
    showExportActions,
    showNavToggle,
    isChatLayout,
    readiness.summary,
    refMode,
    reviewCount,
  ]);

  const metaTitle = displayTitle?.trim() || workflowName;
  // Readiness comes from the Package service; the percentage is progress, and
  // is shown beside the status rather than standing in for it.
  const statusRisk = !readiness.ready || reviewCount > 0;

  if (refMode) {
    return (
      <header
        ref={headerRef}
        data-studio-top-chrome
        className={cn(STUDIO_REF_CLASSES.frozen, className)}
      >
        <div className={STUDIO_REF_CLASSES.mast}>
          <div className={STUDIO_REF_CLASSES.mastHead}>
            {/*
              The application's real logo, from the approved component the
              dashboard and portal shells already use. Nothing is redrawn here:
              a hand-built mark plus a text wordmark is what used to sit in this
              slot, under a second Thinkway header.
            */}
            <Link
              href="/"
              className="flex shrink-0 items-center [&_.login-v2-logo-text]:text-white"
              title="Thinkway home"
            >
              <ThinkwayLogo compact showText className="mb-0" />
            </Link>
            <span className={STUDIO_REF_CLASSES.mastDivider} aria-hidden />
            {/*
              A campaign UUID is not an identifier a person reads. Only a real
              campaign code is shown; the raw object id is not, and the campaign
              name beside it is the identity either way.
            */}
            {campaignCode?.trim() ? (
              <span className={STUDIO_REF_CLASSES.mastId}>{campaignCode.trim()}</span>
            ) : null}
            <h1>{metaTitle}</h1>
            <span className={STUDIO_REF_CLASSES.mastSub}>{currentSectionTitle}</span>
            <span
              className={cn(
                STUDIO_REF_CLASSES.mastStatus,
                statusRisk && STUDIO_REF_CLASSES.mastStatusRisk
              )}
            >
              {readiness.summary}
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
              <ProgressRing percent={progressPercent} readyLabel={readiness.label} />
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
