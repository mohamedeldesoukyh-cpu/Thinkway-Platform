"use client";

import { useCallback, useMemo } from "react";
import { LayoutTemplateIcon, Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CampaignObject } from "@/features/campaign-intelligence";

import {
  readMediaPlanPresentation,
  type MediaPlanPresentationMode,
  type MediaPlanViewMode,
} from "../media-plan-presentation";
import { OUTPUTS_CLASSES } from "../constants/outputs-center-tokens";

export type MediaPlanPresentationToggleProps = {
  campaignObject: CampaignObject;
  saving?: boolean;
  disabled?: boolean;
  onChange: (patch: {
    mode?: MediaPlanPresentationMode;
    view?: MediaPlanViewMode;
  }) => void | Promise<void>;
  className?: string;
  variant?: "bar" | "setting-row";
};

/**
 * Media Plan presentation mode — Standard (client-safe) vs Strategy (full intelligence).
 * Lives in Outputs Center header; applies to preview and export defaults.
 */
export function MediaPlanPresentationToggle({
  campaignObject,
  saving = false,
  disabled = false,
  onChange,
  className,
  variant = "bar",
}: MediaPlanPresentationToggleProps) {
  const presentation = useMemo(
    () => readMediaPlanPresentation(campaignObject),
    [campaignObject.id, campaignObject.updatedAt, campaignObject.meta.mediaPlanPresentation]
  );

  const isStrategy = presentation.mode === "strategy";
  const isInternal = presentation.view !== "client";

  const handleModeSelect = useCallback(() => {
    const nextMode: MediaPlanPresentationMode = isStrategy ? "standard" : "strategy";
    if (disabled || saving) return;
    void onChange({ mode: nextMode });
  }, [disabled, saving, isStrategy, onChange]);

  const handleViewSelect = useCallback(() => {
    const nextView: MediaPlanViewMode = isInternal ? "client" : "internal";
    if (disabled || saving) return;
    void onChange({ view: nextView });
  }, [disabled, saving, isInternal, onChange]);

  if (variant === "setting-row") {
    return (
      <div className={cn(OUTPUTS_CLASSES.settingRow, className)}>
        <div className={OUTPUTS_CLASSES.settingIco}>
          <LayoutTemplateIcon aria-hidden />
        </div>
        <div className="oc-setting-body min-w-0 flex-1">
          <h4>Media Plan Presentation</h4>
          <p>
            {isStrategy
              ? "Strategy mode — weekly objectives, platform intelligence, market timing, AI rationale."
              : "Standard mode — executive summary, objectives, creator mix, calendar, concept summaries."}
          </p>
        </div>
        <div className="oc-setting-right">
          {saving ? (
            <Loader2Icon className="size-4 animate-spin text-[#6B7280]" aria-hidden />
          ) : null}
          <div className="oc-mode-toggle">
            <button
              type="button"
              disabled={disabled || saving}
              onClick={handleModeSelect}
              className={isStrategy ? "on" : undefined}
            >
              Strategy mode
            </button>
            <button
              type="button"
              disabled={disabled || saving}
              onClick={handleViewSelect}
              className={isInternal ? "on" : undefined}
            >
              Internal view
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-2.5",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#0057FF]/10">
          <LayoutTemplateIcon className="size-3.5 text-[#0057FF]" aria-hidden />
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="text-[12px] font-semibold text-foreground">Media Plan Presentation</p>
          <p className="text-[11px] text-muted-foreground">
            {isStrategy
              ? "Strategy mode — weekly objectives, platform intelligence, market timing, AI rationale."
              : "Standard mode — executive summary, objectives, creator mix, calendar, concept summaries."}
          </p>
        </div>
      </div>
    </div>
  );
}
