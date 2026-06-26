import {
  resolveCreatorAvatarUrl,
  resolvePublicationContentPreviewUrl,
  resolvePublicationCreatorAvatar,
  resolvePublicationRowCreatorAvatar,
  type CreatorAvatarInput,
  type PublicationContentPreviewInput,
} from "@/lib/performance/creator-avatar";

export type PublicationPreviewInput = PublicationContentPreviewInput &
  CreatorAvatarInput & {
    /** @deprecated Use creator_avatar_url or resolveCreatorAvatarUrl */
    influencer_avatar_url?: string | null;
  };

/** Report/publication card preview: content only (screenshot → thumbnail). */
export function resolvePublicationPreviewUrl(row: PublicationPreviewInput): string | null {
  return resolvePublicationContentPreviewUrl(row);
}

export { resolveCreatorAvatarUrl, resolvePublicationContentPreviewUrl, resolvePublicationCreatorAvatar, resolvePublicationRowCreatorAvatar, resolveCreatorAvatarDisplay, initialsFromCreatorName };
