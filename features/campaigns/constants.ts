import type { CampaignStatus } from "@/types/database";
import { SUPPORTED_CURRENCIES } from "@/lib/master-data/constants";

export const CAMPAIGNS_PAGE_SIZE = 10;

export const CAMPAIGN_STATUS_OPTIONS: {
  value: CampaignStatus;
  label: string;
}[] = [
  { value: "draft", label: "Draft" },
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export const CURRENCY_OPTIONS = SUPPORTED_CURRENCIES;

export const PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "X (Twitter)" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
  { value: "multi", label: "Multi-platform" },
  { value: "other", label: "Other" },
] as const;

export const METADATA_PLATFORM_KEY = "platform";
