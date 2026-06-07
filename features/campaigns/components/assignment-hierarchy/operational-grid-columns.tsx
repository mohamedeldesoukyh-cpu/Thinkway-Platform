import { cn } from "@/lib/utils";

import {
  ASSIGNMENT_GRID_MONEY_COL,
  ASSIGNMENT_GRID_VAT_COL,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-column-widths";
import { OPERATIONAL_CHILD_AMOUNT_CLASS } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";

export const OPERATIONAL_GRID_LABELS = {
  select: "",
  type: "TYPE",
  platform: "PLAT",
  postDate: "Live ad Date",
  liveAdMonth: "Month",
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

const amountCell = `${OPERATIONAL_CHILD_AMOUNT_CLASS} text-right tabular-nums`;

export const GRID_CELL = {
  select: "w-7 px-1 py-0.5",
  type: "w-[140px] max-w-[140px] px-1 py-0.5",
  platform: "w-[70px] max-w-[70px] px-1 py-0.5 text-center",
  postDate: "w-[100px] px-1 py-0.5",
  liveAdMonth: "w-[56px] px-1 py-0.5 text-center",
  qty: `w-[40px] px-1 py-0.5 ${amountCell}`,
  revPerAd: cn(ASSIGNMENT_GRID_MONEY_COL, "px-1 py-0.5"),
  costPerAd: cn(ASSIGNMENT_GRID_MONEY_COL, "px-1 py-0.5"),
  money: cn(ASSIGNMENT_GRID_MONEY_COL, "px-1 py-0.5"),
  vat: cn(ASSIGNMENT_GRID_VAT_COL, "px-1 py-0.5"),
  status: "w-[72px] px-1 py-0.5",
  invoice: "w-[64px] px-1 py-0.5",
  collection: "w-[40px] px-1 py-0.5 text-[9px]",
  payout: "w-[52px] px-1 py-0.5",
  workflow: "w-[56px] px-1 py-0.5",
  actions: "w-[56px] px-1 py-0.5 text-right",
} as const;

/** Child financial emphasis — matches parent Rev/Cost styling. */
export const GRID_HIGHLIGHT_REV = cn(
  GRID_CELL.money,
  "bg-primary/8 font-semibold text-foreground"
);

export const GRID_HIGHLIGHT_COST = cn(
  GRID_CELL.money,
  "bg-amber-500/10 font-semibold text-foreground dark:bg-amber-500/15"
);
