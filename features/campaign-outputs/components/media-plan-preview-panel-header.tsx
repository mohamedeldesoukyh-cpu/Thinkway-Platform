"use client";

import { GripVerticalIcon } from "lucide-react";

import { ThinkwayLogo } from "@/components/brand/thinkway-logo";
import { cn } from "@/lib/utils";

import type { MediaPlanCampaignContext } from "../generators/media-plan";

/**
 * Branded header for the Media Plan floating preview — mirrors cover-page hierarchy
 * (Thinkway mark, campaign title, brand context, landscape indicator).
 * Drag is handled by the parent DocumentPreviewWindow shell.
 */
export function MediaPlanPreviewPanelHeader({
  title,
  context,
  draggable = false,
  className,
}: {
  title?: string;
  context?: MediaPlanCampaignContext;
  draggable?: boolean;
  className?: string;
}) {
  const brandLabel = context?.brandName?.trim();

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3",
        className
      )}
    >
      {draggable ? (
        <GripVerticalIcon className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />
      ) : null}
      <ThinkwayLogo showText compact className="!mb-0 shrink-0" />
      <div className="min-w-0 flex-1 border-l border-[#1D9E75]/25 pl-2.5 sm:pl-3">
        <p className="text-[10px] font-semibold tracking-wide text-[#1D9E75]">
          Influencer campaign · Media plan
        </p>
        <p className="truncate text-sm font-bold text-foreground">{title ?? "Media plan"}</p>
        {brandLabel ? (
          <p className="truncate text-[11px] text-muted-foreground">Brand · {brandLabel}</p>
        ) : null}
      </div>
      <span
        className="hidden shrink-0 rounded-full border border-[#1D9E75]/25 bg-[#1D9E75]/[0.08] px-2.5 py-1 text-[10px] font-medium text-[#1D9E75] sm:inline-flex"
        aria-hidden
      >
        Landscape document
      </span>
    </div>
  );
}
