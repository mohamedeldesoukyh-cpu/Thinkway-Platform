import { cn } from "@/lib/utils";

/** Assignment operational grid — matches reference: light sans, tabular numbers, no mono. */
export const OPERATIONAL_TABLE_FONT = "font-sans";

/** Data sheet surface (token-based for light/dark). */
export const OPERATIONAL_TABLE_SURFACE = "bg-card";

/** Scoped CSS in `.thinkway-campaign-workspace` owns header strip styling. */
export const OPERATIONAL_TABLE_HEADER_SURFACE = "";

export const OPERATIONAL_TABLE_HEADER_ROW = "";

export const OPERATIONAL_TABLE_HEADER_CELL = "";

export const OPERATIONAL_AMOUNT_TABULAR =
  "text-[11px] tabular-nums tracking-normal";

/** Default money cells — neutral foreground. */
export const OPERATIONAL_AMOUNT_CLASS = cn(
  OPERATIONAL_AMOUNT_TABULAR,
  "font-normal text-foreground/90"
);

/** Child money cells match parent row exactly. */
export const OPERATIONAL_CHILD_AMOUNT_CLASS = OPERATIONAL_AMOUNT_CLASS;

/** Billable revenue — login blue primary. */
export const OPERATIONAL_REVENUE_AMOUNT_CLASS = cn(
  OPERATIONAL_AMOUNT_TABULAR,
  "font-medium text-primary"
);

/** Cost columns — subdued foreground. */
export const OPERATIONAL_COST_AMOUNT_CLASS = cn(
  OPERATIONAL_AMOUNT_TABULAR,
  "font-normal text-foreground/80"
);

export type OperationalAmountVariant =
  | "default"
  | "revenue"
  | "cost"
  | "gp"
  | "margin"
  | "muted";

export function operationalGpAmountClass(value: number): string {
  return cn(
    OPERATIONAL_AMOUNT_TABULAR,
    "font-medium",
    value > 0 && "text-brand-product",
    value < 0 && "text-destructive",
    value === 0 && "text-foreground/90"
  );
}

export function operationalMarginAmountClass(percent: number): string {
  return cn(
    OPERATIONAL_AMOUNT_TABULAR,
    percent < 15 ? "text-warning" : "text-muted-foreground"
  );
}

export function operationalAmountVariantClass(
  variant: OperationalAmountVariant,
  value?: number
): string {
  switch (variant) {
    case "revenue":
      return OPERATIONAL_REVENUE_AMOUNT_CLASS;
    case "cost":
      return OPERATIONAL_COST_AMOUNT_CLASS;
    case "gp":
      return operationalGpAmountClass(value ?? 0);
    case "margin":
      return operationalMarginAmountClass(value ?? 0);
    case "muted":
      return cn(OPERATIONAL_AMOUNT_TABULAR, "text-muted-foreground");
    default:
      return OPERATIONAL_AMOUNT_CLASS;
  }
}

export type OperationalKpiValueSemantic =
  | "revenue"
  | "gp"
  | "cost"
  | "margin"
  | "count";

export function operationalKpiValueClass(
  semantic: OperationalKpiValueSemantic | undefined,
  value?: number
): string | undefined {
  if (!semantic) return undefined;
  switch (semantic) {
    case "revenue":
      return "text-primary";
    case "cost":
      return "text-foreground/80";
    case "gp":
      if (value == null) return "text-brand-product";
      if (value < 0) return "text-destructive";
      if (value > 0) return "text-brand-product";
      return undefined;
    case "margin":
      if (value != null && value < 15) return "text-warning";
      return "text-muted-foreground";
    case "count":
      return "text-foreground";
    default:
      return undefined;
  }
}

/** Campaign workspace chrome — sans family; sizes match pre-operational header scale. */
export const OPERATIONAL_CHROME_TITLE = cn(
  OPERATIONAL_TABLE_FONT,
  "text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
);

export const OPERATIONAL_CHROME_META = cn(
  OPERATIONAL_TABLE_FONT,
  "text-[11px] font-normal text-muted-foreground"
);

export const OPERATIONAL_CHROME_LABEL = OPERATIONAL_CHROME_META;

/** Status / IO badges in workspace header (default badge scale). */
export const OPERATIONAL_CHROME_STATUS_BADGE = cn(
  OPERATIONAL_TABLE_FONT,
  "text-xs font-medium"
);

export const OPERATIONAL_CHROME_BADGE = cn(
  OPERATIONAL_TABLE_FONT,
  "text-[11px] font-normal"
);
