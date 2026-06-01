import { deliverableLabel } from "@/features/campaigns/line-assignment";
import {
  PLATFORM_SHORT_LABELS,
  isSocialPlatform,
  type SocialPlatform,
} from "@/lib/social/platforms";

const DELIVERABLE_TAG_SHORT: Record<string, string> = {
  instagram_post: "IG Post",
  instagram_reel: "IG Reel",
  instagram_story: "IG Story",
  tiktok_video: "TT Video",
  youtube_video: "YT Integration",
  youtube_short: "YT Short",
  other: "Other",
};

export function platformShortLabel(platform: string): string {
  if (isSocialPlatform(platform)) {
    return PLATFORM_SHORT_LABELS[platform as SocialPlatform];
  }
  if (platform === "multi") return "Multi";
  return platform.slice(0, 2).toUpperCase();
}

export function deliverableTagLabel(type: string): string {
  return DELIVERABLE_TAG_SHORT[type] ?? deliverableLabel(type);
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
  cost: "Cost",
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
