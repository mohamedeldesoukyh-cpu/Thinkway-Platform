export const OPERATIONAL_GRID_LABELS = {
  select: "",
  type: "Type",
  platform: "Plat",
  deliverableType: "Deliv type",
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
  notes: "Notes",
  actions: "",
} as const;

import { OPERATIONAL_CHILD_AMOUNT_CLASS } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";

const amountCell = `${OPERATIONAL_CHILD_AMOUNT_CLASS} text-right`;

export const GRID_CELL = {
  select: "w-7 px-1 py-1",
  type: "w-[84px] px-1 py-1",
  platform: "w-[48px] px-1 py-1",
  deliverableType: "min-w-[80px] px-1 py-1",
  postDate: "w-[96px] px-1 py-1",
  qty: `w-[40px] px-1 py-1 ${amountCell}`,
  money: `w-[68px] px-1 py-1 ${amountCell}`,
  vat: `w-[56px] px-1 py-1 ${amountCell}`,
  status: "w-[76px] px-1 py-1",
  invoice: "w-[68px] px-1 py-1",
  collection: "w-[44px] px-1 py-1 text-[9px]",
  payout: "w-[56px] px-1 py-1",
  workflow: "w-[64px] px-1 py-1",
  notes: "min-w-[72px] max-w-[100px] px-1 py-1",
  actions: "w-[60px] px-1 py-1 text-right",
} as const;
