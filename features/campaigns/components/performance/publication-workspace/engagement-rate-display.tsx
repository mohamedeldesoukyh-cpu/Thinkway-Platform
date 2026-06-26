"use client";

import {
  ENGAGEMENT_RATE_METHOD_LABELS,
  engagementRateMethodTooltip,
  type EngagementRateMethod,
} from "@/lib/performance/engagement-rate-engine";
import { formatPercent } from "@/lib/campaigns/performance-calculations";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
  engagementRate: number | null | undefined;
  method: string | null | undefined;
  className?: string;
};

export function EngagementRateDisplay({ engagementRate, method, className }: Props) {
  const normalizedMethod = (method ?? "unknown") as EngagementRateMethod;
  const label = ENGAGEMENT_RATE_METHOD_LABELS[normalizedMethod] ?? "Unknown";
  const tooltip = engagementRateMethodTooltip(normalizedMethod);

  return (
    <div className={className}>
      <p className="text-lg font-semibold tabular-nums">{formatPercent(engagementRate, 1)}</p>
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="mt-0.5 cursor-help text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2">
            Method: {label}
          </p>
        </TooltipTrigger>
        {tooltip ? <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent> : null}
      </Tooltip>
    </div>
  );
}
