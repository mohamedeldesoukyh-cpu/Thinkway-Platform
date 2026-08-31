import { listSocialProviders } from "@/lib/creator-social/providers/registry";

/** Display labels for Creator Workspace social platforms. Connection readiness lives in the provider registry. */
export const CREATOR_WORKSPACE_SOCIAL_PLATFORMS = listSocialProviders().map(
  (provider) => provider.displayName
) as readonly string[];

export type CreatorWorkspaceSocialPlatform = (typeof CREATOR_WORKSPACE_SOCIAL_PLATFORMS)[number];
