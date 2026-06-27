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
  postDate: "Live ad date",
  liveAdMonth: "Month",
  ccy: "CCY",
  qty: "QTY",
  revPerAd: "Rev/Ad",
  costPerAd: "Cost/Ad",
  rev: "Rev",
  usageRights: "UR Rev",
  agencyFeePercent: "AF %",
  agencyFee: "AF",
  cost: "Cost",
  usageRightsCost: "UR Cost",
  vat: "VAT",
  totalBilling: "Total billing",
  billing: "Billing",
  invoice: "INV",
  collection: "COLL",
  payout: "PAYOUT",
  workflow: "WF",
  actions: "",
} as const;

const amountCell = `${OPERATIONAL_CHILD_AMOUNT_CLASS} text-center tabular-nums`;

export const GRID_CELL = {
  expand: cn(CHILD_GRID_LEADING_CELL, "border-0 p-0"),
  select: cn(CHILD_GRID_LEADING_CELL, "border-0 p-0"),
  type: cn(CHILD_GRID_LEADING_CELL, "text-left font-normal text-foreground/90"),
  platform: CHILD_GRID_LEADING_CELL,
  qty: cn(CHILD_GRID_LEADING_CELL, amountCell),
  revPerAd: cn(CHILD_GRID_LEADING_CELL, amountCell),
  costPerAd: cn(CHILD_GRID_LEADING_CELL, amountCell),
  month: cn(CHILD_GRID_MONTH_COL, "px-1.5 py-1.5 text-center align-middle"),
  ccy: cn(CHILD_GRID_LEADING_CELL, "text-[10px] font-medium text-foreground/80"),
  postDate: cn(CHILD_GRID_LIVE_DATE_COL, "px-1.5 py-1.5 text-center align-middle"),
  leadingRev: cn(CHILD_GRID_LEADING_CELL, amountCell),
  usageRights: cn(ASSIGNMENT_GRID_MONEY_COL, "px-1.5 py-1.5 align-middle text-center tabular-nums"),
  agencyFeePercent: cn(ASSIGNMENT_GRID_VAT_COL, "px-1.5 py-1.5 align-middle text-center tabular-nums"),
  agencyFee: cn(ASSIGNMENT_GRID_MONEY_COL, "px-1.5 py-1.5 align-middle text-center tabular-nums"),
  money: cn(ASSIGNMENT_GRID_MONEY_COL, "px-1.5 py-1.5 align-middle"),
  usageRightsCost: cn(ASSIGNMENT_GRID_MONEY_COL, "px-1.5 py-1.5 align-middle text-center tabular-nums"),
  vat: cn(ASSIGNMENT_GRID_VAT_COL, "px-1.5 py-1.5 align-middle"),
  totalBilling: cn(ASSIGNMENT_GRID_MONEY_COL, "px-1.5 py-1.5 align-middle text-center tabular-nums"),
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

export const GRID_HIGHLIGHT_TOTAL_BILLING = cn(
  GRID_CELL.totalBilling,
  OPERATIONAL_AMOUNT_CLASS,
  "bg-sky-500/10 font-semibold text-foreground dark:bg-sky-500/12"
);
