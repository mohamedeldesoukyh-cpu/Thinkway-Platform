"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatPercent } from "@/lib/campaigns/performance-calculations";
import {
  ENGAGEMENT_RATE_METHOD_LABELS,
  engagementRateMethodTooltip,
  type EngagementRateMethod,
} from "@/lib/performance/engagement-rate-engine";
import { cn } from "@/lib/utils";

export type EngagementRateTier = "hi" | "mid" | "lo";

export function engagementRateTier(rate: number | null | undefined): EngagementRateTier {
  if (rate == null || Number.isNaN(rate)) return "lo";
  if (rate >= 5) return "hi";
  if (rate >= 3) return "mid";
  return "lo";
}

const TIER_CLASS: Record<EngagementRateTier, string> = {
  hi: "thinkway-campaign-er thinkway-campaign-er-hi",
  mid: "thinkway-campaign-er thinkway-campaign-er-mid",
  lo: "thinkway-campaign-er thinkway-campaign-er-lo",
};

type Props = {
  rate: number | null | undefined;
  method?: EngagementRateMethod | string | null;
  className?: string;
  showTooltip?: boolean;
};

export function EngagementRateDisplay({
  rate,
  method,
  className,
  showTooltip = true,
}: Props) {
  const tier = engagementRateTier(rate);
  const pill = (
    <span className={cn(TIER_CLASS[tier], className)}>{formatPercent(rate, 1)}</span>
  );

  if (!showTooltip || !method) {
    return pill;
  }

  const methodKey = (method ?? "unknown") as EngagementRateMethod;
  const methodLabel = ENGAGEMENT_RATE_METHOD_LABELS[methodKey] ?? "Unknown";
  const methodNote = engagementRateMethodTooltip(methodKey);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help">{pill}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        Method: {methodLabel}
        {methodNote ? ` — ${methodNote}` : ""}
      </TooltipContent>
    </Tooltip>
  );
}
