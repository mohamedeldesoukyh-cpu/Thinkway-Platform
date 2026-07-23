"use client";

import { useCallback, useMemo } from "react";
import { Loader2Icon } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { CampaignObject } from "@/features/campaign-intelligence";
import {
  marketIntelligenceFromCampaignObject,
  resolveMarketIntelligenceConfig,
  type MediaPlanMarketIntelligenceMeta,
} from "@/features/market-intelligence/market-intelligence-config";
import type { MarketIntelligenceToggles } from "@/features/market-intelligence/types";
import { DEFAULT_MARKET_INTELLIGENCE_TOGGLES } from "@/features/market-intelligence/types";

type FactorKey = keyof MarketIntelligenceToggles;

const FACTOR_TOGGLES: Array<{ key: FactorKey; label: string }> = [
  { key: "salaryCycle", label: "Salary cycle" },
  { key: "retailSeasons", label: "Retail seasons" },
  { key: "ramadan", label: "Ramadan & religious seasons" },
  { key: "publicHolidays", label: "Public holidays" },
  { key: "schoolCalendar", label: "School calendar" },
  { key: "weather", label: "Weather seasons" },
  { key: "nationalEvents", label: "National events" },
];

export type MediaPlanMarketIntelligenceTogglesProps = {
  campaignObject: CampaignObject;
  saving?: boolean;
  onChange: (patch: Partial<MediaPlanMarketIntelligenceMeta>) => void | Promise<void>;
  className?: string;
};

function formatCategoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function MediaPlanMarketIntelligenceToggles({
  campaignObject,
  saving = false,
  onChange,
  className,
}: MediaPlanMarketIntelligenceTogglesProps) {
  const resolved = useMemo(
    () => resolveMarketIntelligenceConfig(campaignObject),
    [campaignObject.id, campaignObject.updatedAt, campaignObject.meta.mediaPlanSchedule]
  );

  const meta = marketIntelligenceFromCampaignObject(campaignObject);
  const enabled = resolved.enabled;
  const toggles = resolved.toggles;

  const handleMasterChange = useCallback(
    (checked: boolean) => {
      void onChange({ enabled: checked });
    },
    [onChange]
  );

  const handleFactorChange = useCallback(
    (key: FactorKey, checked: boolean) => {
      void onChange({
        toggles: {
          ...DEFAULT_MARKET_INTELLIGENCE_TOGGLES,
          ...meta?.toggles,
          [key]: checked,
        },
      });
    },
    [meta?.toggles, onChange]
  );

  const contextLine = useMemo(() => {
    const parts: string[] = [];
    if (resolved.countries.length) {
      parts.push(resolved.countries.join(", "));
    }
    if (resolved.category) {
      parts.push(formatCategoryLabel(resolved.category));
    }
    return parts.length ? parts.join(" · ") : null;
  }, [resolved.countries, resolved.category]);

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-muted/20 p-4 sm:p-5",
        className
      )}
      data-no-drag
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-bold text-foreground">Scheduling factors</h3>
          <p className="text-[12px] text-muted-foreground">
            Market intelligence nudges publishing toward local purchase-intent windows.
          </p>
          {contextLine ? (
            <p className="text-[11px] text-muted-foreground/90">
              <span className="font-medium text-foreground/70">Markets:</span> {contextLine}
            </p>
          ) : null}
        </div>
        {saving ? (
          <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5">
          <label htmlFor="mi-master" className="text-[13px] font-medium text-foreground">
            Enable market intelligence
          </label>
          <Switch
            id="mi-master"
            checked={enabled}
            disabled={saving}
            onCheckedChange={handleMasterChange}
            aria-label="Enable market intelligence"
          />
        </div>

        <div
          className={cn(
            "grid gap-2 sm:grid-cols-2",
            !enabled && "pointer-events-none opacity-50"
          )}
        >
          {FACTOR_TOGGLES.map(({ key, label }) => (
            <div
              key={key}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/80 px-3 py-2"
            >
              <label htmlFor={`mi-${key}`} className="text-[12px] text-foreground/90">
                {label}
              </label>
              <Switch
                id={`mi-${key}`}
                checked={toggles[key]}
                disabled={saving || !enabled}
                onCheckedChange={(checked) => handleFactorChange(key, checked)}
                aria-label={label}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
