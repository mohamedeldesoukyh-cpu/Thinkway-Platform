import {
  ASSIGNMENT_GRID_COLUMN_WIDTH_PX,
  type AssignmentGridColumnWidthId,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-column-widths";
import type { AssignmentGridColumnId } from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-column-layout";

/** CSS Grid track for one parent column — shared by header, parent rows, and child rows. */
export function assignmentCssGridTrack(
  columnId: AssignmentGridColumnId
): string {
  if (columnId === "expand") return "0px";
  if (columnId === "select") return "30px";
  if (columnId === "assignment") return "minmax(160px,1.1fr)";
  if (columnId === "creator") return "minmax(108px,1fr)";
  if (columnId === "fullDescription") return "minmax(180px,1.2fr)";
  const px =
    ASSIGNMENT_GRID_COLUMN_WIDTH_PX[columnId as AssignmentGridColumnWidthId];
  return `${px ?? 72}px`;
}

export function buildAssignmentCssGridCols(
  columnIds: readonly AssignmentGridColumnId[]
): string {
  return columnIds.map(assignmentCssGridTrack).join(" ");
}

export function assignmentGridColsStyle(
  columnIds: readonly AssignmentGridColumnId[]
): { ["--cols"]: string } {
  return { ["--cols"]: buildAssignmentCssGridCols(columnIds) };
}

/**
 * Child-only fields occupy the parent tracks after Total billing
 * (GP · MGN · OPS · Billing · Payment · Actions).
 */
export const PARENT_TRACK_TO_CHILD_FIELD: Record<string, string> = {
  select: "select",
  assignment: "type",
  creator: "platform",
  platforms: "qty",
  deliverables: "revPerAd",
  fullDescription: "fullDescriptionSpacer",
  postingDates: "costPerAd",
  costCurrency: "ccy",
  revenue: "rev",
  usageRights: "usageRights",
  agencyFeePercent: "agencyFeePercent",
  agencyFee: "agencyFee",
  cost: "cost",
  usageRightsCost: "usageRightsCost",
  vat: "vat",
  totalBilling: "totalBilling",
  gp: "postDate",
  margin: "liveAdMonth",
  opsStatus: "invoice",
  billing: "billing",
  payout: "payout",
  actions: "actions",
};
