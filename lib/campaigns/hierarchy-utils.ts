import {
  deliverableTypeLabel,
  deliverableTypeShortLabel,
} from "@/lib/campaigns/deliverable-taxonomy";
import {
  PLATFORM_SHORT_LABELS,
  isSocialPlatform,
  type SocialPlatform,
} from "@/lib/social/platforms";

export function platformShortLabel(platform: string | null | undefined): string {
  const value = typeof platform === "string" && platform.trim() ? platform.trim() : "other";
  if (isSocialPlatform(value)) {
    return PLATFORM_SHORT_LABELS[value as SocialPlatform];
  }
  if (value === "multi") return "Multi";
  return value.slice(0, 2).toUpperCase();
}

export function deliverableTagLabel(type: string): string {
  return deliverableTypeShortLabel(type);
}

function titleCaseWords(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Child grid Type column — e.g. Instagram Story, TikTok Video (no platform duplication). */
export function assignmentChildTypeLabel(
  deliverableType: string,
  fallbackLabel?: string | null
): string {
  const raw = fallbackLabel?.trim() || deliverableTypeLabel(deliverableType);
  return titleCaseWords(raw);
}

/**
 * Type label when a platform avatar is shown beside it — drop redundant platform prefixes
 * (e.g. "Instagram Reel" → "Reel", "Ig Story Set" → "Story Set").
 */
export function assignmentChildTypeLabelBesidePlatform(
  deliverableType: string,
  fallbackLabel?: string | null
): string {
  const full = assignmentChildTypeLabel(deliverableType, fallbackLabel);
  const stripped = full
    .replace(/^(Instagram|TikTok|YouTube|Facebook|Snapchat|Ig|Tt|Yt|Fb|Sc)\s+/i, "")
    .trim();
  return stripped || full;
}

export const HIERARCHY_COLUMN_LABELS = {
  expand: "",
  select: "",
  assignment: "Assignment",
  creator: "Creator",
  platforms: "Platforms",
  deliverables: "Deliv.",
  postingDates: "Dates",
  costCurrency: "CCY",
  revenue: "Rev",
  usageRights: "UR Rev",
  agencyFeePercent: "AF %",
  agencyFee: "AF",
  cost: "Cost",
  usageRightsCost: "UR Cost",
  vat: "VAT",
  totalBilling: "Total billing",
  gp: "GP",
  margin: "MGN",
  opsStatus: "OPS",
  billing: "Billing",
  payout: "Payment",
  actions: "",
} as const;

export const CHILD_COLUMN_LABELS = {
  select: "",
  tag: "Type",
  platform: "Platform",
  postingDate: "Post date",
  qty: "Qty",
  unitRevenue: "Unit rev",
  unitCost: "Unit cost",
  revenue: "Rev",
  usageRights: "UR Rev",
  agencyFeePercent: "AF %",
  agencyFee: "AF",
  cost: "Cost",
  usageRightsCost: "UR Cost",
  vat: "VAT",
  totalBilling: "Total Billing",
  billing: "Billing",
  invoice: "Invoice",
  collection: "Collection",
  payout: "Payout",
  workflow: "Workflow",
  actions: "",
} as const;

export const SCHEDULE_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "awaiting_approval", label: "Awaiting approval" },
  { value: "approved", label: "Approved" },
  { value: "posted", label: "Posted" },
  { value: "verified", label: "Verified" },
  { value: "cancelled", label: "Cancelled" },
] as const;

/** Parent column ids for child leading cols 1–9 (Assignment … Rev). */
export const ASSIGNMENT_CHILD_LEADING_PARENT_COLUMN_IDS = [
  "expand",
  "select",
  "assignment",
  "creator",
  "platforms",
  "deliverables",
  "postingDates",
  "costCurrency",
  "revenue",
] as const;

const PARENT_TO_CHILD_LEADING_COLUMN_ID: Record<
  (typeof ASSIGNMENT_CHILD_LEADING_PARENT_COLUMN_IDS)[number],
  string
> = {
  expand: "expand",
  select: "select",
  assignment: "type",
  creator: "platform",
  platforms: "qty",
  deliverables: "revPerAd",
  postingDates: "costPerAd",
  costCurrency: "ccy",
  revenue: "rev",
};

export function assignmentParentToChildLeadingColumnId(parentColumnId: string): string | null {
  return PARENT_TO_CHILD_LEADING_COLUMN_ID[
    parentColumnId as (typeof ASSIGNMENT_CHILD_LEADING_PARENT_COLUMN_IDS)[number]
  ] ?? null;
}

/** Parent financial cols aligned with child UR Rev … Cost. */
export const ASSIGNMENT_CHILD_TRAILING_PARENT_FINANCIAL_COLUMN_IDS = [
  "usageRights",
  "agencyFeePercent",
  "agencyFee",
  "cost",
  "usageRightsCost",
  "vat",
  "totalBilling",
] as const;

export const ASSIGNMENT_CHILD_ROW_COL_COUNT_WITH_EXPAND = 24;
export const ASSIGNMENT_CHILD_ROW_COL_COUNT = 23;

export function assignmentChildLeadingParentColumnIds(
  showExpandColumn: boolean
): readonly string[] {
  return showExpandColumn
    ? ASSIGNMENT_CHILD_LEADING_PARENT_COLUMN_IDS
    : ASSIGNMENT_CHILD_LEADING_PARENT_COLUMN_IDS.filter((id) => id !== "expand");
}

export function assignmentChildRowColSpan(showExpandColumn: boolean): number {
  return showExpandColumn
    ? ASSIGNMENT_CHILD_ROW_COL_COUNT_WITH_EXPAND
    : ASSIGNMENT_CHILD_ROW_COL_COUNT;
}

export function childGridLeadingColumnCount(showExpandColumn: boolean): number {
  return showExpandColumn ? 9 : 8;
}

/** `data-assignment-col` value for parent grid cells (width measurement). */
export function assignmentParentColDataAttr(columnId: string) {
  return { "data-assignment-col": columnId } as const;
}

/** `data-child-col` value for child grid leading cells (alignment + accent). */
export function assignmentChildColDataAttr(childColumnId: string) {
  return { "data-child-col": childColumnId } as const;
}
