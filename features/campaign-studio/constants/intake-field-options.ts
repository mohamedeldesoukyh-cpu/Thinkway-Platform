import { COUNTRY_OPTIONS, SOCIAL_PLATFORM_OPTIONS } from "@/lib/master-data/constants";

export const INTAKE_COUNTRY_OPTIONS = COUNTRY_OPTIONS.map((option) => ({
  value: option.label,
  label: option.label,
}));

export const INTAKE_PLATFORM_OPTIONS = SOCIAL_PLATFORM_OPTIONS.map((option) => ({
  value: option.label,
  label: option.label,
}));

export const INTAKE_DELIVERABLE_OPTIONS = [
  { value: "Instagram Reels", label: "Instagram Reels" },
  { value: "Instagram Stories", label: "Instagram Stories" },
  { value: "Instagram feed posts", label: "Instagram feed posts" },
  { value: "TikTok videos", label: "TikTok videos" },
  { value: "YouTube Shorts", label: "YouTube Shorts" },
  { value: "YouTube videos", label: "YouTube videos" },
  { value: "LinkedIn posts", label: "LinkedIn posts" },
] as const;

export const INTAKE_KPI_OPTIONS = [
  { value: "Reach", label: "Reach" },
  { value: "Video views", label: "Video views" },
  { value: "Engagement rate", label: "Engagement rate" },
  { value: "Brand awareness", label: "Brand awareness" },
  { value: "Account applications", label: "Account applications" },
  { value: "New customers", label: "New customers" },
] as const;
