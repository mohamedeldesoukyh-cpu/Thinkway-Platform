import {
  creatorRecentPublicationDisplayUrl,
  shouldProxyPublicationMediaUrl,
} from "@/lib/creators/recent-publication-thumb";
import {
  resolveCreatorAvatarUrl,
  resolvePublicationContentPreviewUrl,
  resolvePublicationCreatorAvatar,
  resolvePublicationRowCreatorAvatar,
  resolveCreatorAvatarDisplay,
  initialsFromCreatorName,
  type CreatorAvatarInput,
  type PublicationContentPreviewInput,
} from "@/lib/performance/creator-avatar";

export type PublicationPreviewInput = PublicationContentPreviewInput &
  CreatorAvatarInput & {
    /** @deprecated Use creator_avatar_url or resolveCreatorAvatarUrl */
    influencer_avatar_url?: string | null;
  };

export type CampaignPublicationDisplayPreviewInput = PublicationContentPreviewInput & {
  content_url?: string | null;
};

/** Report/publication card preview: content only (screenshot → thumbnail). */
export function resolvePublicationPreviewUrl(row: PublicationPreviewInput): string | null {
  return resolvePublicationContentPreviewUrl(row);
}

/**
 * Browser display URL for campaign publication media.
 * Prefers stored screenshot/thumbnail (proxied when on social CDN), then falls
 * back to the live post URL via `/api/creators/publication-preview` (oEmbed).
 */
export function resolveCampaignPublicationDisplayPreviewUrl(
  row: CampaignPublicationDisplayPreviewInput
): string | null {
  const stored = resolvePublicationContentPreviewUrl(row);
  const contentUrl = row.content_url?.trim() || null;

  if (stored) {
    if (!shouldProxyPublicationMediaUrl(stored)) return stored;
    return creatorRecentPublicationDisplayUrl({
      thumbnail_url: stored,
      url: contentUrl,
      content_url: contentUrl,
    });
  }

  if (!contentUrl) return null;
  return creatorRecentPublicationDisplayUrl({
    url: contentUrl,
    content_url: contentUrl,
  });
}

export {
  resolveCreatorAvatarUrl,
  resolvePublicationContentPreviewUrl,
  resolvePublicationCreatorAvatar,
  resolvePublicationRowCreatorAvatar,
  resolveCreatorAvatarDisplay,
  initialsFromCreatorName,
};
