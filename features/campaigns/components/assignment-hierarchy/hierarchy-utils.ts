import { deliverableTypeShortLabel } from "@/lib/campaigns/deliverable-taxonomy";
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

export const HIERARCHY_COLUMN_LABELS = {
  expand: "",
  select: "",
  assignment: "Assignment",
  creator: "Creator",
  platforms: "Platforms",
  deliverables: "Deliv",
  postingDates: "Dates",
  opsStatus: "Ops",
  billing: "Billing",
  revenue: "Rev",
  costReceived: "Cost rcv",
  costCurrency: "CCY",
  costInLc: "Cost LC",
  gp: "GP",
  margin: "Mgn",
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
  cost: "Cost",
  vat: "VAT",
  billing: "Billing",
  invoice: "Invoice",
  collection: "Collection",
  payout: "Payout",
  workflow: "Workflow",
  notes: "Notes",
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
