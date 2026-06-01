import { SOCIAL_PLATFORM_OPTIONS } from "@/lib/master-data/constants";
import type { LineInfluencerAssignment } from "@/features/campaigns/line-assignment";

/** Master-data deliverable taxonomy keyed by social platform. */
export const DELIVERABLE_TYPES_BY_PLATFORM: Record<
  string,
  readonly { value: string; label: string; shortLabel: string }[]
> = {
  instagram: [
    { value: "instagram_post", label: "Instagram post", shortLabel: "IG Post" },
    { value: "instagram_reel", label: "Instagram reel", shortLabel: "IG Reel" },
    { value: "instagram_story", label: "Instagram story", shortLabel: "IG Story" },
    { value: "instagram_live", label: "Instagram live", shortLabel: "IG Live" },
  ],
  tiktok: [
    { value: "tiktok_video", label: "TikTok video", shortLabel: "TT Video" },
    { value: "tiktok_story", label: "TikTok story", shortLabel: "TT Story" },
    { value: "tiktok_live", label: "TikTok live", shortLabel: "TT Live" },
  ],
  snapchat: [
    { value: "snapchat_story", label: "Snapchat story", shortLabel: "SC Story" },
    { value: "snapchat_spotlight", label: "Snapchat Spotlight", shortLabel: "SC Spotlight" },
  ],
  youtube: [
    { value: "youtube_video", label: "YouTube integration", shortLabel: "YT Integration" },
    { value: "youtube_short", label: "YouTube short", shortLabel: "YT Short" },
    { value: "youtube_dedicated", label: "YouTube dedicated", shortLabel: "YT Dedicated" },
  ],
  twitter: [{ value: "other", label: "Other", shortLabel: "Other" }],
  linkedin: [{ value: "other", label: "Other", shortLabel: "Other" }],
  facebook: [{ value: "other", label: "Other", shortLabel: "Other" }],
  other: [{ value: "other", label: "Other", shortLabel: "Other" }],
};

const DELIVERABLE_LABEL_INDEX = new Map<string, string>();
const DELIVERABLE_SHORT_INDEX = new Map<string, string>();

for (const types of Object.values(DELIVERABLE_TYPES_BY_PLATFORM)) {
  for (const type of types) {
    DELIVERABLE_LABEL_INDEX.set(type.value, type.label);
    DELIVERABLE_SHORT_INDEX.set(type.value, type.shortLabel);
  }
}

/** Backward-compatible map for legacy imports. */
export const PLATFORM_DELIVERABLE_CODES: Record<string, string[]> = Object.fromEntries(
  Object.entries(DELIVERABLE_TYPES_BY_PLATFORM).map(([platform, types]) => [
    platform,
    types.map((t) => t.value),
  ])
);

export function getDeliverableTypesForPlatform(platform: string) {
  return DELIVERABLE_TYPES_BY_PLATFORM[platform] ?? DELIVERABLE_TYPES_BY_PLATFORM.other;
}

export function getDeliverableTypeCodesForPlatform(platform: string): string[] {
  return getDeliverableTypesForPlatform(platform).map((t) => t.value);
}

export function deliverableTypeLabel(code: string): string {
  return DELIVERABLE_LABEL_INDEX.get(code) ?? code.replace(/_/g, " ");
}

export function deliverableTypeShortLabel(code: string): string {
  return DELIVERABLE_SHORT_INDEX.get(code) ?? deliverableTypeLabel(code);
}

export function getPlatformOptionLabel(platform: string): string {
  return SOCIAL_PLATFORM_OPTIONS.find((o) => o.value === platform)?.label ?? platform;
}

/** Platforms connected to the creator on this assignment; falls back to all social platforms. */
export function getCreatorConnectedPlatformOptions(
  assignment: LineInfluencerAssignment | null | undefined
): { value: string; label: string }[] {
  const connected = assignment?.platforms?.map((p) => p.platform) ?? [];
  const unique = [...new Set(connected.filter(Boolean))];
  if (unique.length === 0) {
    return SOCIAL_PLATFORM_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
  }
  return SOCIAL_PLATFORM_OPTIONS.filter((o) => unique.includes(o.value)).map((o) => ({
    value: o.value,
    label: o.label,
  }));
}

export const PLATFORM_BADGE_COLORS: Record<string, string> = {
  instagram: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/20",
  tiktok: "bg-slate-900/10 text-slate-900 dark:bg-slate-100/10 dark:text-slate-100 border-slate-700/20",
  snapchat: "bg-yellow-400/20 text-yellow-900 dark:text-yellow-200 border-yellow-500/30",
  youtube: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/20",
  twitter: "bg-muted text-muted-foreground border-border",
  linkedin: "bg-blue-500/10 text-blue-800 dark:text-blue-200 border-blue-500/20",
  facebook: "bg-blue-600/10 text-blue-900 dark:text-blue-200 border-blue-600/20",
  other: "bg-muted text-muted-foreground border-border",
};
