"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { HealthIndicator } from "./health-indicator";
import {
  KPI_CARD_LABEL_CLASS,
  KPI_CARD_VALUE_CLASS,
  KPI_CARD_VALUE_CLASS_SCROLL,
  KPI_STRIP_CARD_CLASS,
  KPI_STRIP_CARD_CLASS_DENSE,
  KPI_STRIP_CARD_WIDTH,
  KPI_STRIP_CARD_WIDTH_COMPACT,
  KPI_STRIP_CARD_WIDTH_FLUID,
  type KpiHealthTone,
} from "./kpi-config";
import {
  resolveKpiAccentClass,
  resolveKpiValueClassName,
  type KpiTrend,
  type OperationalKpiValueSemantic,
} from "./kpi-utils";

export type KpiCardProps = {
  id?: string;
  /** Primary label (alias: label for carousel compat). */
  title: string;
  value: string;
  subtitle?: string;
  trend?: KpiTrend;
  icon?: LucideIcon;
  health?: KpiHealthTone;
  loading?: boolean;
  tooltip?: string;
  compact?: boolean;
  /** Tighter padding and typography — used in grouped workspace strips. */
  dense?: boolean;
  /** Fill grid cell width instead of fixed carousel width. */
  fluid?: boolean;
  accentKey?: Parameters<typeof resolveKpiAccentClass>[0];
  accentClass?: string;
  valueSemantic?: OperationalKpiValueSemantic;
  valueNumeric?: number;
  valueClassName?: string;
  /** @deprecated Prefer health */
  valueAlert?: "warning" | "danger";
  /** @deprecated Prefer valueAlert */
  alert?: "warning" | "danger";
  className?: string;
};

function KpiTrendIndicator({ trend }: { trend: KpiTrend }) {
  const arrow =
    trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→";
  return (
    <span className="text-[10px] font-medium text-muted-foreground">
      {arrow} {trend.label}
    </span>
  );
}

function KpiCardSkeleton({
  compact,
  dense,
  fluid,
}: {
  compact?: boolean;
  dense?: boolean;
  fluid?: boolean;
}) {
  return (
    <div
      className={cn(
        dense ? KPI_STRIP_CARD_CLASS_DENSE : KPI_STRIP_CARD_CLASS,
        fluid
          ? KPI_STRIP_CARD_WIDTH_FLUID
          : compact
            ? KPI_STRIP_CARD_WIDTH_COMPACT
            : KPI_STRIP_CARD_WIDTH,
      )}
    >
      <Skeleton className={cn("shrink-0 rounded-lg", dense ? "size-7" : "size-9")} />
      <div className="min-w-0 space-y-1.5">
        <Skeleton className={cn(dense ? "h-2.5 w-14" : "h-3 w-16")} />
        <Skeleton className={cn(dense ? "h-3.5 w-16" : "h-4 w-20")} />
      </div>
    </div>
  );
}

export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  health,
  loading,
  tooltip,
  compact,
  dense,
  fluid,
  accentKey,
  accentClass,
  valueSemantic,
  valueNumeric,
  valueClassName,
  valueAlert,
  alert,
  className,
}: KpiCardProps) {
  if (loading) {
    return <KpiCardSkeleton compact={compact} dense={dense} fluid={fluid} />;
  }

  const legacyAlert = valueAlert ?? alert;
  const resolvedValueClass = resolveKpiValueClassName({
    valueClassName,
    health,
    valueSemantic,
    valueNumeric,
    legacyAlert,
  });

  const cardBody = (
    <div
      className={cn(
        dense ? KPI_STRIP_CARD_CLASS_DENSE : KPI_STRIP_CARD_CLASS,
        fluid
          ? KPI_STRIP_CARD_WIDTH_FLUID
          : compact
            ? KPI_STRIP_CARD_WIDTH_COMPACT
            : KPI_STRIP_CARD_WIDTH,
        className,
      )}
    >
      {dense ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className={KPI_CARD_LABEL_CLASS}>{title}</p>
            {Icon ? (
              <div
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-md",
                  resolveKpiAccentClass(accentKey, accentClass),
                )}
              >
                <Icon className="size-2.5" />
              </div>
            ) : health ? (
              <HealthIndicator tone={health} aria-label={`Status: ${health}`} />
            ) : null}
          </div>
          <p className={cn(KPI_CARD_VALUE_CLASS, resolvedValueClass)}>{value}</p>
          {subtitle ? (
            <p className="truncate text-[10px] text-muted-foreground">{subtitle}</p>
          ) : null}
          {trend ? <KpiTrendIndicator trend={trend} /> : null}
        </>
      ) : (
        <>
          {Icon ? (
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-lg",
                compact ? "size-8" : "size-9",
                resolveKpiAccentClass(accentKey, accentClass),
              )}
            >
              <Icon className={compact ? "size-3.5" : "size-4"} />
            </div>
          ) : health ? (
            <div
              className={cn(
                "flex shrink-0 items-center justify-center",
                compact ? "size-8" : "size-9",
              )}
            >
              <HealthIndicator tone={health} aria-label={`Status: ${health}`} />
            </div>
          ) : null}
          <div className="min-w-0">
            <p className={KPI_CARD_LABEL_CLASS}>{title}</p>
            <p className={cn(KPI_CARD_VALUE_CLASS_SCROLL, resolvedValueClass)}>{value}</p>
            {subtitle ? (
              <p className="truncate text-[10px] text-muted-foreground">{subtitle}</p>
            ) : null}
            {trend ? <KpiTrendIndicator trend={trend} /> : null}
          </div>
        </>
      )}
    </div>
  );

  if (!tooltip) return cardBody;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{cardBody}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export type KpiCarouselItem = {
  id: string;
  label: string;
  value: string;
  icon: LucideIcon;
  accentClass?: string;
  accentKey?: KpiCardProps["accentKey"];
  valueSemantic?: OperationalKpiValueSemantic;
  valueNumeric?: number;
  subtext?: string;
  valueAlert?: "warning" | "danger";
  valueClassName?: string;
  alert?: "warning" | "danger";
  tooltip?: string;
  compact?: boolean;
  dense?: boolean;
  fluid?: boolean;
  trend?: KpiTrend;
  health?: KpiHealthTone;
};

export function kpiCarouselItemToCardProps(
  item: KpiCarouselItem,
  stripOptions?: { dense?: boolean; fluid?: boolean },
): KpiCardProps {
  return {
    id: item.id,
    title: item.label,
    value: item.value,
    subtitle: item.subtext,
    icon: item.icon,
    accentClass: item.accentClass,
    accentKey: item.accentKey,
    valueSemantic: item.valueSemantic,
    valueNumeric: item.valueNumeric,
    valueClassName: item.valueClassName,
    valueAlert: item.valueAlert ?? item.alert,
    tooltip: item.tooltip,
    compact: item.compact,
    dense: item.dense ?? stripOptions?.dense,
    fluid: item.fluid ?? stripOptions?.fluid,
    trend: item.trend,
    health: item.health,
  };
}

export function KpiCardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-wrap gap-2", className)}>{children}</div>
  );
}
