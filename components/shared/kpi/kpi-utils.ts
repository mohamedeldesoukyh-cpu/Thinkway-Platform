import {
  operationalKpiValueClass,
  type OperationalKpiValueSemantic,
} from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { formatCurrencyAmount } from "@/lib/finance/currency-format";
import { cn } from "@/lib/utils";

import {
  KPI_ACCENT_CLASS,
  KPI_ACCENT_CYCLE,
  KPI_HEALTH_VALUE_CLASS,
  KPI_LEGACY_ALERT_HEALTH,
  KPI_VARIANT_ACCENT_CLASS,
  KPI_VARIANT_HEALTH,
  type KpiAccentKey,
  type KpiHealthTone,
  type KpiLegacyAlert,
  type KpiVariantTone,
} from "./kpi-config";

export type { OperationalKpiValueSemantic };

export type KpiTrendDirection = "up" | "down" | "flat";

export type KpiTrend = {
  label: string;
  direction?: KpiTrendDirection;
  percent?: number;
};

export function resolveKpiAccentClass(
  key: KpiAccentKey | undefined,
  override?: string,
): string {
  if (override) return override;
  if (key) return KPI_ACCENT_CLASS[key];
  return KPI_ACCENT_CLASS.neutral;
}

export function resolveKpiAccentByIndex(index: number): string {
  const key = KPI_ACCENT_CYCLE[index % KPI_ACCENT_CYCLE.length];
  return KPI_ACCENT_CLASS[key];
}

export function resolveKpiVariantAccent(variant: KpiVariantTone | undefined): string {
  return KPI_VARIANT_ACCENT_CLASS[variant ?? "default"];
}

export function resolveKpiVariantHealth(
  variant: KpiVariantTone | undefined,
): KpiHealthTone | undefined {
  return KPI_VARIANT_HEALTH[variant ?? "default"];
}

export function resolveKpiHealthFromLegacyAlert(
  alert: KpiLegacyAlert | undefined,
): KpiHealthTone | undefined {
  if (!alert) return undefined;
  return KPI_LEGACY_ALERT_HEALTH[alert];
}

/** Aging bucket severity → semantic health tone. */
export function resolveAgingBucketHealth(
  severity: "ok" | "warn" | "danger",
): KpiHealthTone {
  switch (severity) {
    case "danger":
      return "destructive";
    case "warn":
      return "warning";
    default:
      return "neutral";
  }
}

export function resolveKpiValueClassName(options: {
  valueClassName?: string;
  health?: KpiHealthTone;
  valueSemantic?: OperationalKpiValueSemantic;
  valueNumeric?: number;
  legacyAlert?: KpiLegacyAlert;
}): string | undefined {
  if (options.valueClassName) return options.valueClassName;

  const health =
    options.health ?? resolveKpiHealthFromLegacyAlert(options.legacyAlert);
  if (health) return KPI_HEALTH_VALUE_CLASS[health];

  return operationalKpiValueClass(options.valueSemantic, options.valueNumeric);
}

export function formatKpiCurrency(
  amount: number,
  currency: string | null | undefined,
  options?: { decimals?: number; mixed?: boolean },
): string {
  if (options?.mixed || !currency) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number.isFinite(amount) ? amount : 0);
  }
  return formatCurrencyAmount(amount, currency, {
    precision: "kpi",
    decimals: options?.decimals,
  });
}

export function formatKpiPercent(
  value: number,
  options?: { decimals?: number; signed?: boolean },
): string {
  const decimals = options?.decimals ?? 1;
  const safe = Number.isFinite(value) ? value : 0;
  const formatted = safe.toFixed(decimals);
  if (options?.signed && safe > 0) return `+${formatted}%`;
  if (options?.signed && safe < 0) return `−${Math.abs(safe).toFixed(decimals)}%`;
  return `${formatted}%`;
}

export function formatKpiTrendPercent(percent: number | null | undefined): string | undefined {
  if (percent == null || !Number.isFinite(percent)) return undefined;
  const sign = percent > 0 ? "+" : percent < 0 ? "−" : "";
  return `${sign}${Math.abs(percent).toFixed(1)}%`;
}

export function buildKpiTrendFromPercent(
  percent: number | null | undefined,
): KpiTrend | undefined {
  const label = formatKpiTrendPercent(percent);
  if (!label) return undefined;
  const direction: KpiTrendDirection =
    (percent ?? 0) > 0 ? "up" : (percent ?? 0) < 0 ? "down" : "flat";
  return { label, direction, percent: percent ?? undefined };
}

export function kpiMixedCurrencyNotice(
  isMixed: boolean,
  label?: string | null,
): string | undefined {
  if (!isMixed) return undefined;
  return label?.trim() || undefined;
}

export function kpiTrendChipClassName(): string {
  return cn(
    "inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground",
  );
}
