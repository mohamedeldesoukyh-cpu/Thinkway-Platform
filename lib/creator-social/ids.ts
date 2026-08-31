export const SOCIAL_PROVIDER_IDS = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "twitter",
  "snapchat",
  "linkedin",
  "pinterest",
] as const;

export type SocialProviderId = (typeof SOCIAL_PROVIDER_IDS)[number];

export function isSocialProviderId(value: string): value is SocialProviderId {
  return (SOCIAL_PROVIDER_IDS as readonly string[]).includes(value);
}
