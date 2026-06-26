"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCompactCount } from "@/lib/campaigns/performance-calculations";
import {
  impressionsSourceTextClass,
  impressionsSourceTooltip,
  type ImpressionsSource,
} from "@/lib/performance/impressions-forecast-engine";
import { cn } from "@/lib/utils";

type Props = {
  impressions: number | null | undefined;
  impressionsSource?: ImpressionsSource | string | null;
  forecastImpressions?: number | null;
  forecastFormula?: string | null;
  className?: string;
  layout?: "inline" | "stacked";
  showPreviousForecast?: boolean;
};

function ImpressionsValue({
  impressions,
  source,
  forecastImpressions,
  forecastFormula,
  showPreviousForecast,
  sizeClass,
}: {
  impressions: number | null | undefined;
  source: ImpressionsSource | null;
  forecastImpressions?: number | null;
  forecastFormula?: string | null;
  showPreviousForecast?: boolean;
  sizeClass: string;
}) {
  const tooltip = impressionsSourceTooltip(source, forecastFormula);
  const hasSource = source != null && impressions != null;
  const textClass = hasSource
    ? impressionsSourceTextClass(source)
    : impressionsSourceTextClass(null);

  const previousForecastNote =
    showPreviousForecast &&
    source === "actual" &&
    forecastImpressions != null &&
    forecastImpressions !== impressions
      ? `Forecast used previously: ${formatCompactCount(forecastImpressions)}`
      : null;

  const formulaNote =
    source === "forecast" && forecastFormula ? `Formula: ${forecastFormula}` : null;

  const valueText = formatCompactCount(impressions);

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
          {formulaNote ? ` ${formulaNote}.` : ""}
          {previousForecastNote ? ` ${previousForecastNote}.` : ""}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <span className={cn("tabular-nums", sizeClass, textClass)}>{valueText}</span>
  );
}

export function ImpressionsDisplay({
  impressions,
  impressionsSource,
  forecastImpressions,
  forecastFormula,
  className,
  layout = "inline",
  showPreviousForecast = false,
}: Props) {
  const source = (impressionsSource ?? null) as ImpressionsSource | null;

  const previousForecastNote =
    showPreviousForecast &&
    source === "actual" &&
    forecastImpressions != null &&
    forecastImpressions !== impressions
      ? `Forecast used previously: ${formatCompactCount(forecastImpressions)}`
      : null;

  const formulaNote =
    source === "forecast" && forecastFormula ? `Formula: ${forecastFormula}` : null;

  if (layout === "stacked") {
    return (
      <div className={className}>
        <ImpressionsValue
          impressions={impressions}
          source={source}
          forecastImpressions={forecastImpressions}
          forecastFormula={forecastFormula}
          showPreviousForecast={showPreviousForecast}
          sizeClass="text-lg font-semibold"
        />
        {formulaNote ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{formulaNote}</p>
        ) : null}
        {previousForecastNote ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{previousForecastNote}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center justify-end", className)}>
      <ImpressionsValue
        impressions={impressions}
        source={source}
        forecastImpressions={forecastImpressions}
        forecastFormula={forecastFormula}
        showPreviousForecast={showPreviousForecast}
        sizeClass=""
      />
    </div>
  );
}
