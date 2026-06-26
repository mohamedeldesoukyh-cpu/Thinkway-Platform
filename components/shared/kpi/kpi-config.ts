import type { SemanticStatusTone } from "@/components/shared/status/status-config";

/** KPI health tones — subset of semantic status tokens (no hardcoded palette). */
export type KpiHealthTone = Extract<
  SemanticStatusTone,
  "success" | "warning" | "destructive" | "neutral"
>;

/** Rotating icon tile accents used across operational KPI strips. */
export type KpiAccentKey =
  | "blue"
  | "purple"
  | "pink"
  | "green"
  | "amber"
  | "neutral";

export const KPI_ACCENT_CLASS: Record<KpiAccentKey, string> = {
  blue: "bg-brand-blue/10 text-brand-blue",
  purple: "bg-brand-purple/10 text-brand-purple",
  pink: "bg-brand-pink/10 text-brand-pink",
  green: "bg-success/10 text-success",
  amber: "bg-warning/10 text-warning",
  neutral: "bg-muted text-muted-foreground",
};

/** Default accent rotation for analytics-style strips. */
export const KPI_ACCENT_CYCLE: KpiAccentKey[] = ["blue", "purple", "pink", "green"];

/** Performance-center strip accent keys (mapped to semantic brand tokens). */
export const KPI_PERFORMANCE_ACCENT: Record<
  "blue" | "green" | "purple" | "amber",
  KpiAccentKey
> = {
  blue: "blue",
  green: "green",
  purple: "purple",
  amber: "amber",
};

/** Dashboard card variant → accent tile + health (collections, planning). */
export type KpiVariantTone = "positive" | "negative" | "warning" | "neutral" | "default";

export const KPI_VARIANT_ACCENT_CLASS: Record<KpiVariantTone, string> = {
  positive: KPI_ACCENT_CLASS.green,
  negative: "bg-destructive/10 text-destructive",
  warning: KPI_ACCENT_CLASS.amber,
  neutral: KPI_ACCENT_CLASS.blue,
  default: KPI_ACCENT_CLASS.blue,
};

export const KPI_VARIANT_HEALTH: Record<KpiVariantTone, KpiHealthTone | undefined> = {
  positive: "success",
  negative: "destructive",
  warning: "warning",
  neutral: undefined,
  default: undefined,
};

/** Value text classes for explicit health tinting. */
export const KPI_HEALTH_VALUE_CLASS: Record<KpiHealthTone, string> = {
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  neutral: "text-muted-foreground",
};

/** Metric card surface classes keyed by health (aging buckets, alerts). */
export const KPI_HEALTH_SURFACE_CLASS: Record<KpiHealthTone, string> = {
  success: "border-success/40 bg-success/5",
  warning: "border-warning/40 bg-warning/5",
  destructive: "border-destructive/40 bg-destructive/5",
  neutral: "border-border bg-card",
};

export const KPI_STRIP_CARD_CLASS =
  "flex shrink-0 snap-start items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md";

export const KPI_STRIP_CARD_WIDTH = "min-w-[168px] max-w-[168px]";
export const KPI_STRIP_CARD_WIDTH_COMPACT = "min-w-[140px] max-w-[140px]";

export const KPI_LOADING_SKELETON_COUNT = 8;

export const KPI_MIXED_CURRENCY_DEFAULT_LABEL =
  "Mixed currency — totals are not FX-converted.";

/** Legacy alert aliases used by carousel items before consolidation. */
export type KpiLegacyAlert = "warning" | "danger";

export const KPI_LEGACY_ALERT_HEALTH: Record<KpiLegacyAlert, KpiHealthTone> = {
  warning: "warning",
  danger: "destructive",
};
