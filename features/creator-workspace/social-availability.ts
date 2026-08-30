/** Display-only. Phase 1 must not start OAuth or treat connection as required. */
export const CREATOR_WORKSPACE_SOCIAL_PLATFORMS = [
  "Instagram",
  "TikTok",
  "YouTube",
  "Snapchat",
  "Facebook",
  "X",
  "Pinterest",
  "LinkedIn",
] as const;

export type CreatorWorkspaceSocialPlatform =
  (typeof CREATOR_WORKSPACE_SOCIAL_PLATFORMS)[number];
