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

export const HIERARCHY_COLUMN_LABELS = {
  expand: "",
  select: "",
  assignment: "Assignment",
  creator: "Creator",
  platforms: "Platforms",
  deliverables: "Deliv",
  postingDates: "Dates",
  costCurrency: "CCY",
  revenue: "Rev",
  usageRights: "UR",
  agencyFeePercent: "AF %",
  agencyFee: "AF",
  cost: "Cost",
  vat: "VAT",
  totalBilling: "Total Billing",
  gp: "GP",
  margin: "Mgn",
  opsStatus: "Ops",
  billing: "Billing",
  payout: "Payout",
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
  usageRights: "UR",
  agencyFeePercent: "AF %",
  agencyFee: "AF",
  cost: "Cost",
  vat: "VAT",
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
