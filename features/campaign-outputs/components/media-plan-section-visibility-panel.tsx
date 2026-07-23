"use client";

import { useCallback, useMemo } from "react";
import { EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CampaignObject } from "@/features/campaign-intelligence";

import {
  MEDIA_PLAN_SECTION_LABELS,
  readMediaPlanPresentation,
  type MediaPlanSectionKey,
} from "../media-plan-presentation";

const SECTION_ORDER: MediaPlanSectionKey[] = [
  "executiveSummary",
  "objectives",
  "marketTiming",
  "platformIntelligence",
  "creatorMix",
  "weeklyObjectives",
  "creativeDirection",
  "influencerConcepts",
  "publishingCalendar",
  "campaignOperations",
  "productionSchedule",
];

export type MediaPlanSectionVisibilityPanelProps = {
  campaignObject: CampaignObject;
  saving?: boolean;
  disabled?: boolean;
  onSectionChange: (section: MediaPlanSectionKey, visible: boolean) => void | Promise<void>;
  className?: string;
};

/**
 * Section visibility controls for Media Plan preview — internal workspace only.
 * Complements per-header toggles in the iframe; always lists every section so
 * hidden blocks can be restored without leaving the document preview.
 */
export function MediaPlanSectionVisibilityPanel({
  campaignObject,
  saving = false,
  disabled = false,
  onSectionChange,
  className,
}: MediaPlanSectionVisibilityPanelProps) {
  const presentation = useMemo(
    () => readMediaPlanPresentation(campaignObject),
    [campaignObject.id, campaignObject.updatedAt, campaignObject.meta.mediaPlanPresentation]
  );

  const handleToggle = useCallback(
    (section: MediaPlanSectionKey) => {
      if (disabled || saving) return;
      const visible = presentation.sections[section] !== false;
      void onSectionChange(section, !visible);
    },
    [disabled, saving, presentation.sections, onSectionChange]
  );

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-border/80 bg-muted/30 px-4 py-2",
        className
      )}
    >
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Sections
      </span>
      {saving ? (
        <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {SECTION_ORDER.map((section) => {
          const visible = presentation.sections[section] !== false;
          return (
            <button
              key={section}
              type="button"
              disabled={disabled || saving}
              onClick={() => handleToggle(section)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                visible
                  ? "border-[#0057FF]/25 bg-[#0057FF]/10 text-[#0057FF]"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
              aria-pressed={visible}
              title={visible ? "Hide section" : "Show section"}
            >
              {visible ? (
                <EyeIcon className="size-3 shrink-0" aria-hidden />
              ) : (
                <EyeOffIcon className="size-3 shrink-0" aria-hidden />
              )}
              {MEDIA_PLAN_SECTION_LABELS[section]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
