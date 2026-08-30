import { isSecretBoxConfigured } from "@/lib/security/secret-box";

import type { SocialProviderId } from "./ids";

export type SocialOAuthClientConfig = {
  clientId: string;
  clientSecret: string;
};

const CLIENT_ENV: Record<SocialProviderId, { id: string; secret: string }> = {
  instagram: {
    id: "CREATOR_SOCIAL_INSTAGRAM_CLIENT_ID",
    secret: "CREATOR_SOCIAL_INSTAGRAM_CLIENT_SECRET",
  },
  tiktok: {
    id: "CREATOR_SOCIAL_TIKTOK_CLIENT_KEY",
    secret: "CREATOR_SOCIAL_TIKTOK_CLIENT_SECRET",
  },
  youtube: {
    id: "CREATOR_SOCIAL_YOUTUBE_CLIENT_ID",
    secret: "CREATOR_SOCIAL_YOUTUBE_CLIENT_SECRET",
  },
  facebook: {
    id: "CREATOR_SOCIAL_FACEBOOK_CLIENT_ID",
    secret: "CREATOR_SOCIAL_FACEBOOK_CLIENT_SECRET",
  },
  twitter: {
    id: "CREATOR_SOCIAL_X_CLIENT_ID",
    secret: "CREATOR_SOCIAL_X_CLIENT_SECRET",
  },
  snapchat: {
    id: "CREATOR_SOCIAL_SNAPCHAT_CLIENT_ID",
    secret: "CREATOR_SOCIAL_SNAPCHAT_CLIENT_SECRET",
  },
  linkedin: {
    id: "CREATOR_SOCIAL_LINKEDIN_CLIENT_ID",
    secret: "CREATOR_SOCIAL_LINKEDIN_CLIENT_SECRET",
  },
  pinterest: {
    id: "CREATOR_SOCIAL_PINTEREST_CLIENT_ID",
    secret: "CREATOR_SOCIAL_PINTEREST_CLIENT_SECRET",
  },
};

export function readOAuthClientConfig(
  providerId: SocialProviderId
): SocialOAuthClientConfig | null {
  const keys = CLIENT_ENV[providerId];
  const clientId = process.env[keys.id]?.trim() || "";
  const clientSecret = process.env[keys.secret]?.trim() || "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isProviderIntegrationConfigured(providerId: SocialProviderId): boolean {
  return isSecretBoxConfigured() && readOAuthClientConfig(providerId) !== null;
}

export function creatorSocialCallbackPath(): string {
  return "/api/creator-social/callback";
}
