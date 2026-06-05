import { cn } from "@/lib/utils";

import { OPERATIONAL_CHILD_AMOUNT_CLASS } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";

export const OPERATIONAL_GRID_LABELS = {
  select: "",
  type: "Type",
  platform: "Plat",
  postDate: "Date",
  qty: "Qty",
  revPerAd: "Rev/ad",
  costPerAd: "Cost/ad",
  rev: "Rev",
  cost: "Cost",
  vat: "VAT",
  billing: "Billing",
  invoice: "Inv",
  collection: "Coll",
  payout: "Payout",
  workflow: "WF",
  actions: "",
} as const;

const amountCell = `${OPERATIONAL_CHILD_AMOUNT_CLASS} text-right`;

export const GRID_CELL = {
  select: "w-7 px-1 py-1",
  type: "min-w-[108px] px-1 py-1",
  platform: "w-[44px] px-1 py-1 text-center",
  postDate: "w-[96px] px-1 py-1",
  qty: `w-[40px] px-1 py-1 ${amountCell}`,
  money: `w-[68px] px-1 py-1 ${amountCell}`,
  vat: `w-[56px] px-1 py-1 ${amountCell}`,
  status: "w-[76px] px-1 py-1",
  invoice: "w-[68px] px-1 py-1",
  collection: "w-[44px] px-1 py-1 text-[9px]",
  payout: "w-[56px] px-1 py-1",
  workflow: "w-[64px] px-1 py-1",
  actions: "w-[60px] px-1 py-1 text-right",
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
