"use client";

import { Card, CardContent } from "@/components/ui/card";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { cn } from "@/lib/utils";

import { HealthIndicator } from "./health-indicator";
import {
  KPI_HEALTH_SURFACE_CLASS,
  KPI_HEALTH_VALUE_CLASS,
  type KpiHealthTone,
} from "./kpi-config";
import { resolveKpiHealthFromLegacyAlert } from "./kpi-utils";

export type MetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  health?: KpiHealthTone;
  /** PO tracker / alert surfaces — maps to destructive health. */
  alert?: boolean;
  layout?: "grid" | "section" | "card" | "aging";
  compact?: boolean;
  className?: string;
  valueClassName?: string;
};

export function MetricCard({
  title,
  value,
  subtitle,
  health,
  alert,
  layout = "grid",
  compact,
  className,
  valueClassName,
}: MetricCardProps) {
  const resolvedHealth = health ?? (alert ? "destructive" : undefined);
  const valueToneClass =
    valueClassName ??
    (resolvedHealth ? KPI_HEALTH_VALUE_CLASS[resolvedHealth] : undefined);

  if (layout === "section") {
    return (
      <CampaignFlatSection
        title={title}
        className={cn(
          resolvedHealth === "destructive" && "border-destructive/40",
          className,
        )}
      >
        <div className="flex items-start gap-2">
          {resolvedHealth ? (
            <HealthIndicator tone={resolvedHealth} className="mt-2" aria-label={title} />
          ) : null}
          <div>
            <p className={cn("font-semibold", compact ? "text-lg" : "text-2xl", valueToneClass)}>
              {value}
            </p>
            {subtitle ? (
              <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>
      </CampaignFlatSection>
    );
  }

  if (layout === "card") {
    return (
      <Card className={cn("shadow-sm", className)}>
        <CardContent className={cn("p-3", compact && "p-2.5")}>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p
            className={cn(
              "font-heading font-semibold tabular-nums",
              compact ? "text-base" : "text-lg",
              valueToneClass,
            )}
          >
            {value}
          </p>
          {subtitle ? (
            <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const surfaceClass =
    layout === "aging" && resolvedHealth
      ? KPI_HEALTH_SURFACE_CLASS[resolvedHealth]
      : "border-border/70 bg-card shadow-sm";

  return (
    <div
      className={cn(
        layout === "aging" ? "rounded-2xl border p-4" : "rounded-lg border px-4 py-3",
        surfaceClass,
        className,
      )}
    >
      <p
        className={cn(
          "text-muted-foreground",
          layout === "aging" ? "text-xs" : "text-[10px] font-medium uppercase tracking-wide",
        )}
      >
        {title}
      </p>
      <p
        className={cn(
          "mt-1 font-semibold tabular-nums tracking-tight text-foreground",
          layout === "aging" ? "text-lg" : "text-xl",
          valueToneClass,
        )}
      >
        {value}
      </p>
      {subtitle ? (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}

/** Map legacy alert prop to health for metric cards. */
export function metricCardHealthFromAlert(
  alert: "warning" | "danger" | undefined,
): KpiHealthTone | undefined {
  return resolveKpiHealthFromLegacyAlert(alert);
}
