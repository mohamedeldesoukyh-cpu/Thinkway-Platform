import {
  resolveCreatorAvatarDisplay,
  resolvePublicationContentPreviewUrl,
  resolvePublicationEffectivePlatform,
  resolvePublicationRowCreatorAvatar,
  type CreatorAvatarDisplay,
  type PublicationContentPreviewInput,
} from "@/lib/performance/creator-avatar";

export type PlatformThumbDisplay = {
  kind: "platform-icon";
  platform: string;
};

export type PublicationThumbInput = {
  platform?: string | null;
  publication_type?: string | null;
  content_url?: string | null;
};

/** THUMB column — platform logo/icon only; never creator photos. */
export function resolvePlatformThumbDisplay(input: PublicationThumbInput): PlatformThumbDisplay {
  return {
    kind: "platform-icon",
    platform: resolvePublicationEffectivePlatform(input),
  };
}

export type CreatorColumnInput = Parameters<typeof resolveCreatorAvatarDisplay>[0];

/** CREATOR column — influencer avatar chain; never platform icons. */
export function resolveCreatorColumnDisplay(input: CreatorColumnInput): CreatorAvatarDisplay {
  return resolveCreatorAvatarDisplay(input);
}

/** PREVIEW column — post content only; never creator avatars. */
export function resolvePreviewColumnUrl(row: PublicationContentPreviewInput): string | null {
  return resolvePublicationContentPreviewUrl(row);
}

/** True when preview URL is absent or distinct from the resolved creator avatar. */
export function previewAvoidsCreatorAvatar(
  row: PublicationContentPreviewInput &
    Parameters<typeof resolvePublicationRowCreatorAvatar>[0]
): boolean {
  const preview = resolvePublicationContentPreviewUrl(row);
  if (!preview) return true;
  const creator = resolvePublicationRowCreatorAvatar(row);
  return creator == null || preview !== creator;
}
