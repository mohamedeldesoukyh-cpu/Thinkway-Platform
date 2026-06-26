import type { InfluencerSearchResult } from "@/lib/domains/creator/types";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";

export function unifiedToInfluencerSearch(
  creator: UnifiedCreatorResult
): InfluencerSearchResult | null {
  if (!creator.influencer_id) return null;

  return {
    id: creator.influencer_id,
    document_number: creator.document_number ?? "",
    display_name: creator.display_name,
    status: creator.status ?? "active",
    country_code: creator.country_code,
    categories: creator.categories,
    notes: creator.notes,
    suggested_currency: creator.suggested_currency ?? DEFAULT_PLATFORM_CURRENCY,
    platforms: creator.platforms.map((p) => ({
      id: p.id,
      platform: p.platform,
      handle: p.handle,
      profile_url: p.profile_url,
      follower_count: p.follower_count,
      engagement_rate: p.engagement_rate,
      audience_country: p.audience_country,
      is_verified: p.is_verified,
    })),
  };
}

export function isAssignableCreator(creator: UnifiedCreatorResult): boolean {
  return Boolean(creator.influencer_id);
}
