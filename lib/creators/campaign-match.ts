import type { SupabaseClient } from "@supabase/supabase-js";

import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import type { CampaignCreatorMatch } from "@/lib/creators/types";

export async function matchCreatorsForCampaign(
  supabase: SupabaseClient,
  input: {
    brief: string;
    campaignHeaderId?: string;
    platform?: string;
    country?: string;
    limit?: number;
    createdBy?: string;
  }
): Promise<CampaignCreatorMatch[]> {
  const limit = Math.min(input.limit ?? 15, 30);
  const browse = await browseUnifiedCreators(supabase, {
    search: input.brief,
    platform: input.platform,
    country: input.country,
    pageSize: limit * 3,
  });

  const tokens = input.brief
    .toLowerCase()
    .split(/[^a-z0-9\u0600-\u06FF]+/i)
    .filter((t) => t.length > 2);

  const ranked: CampaignCreatorMatch[] = browse.creators.map((creator) => {
    const haystack = [
      creator.display_name,
      creator.bio,
      creator.ai_category,
      creator.ai_niche,
      ...creator.categories,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const keywordHits = tokens.filter((t) => haystack.includes(t)).length;
    const nicheFit = Math.min(
      100,
      (creator.brand_fit_score ?? 50) * 0.5 + keywordHits * 12
    );
    const engagementQuality = Math.min(
      100,
      (creator.metrics.engagement_rate.value ?? 0) * 15 +
        (creator.thinkway_score * 0.25)
    );
    const authenticity = creator.authenticity_score ?? 70;
    const estimatedRoi = Math.min(
      100,
      nicheFit * 0.35 + engagementQuality * 0.35 + authenticity * 0.2 + keywordHits * 3
    );
    const matchScore = Math.round(
      nicheFit * 0.3 + engagementQuality * 0.25 + authenticity * 0.2 + estimatedRoi * 0.25
    );

    return {
      unified_id: creator.unified_id,
      display_name: creator.display_name,
      source_type: creator.source_type,
      match_score: matchScore,
      niche_fit: Math.round(nicheFit),
      engagement_quality: Math.round(engagementQuality),
      authenticity: Math.round(authenticity),
      estimated_roi: Math.round(estimatedRoi),
      rationale: `Niche fit ${Math.round(nicheFit)}, engagement ${Math.round(engagementQuality)}, authenticity ${Math.round(authenticity)}`,
      creator,
    };
  });

  const results = ranked.sort((a, b) => b.match_score - a.match_score).slice(0, limit);

  if (input.campaignHeaderId) {
    const rows = results
      .filter((r) => r.creator.discovered_profile_id)
      .map((r) => ({
        campaign_header_id: input.campaignHeaderId,
        brief_text: input.brief,
        profile_id: r.creator.discovered_profile_id,
        match_score: r.match_score,
        rationale: r.rationale,
        predicted_performance: {
          niche_fit: r.niche_fit,
          engagement_quality: r.engagement_quality,
          authenticity: r.authenticity,
          estimated_roi: r.estimated_roi,
        },
        created_by: input.createdBy ?? null,
      }));

    if (rows.length > 0) {
      await supabase.from("discovery_campaign_matches").insert(rows);
    }
  }

  return results;
}
