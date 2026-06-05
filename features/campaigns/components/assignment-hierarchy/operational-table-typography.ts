import { cn } from "@/lib/utils";

/** Assignment operational grid — matches reference: light sans, tabular numbers, no mono. */
export const OPERATIONAL_TABLE_FONT = "font-sans";

/** Data sheet surface (token-based for light/dark). */
export const OPERATIONAL_TABLE_SURFACE = "bg-card";

/** Column header strip — distinct from white body rows. */
export const OPERATIONAL_TABLE_HEADER_SURFACE = "bg-secondary";

export const OPERATIONAL_TABLE_HEADER_ROW = cn(
  OPERATIONAL_TABLE_HEADER_SURFACE,
  "border-0 border-b border-border/50 hover:bg-secondary"
);

export const OPERATIONAL_TABLE_HEADER_CELL =
  "h-auto align-middle py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-foreground/80";

export const OPERATIONAL_AMOUNT_CLASS =
  "text-[11px] font-normal tabular-nums tracking-normal text-foreground/90";

/** Child money cells match parent row exactly. */
export const OPERATIONAL_CHILD_AMOUNT_CLASS = OPERATIONAL_AMOUNT_CLASS;

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
