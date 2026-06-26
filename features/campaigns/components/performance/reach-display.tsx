"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCompactCount } from "@/lib/campaigns/performance-calculations";
import {
  reachSourceTextClass,
  reachSourceTooltip,
  type ReachForecastConfidence,
  type ReachSource,
} from "@/lib/performance/reach-forecast-engine";
import { cn } from "@/lib/utils";

type Props = {
  reach: number | null | undefined;
  reachSource?: ReachSource | string | null;
  forecastReach?: number | null;
  forecastConfidence?: ReachForecastConfidence | null;
  className?: string;
  /** Grid: inline value + color. Workspace: stacked layout. */
  layout?: "inline" | "stacked";
  showPreviousForecast?: boolean;
};

function ReachValue({
  reach,
  source,
  forecastReach,
  forecastConfidence,
  showPreviousForecast,
  sizeClass,
}: {
  reach: number | null | undefined;
  source: ReachSource | null;
  forecastReach?: number | null;
  forecastConfidence?: ReachForecastConfidence | null;
  showPreviousForecast?: boolean;
  sizeClass: string;
}) {
  const tooltip = reachSourceTooltip(source);
  const hasSource = source != null && reach != null;
  const textClass = hasSource ? reachSourceTextClass(source) : reachSourceTextClass(null);

  const previousForecastNote =
    showPreviousForecast &&
    source === "actual" &&
    forecastReach != null &&
    forecastReach !== reach
      ? `Forecast used previously: ${formatCompactCount(forecastReach)}`
      : null;

  const confidenceNote =
    source === "forecast" && forecastConfidence
      ? `Confidence: ${forecastConfidence}`
      : null;

  const valueText = formatCompactCount(reach);

  if (hasSource && tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "tabular-nums cursor-help underline decoration-dotted decoration-current/30 underline-offset-2",
              sizeClass,
              textClass
            )}
          >
            {valueText}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          {tooltip}
          {confidenceNote ? ` ${confidenceNote}.` : ""}
          {previousForecastNote ? ` ${previousForecastNote}.` : ""}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <span className={cn("tabular-nums", sizeClass, textClass)}>{valueText}</span>
  );
}

export function ReachDisplay({
  reach,
  reachSource,
  forecastReach,
  forecastConfidence,
  className,
  layout = "inline",
  showPreviousForecast = false,
}: Props) {
  const source = (reachSource ?? null) as ReachSource | null;

  const previousForecastNote =
    showPreviousForecast &&
    source === "actual" &&
    forecastReach != null &&
    forecastReach !== reach
      ? `Forecast used previously: ${formatCompactCount(forecastReach)}`
      : null;

  if (layout === "stacked") {
    return (
      <div className={className}>
        <ReachValue
          reach={reach}
          source={source}
          forecastReach={forecastReach}
          forecastConfidence={forecastConfidence}
          showPreviousForecast={showPreviousForecast}
          sizeClass="text-lg font-semibold"
        />
        {source === "forecast" && forecastConfidence ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Method: Followers estimate · {forecastConfidence} confidence
          </p>
        ) : null}
        {previousForecastNote ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{previousForecastNote}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center justify-end", className)}>
      <ReachValue
        reach={reach}
        source={source}
        forecastReach={forecastReach}
        forecastConfidence={forecastConfidence}
        showPreviousForecast={showPreviousForecast}
        sizeClass=""
      />
    </div>
  );
}
