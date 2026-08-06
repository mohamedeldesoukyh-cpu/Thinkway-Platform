import type { OperationalTableColumnMeta } from "@/lib/tables/operational-table-column-settings";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

export const ASSIGNMENT_GRID_PARENT_TABLE_ID = OPERATIONAL_TABLE_IDS.campaignAssignmentGrid;
export const ASSIGNMENT_GRID_CHILD_TABLE_ID = OPERATIONAL_TABLE_IDS.campaignAssignmentGridChild;

export const ASSIGNMENT_GRID_COLUMN_METAS: OperationalTableColumnMeta[] = [
  { id: "expand", label: "Expand", locked: true },
  { id: "select", label: "Select", locked: true },
  { id: "assignment", label: "Assignment" },
  { id: "creator", label: "Creator" },
  { id: "platforms", label: "Platforms" },
  { id: "deliverables", label: "Deliverables" },
  { id: "fullDescription", label: "Full Description" },
  { id: "postingDates", label: "Dates" },
  { id: "costCurrency", label: "CCY" },
  { id: "revenue", label: "Revenue" },
  { id: "usageRights", label: "UR Rev" },
  { id: "agencyFeePercent", label: "AF %" },
  { id: "agencyFee", label: "AF" },
  { id: "cost", label: "Cost" },
  { id: "usageRightsCost", label: "UR Cost" },
  { id: "vat", label: "VAT" },
  { id: "totalBilling", label: "Total billing" },
  { id: "gp", label: "GP" },
  { id: "margin", label: "MGN" },
  { id: "opsStatus", label: "OPS" },
  { id: "billing", label: "Billing" },
  { id: "payout", label: "Payment" },
  { id: "actions", label: "Actions", locked: true },
];

/** Deliverable (child) row columns — order matches OperationalGridHeader / EditablePostRow. */
export const ASSIGNMENT_CHILD_GRID_COLUMN_METAS: OperationalTableColumnMeta[] = [
  { id: "expand", label: "Expand", locked: true },
  { id: "select", label: "Select", locked: true },
  { id: "type", label: "Type" },
  /** Kept for parent↔child width alignment; platform shown as avatar beside Type. */
  { id: "platform", label: "Platform", defaultVisible: false },
  { id: "qty", label: "Qty" },
  { id: "revPerAd", label: "Rev/ad" },
  { id: "costPerAd", label: "Cost/ad" },
  { id: "ccy", label: "CCY" },
  { id: "rev", label: "Rev" },
  { id: "usageRights", label: "UR Rev" },
  { id: "agencyFeePercent", label: "AF %" },
  { id: "agencyFee", label: "AF" },
  { id: "cost", label: "Cost" },
  { id: "usageRightsCost", label: "UR Cost" },
  { id: "vat", label: "VAT" },
  { id: "totalBilling", label: "Total Billing" },
  { id: "postDate", label: "Live ad date" },
  { id: "liveAdMonth", label: "Month" },
  { id: "invoice", label: "Invoice" },
  { id: "billing", label: "Billing" },
  { id: "collection", label: "Collection" },
  { id: "payout", label: "Payout" },
  { id: "workflow", label: "Workflow" },
  { id: "actions", label: "Actions", locked: true },
];
