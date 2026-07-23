"use client";

import { useCallback, useMemo } from "react";
import { Globe2Icon, Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CampaignObject } from "@/features/campaign-intelligence";
import {
  resolveMarketIntelligenceConfig,
  type MediaPlanMarketIntelligenceMeta,
} from "@/features/market-intelligence/market-intelligence-config";
import { OUTPUTS_CLASSES } from "../constants/outputs-center-tokens";

export type OutputsCenterMarketIntelligenceToggleProps = {
  campaignObject: CampaignObject;
  saving?: boolean;
  disabled?: boolean;
  onChange: (patch: Partial<MediaPlanMarketIntelligenceMeta>) => void | Promise<void>;
  className?: string;
  variant?: "bar" | "setting-row";
};

function formatCategoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Campaign Outputs Center master toggle — controls market intelligence for all outputs.
 */
export function OutputsCenterMarketIntelligenceToggle({
  campaignObject,
  saving = false,
  disabled = false,
  onChange,
  className,
  variant = "bar",
}: OutputsCenterMarketIntelligenceToggleProps) {
  const resolved = useMemo(
    () => resolveMarketIntelligenceConfig(campaignObject),
    [
      campaignObject.id,
      campaignObject.updatedAt,
      campaignObject.meta.mediaPlanSchedule,
      campaignObject.meta.campaignFacts,
    ]
  );

  const handleMasterChange = useCallback(() => {
    if (disabled || saving) return;
    void onChange({ enabled: !resolved.enabled });
  }, [disabled, saving, resolved.enabled, onChange]);

  const contextLine = useMemo(() => {
    const parts: string[] = [];
    if (resolved.countries?.length) parts.push(resolved.countries.join(", "));
    if (resolved.category) parts.push(formatCategoryLabel(resolved.category));
    return parts.length ? parts.join(" · ") : null;
  }, [resolved.countries, resolved.category]);

  if (variant === "setting-row") {
    return (
      <div className={cn(OUTPUTS_CLASSES.settingRow, className)}>
        <div className={OUTPUTS_CLASSES.settingIco}>
          <Globe2Icon aria-hidden />
        </div>
        <div className="oc-setting-body min-w-0 flex-1">
          <h4>Market Intelligence</h4>
          <p>
            Influences scheduling across Media Plan, Strategy, KPI Forecast, and other campaign
            outputs.
            {contextLine ? (
              <>
                {" "}
                Markets: {contextLine}
              </>
            ) : null}
          </p>
        </div>
        <div className="oc-setting-right">
          {saving ? (
            <Loader2Icon className="size-4 animate-spin text-[#6B7280]" aria-hidden />
          ) : null}
          <span
            style={{ color: resolved.enabled ? "#065F46" : "#6B7280" }}
            className="text-[11px] font-semibold"
          >
            {resolved.enabled ? "On" : "Off"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={resolved.enabled}
            aria-label="Enable market intelligence for all campaign outputs"
            disabled={disabled || saving}
            onClick={handleMasterChange}
            className={cn("oc-switch", resolved.enabled && "on")}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#10B981]/10">
          <Globe2Icon className="size-3.5 text-[#10B981]" aria-hidden />
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="text-[12px] font-semibold text-foreground">Market Intelligence</p>
          <p className="text-[11px] text-muted-foreground">
            Influences scheduling across Media Plan, Strategy, KPI Forecast, and other campaign outputs.
            {contextLine ? (
              <>
                {" "}
                <span className="text-foreground/70">Markets: {contextLine}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  );
}
