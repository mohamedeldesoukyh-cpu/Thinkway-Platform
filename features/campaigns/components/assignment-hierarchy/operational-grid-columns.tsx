import { cn } from "@/lib/utils";

import {
  ASSIGNMENT_GRID_MONEY_COL,
  ASSIGNMENT_GRID_VAT_COL,
  CHILD_GRID_LEADING_CELL,
  CHILD_GRID_LIVE_DATE_COL,
  CHILD_GRID_MONTH_COL,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-column-widths";
import {
  OPERATIONAL_AMOUNT_CLASS,
  OPERATIONAL_CHILD_AMOUNT_CLASS,
} from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";

export const OPERATIONAL_GRID_LABELS = {
  select: "",
  type: "TYPE",
  platform: "PLAT",
  postDate: "Live ad Date",
  liveAdMonth: "Month",
  ccy: "CCY",
  qty: "QTY",
  revPerAd: "REV/AD",
  costPerAd: "COST/AD",
  rev: "REV",
  cost: "COST",
  vat: "VAT",
  billing: "BILLING",
  invoice: "INV",
  collection: "COLL",
  payout: "PAYOUT",
  workflow: "WF",
  actions: "",
} as const;

const amountCell = `${OPERATIONAL_CHILD_AMOUNT_CLASS} text-center tabular-nums`;

export const GRID_CELL = {
  expand: CHILD_GRID_LEADING_CELL,
  select: CHILD_GRID_LEADING_CELL,
  type: cn(CHILD_GRID_LEADING_CELL, "font-normal text-foreground/90"),
  platform: CHILD_GRID_LEADING_CELL,
  qty: cn(CHILD_GRID_LEADING_CELL, amountCell),
  revPerAd: cn(CHILD_GRID_LEADING_CELL, amountCell),
  costPerAd: cn(CHILD_GRID_LEADING_CELL, amountCell),
  month: cn(CHILD_GRID_MONTH_COL, "px-1.5 py-1.5 text-center align-middle"),
  ccy: cn(CHILD_GRID_LEADING_CELL, "text-[10px] font-medium text-foreground/80"),
  postDate: cn(CHILD_GRID_LIVE_DATE_COL, "px-1.5 py-1.5 text-center align-middle"),
  leadingRev: cn(CHILD_GRID_LEADING_CELL, amountCell),
  money: cn(ASSIGNMENT_GRID_MONEY_COL, "px-1.5 py-1.5 align-middle"),
  vat: cn(ASSIGNMENT_GRID_VAT_COL, "px-1.5 py-1.5 align-middle"),
  status: "w-[72px] px-1.5 py-1.5 text-center align-middle",
  invoice: "w-[64px] px-1.5 py-1.5 text-center align-middle",
  collection: "w-[40px] px-1.5 py-1.5 text-center align-middle text-[9px]",
  payout: "w-[52px] px-1.5 py-1.5 text-center align-middle",
  workflow: "w-[56px] px-1.5 py-1.5 text-center align-middle",
  actions: "w-[56px] px-1.5 py-1.5 text-center align-middle",
} as const;

/** Child Rev/Cost — lighter tint than parent row highlights. */
export const GRID_HIGHLIGHT_REV = cn(
  GRID_CELL.money,
  OPERATIONAL_AMOUNT_CLASS,
  "bg-primary/4 font-semibold text-foreground dark:bg-primary/6"
);

export const GRID_HIGHLIGHT_COST = cn(
  GRID_CELL.money,
  OPERATIONAL_AMOUNT_CLASS,
  "bg-amber-500/5 font-semibold text-foreground dark:bg-amber-500/8"
);
