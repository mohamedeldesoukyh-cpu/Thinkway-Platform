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
  KPI_STRIP_CARD_CLASS,
  KPI_STRIP_CARD_WIDTH,
  KPI_STRIP_CARD_WIDTH_COMPACT,
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

function KpiCardSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        KPI_STRIP_CARD_CLASS,
        compact ? KPI_STRIP_CARD_WIDTH_COMPACT : KPI_STRIP_CARD_WIDTH,
      )}
    >
      <Skeleton className="size-9 shrink-0 rounded-lg" />
      <div className="min-w-0 space-y-1.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-20" />
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
    return <KpiCardSkeleton compact={compact} />;
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
        KPI_STRIP_CARD_CLASS,
        compact ? KPI_STRIP_CARD_WIDTH_COMPACT : KPI_STRIP_CARD_WIDTH,
        className,
      )}
    >
      {Icon ? (
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            resolveKpiAccentClass(accentKey, accentClass),
          )}
        >
          <Icon className="size-4" />
        </div>
      ) : health ? (
        <div className="flex size-9 shrink-0 items-center justify-center">
          <HealthIndicator tone={health} aria-label={`Status: ${health}`} />
        </div>
      ) : null}
      <div className="min-w-0">
        <p className="truncate text-[11px] text-muted-foreground">{title}</p>
        <p
          className={cn(
            "truncate font-heading text-sm font-bold tracking-tight tabular-nums",
            resolvedValueClass,
          )}
        >
          {value}
        </p>
        {subtitle ? (
          <p className="truncate text-[10px] text-muted-foreground">{subtitle}</p>
        ) : null}
        {trend ? <KpiTrendIndicator trend={trend} /> : null}
      </div>
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
  trend?: KpiTrend;
  health?: KpiHealthTone;
};

export function kpiCarouselItemToCardProps(item: KpiCarouselItem): KpiCardProps {
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
    trend: item.trend,
    health: item.health,
  };
}

export function KpiCardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-wrap gap-2", className)}>{children}</div>
  );
}
