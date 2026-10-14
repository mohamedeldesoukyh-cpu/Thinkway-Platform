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
  if (columnId === "assignment") return `${ASSIGNMENT_GRID_COLUMN_WIDTH_PX.assignment}px`;
  if (columnId === "creator") return "180px";
  if (columnId === "fullDescription") return "220px";
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
  costVatPercent: "costVatPercent",
  costVat: "costVat",
  costTotal: "costTotal",
  usageRightsCost: "usageRightsCost",
  revenueVatPercent: "revenueVatPercent",
  vat: "vat",
  totalBilling: "totalBilling",
  gp: "postDate",
  fxGainLoss: "fullDescriptionSpacer",
  margin: "liveAdMonth",
  opsStatus: "invoice",
  billing: "billing",
  payout: "payout",
  actions: "actions",
};

/** Expanded ads use their own column settings, independently of creator financial columns. */
export function visibleAdTracks(visible: (field: string) => boolean, order?: readonly string[]): string[] {
  const tracks = Object.entries(PARENT_TRACK_TO_CHILD_FIELD).filter(([track, field]) =>
    field !== "fullDescriptionSpacer" && (track === "actions" ||
      (track === "billing" && visible("collection")) || visible(field))
  ).map(([track]) => track);
  return order ? tracks.sort((a, b) => {
    const rank = (track: string) => order.indexOf(PARENT_TRACK_TO_CHILD_FIELD[track]);
    return rank(a) - rank(b);
  }) : tracks;
}

export function buildAdCssGridCols(tracks: readonly string[]): string {
  return tracks.map(track => track === "gp" ? "200px" : track === "actions" ? "100px" : assignmentCssGridTrack(track)).join(" ");
}
