import type { SupabaseClient } from "@supabase/supabase-js";

import { searchDiscoveredProfiles } from "@/lib/discovery/search";
import type { CampaignMatchRequest, CampaignMatchResult } from "@/lib/discovery/types";

function keywordScore(brief: string, profile: {
  bio: string | null;
  display_name: string | null;
  category_tags: string[];
  latest_ai_score: { brand_fit_score: number | null; niche: string | null } | null;
  latest_metrics: { engagement_rate: number | null; followers: number } | null;
}): { score: number; rationale: string } {
  const haystack = [
    profile.display_name,
    profile.bio,
    ...profile.category_tags,
    profile.latest_ai_score?.niche,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const tokens = brief
    .toLowerCase()
    .split(/[^a-z0-9\u0600-\u06FF]+/i)
    .filter((t) => t.length > 2);

  let hits = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) hits += 1;
  }

  const brandFit = profile.latest_ai_score?.brand_fit_score ?? 50;
  const engagement = profile.latest_metrics?.engagement_rate ?? 0;
  const followers = profile.latest_metrics?.followers ?? 0;

  const score = Math.min(
    100,
    Math.round(
      hits * 8 + brandFit * 0.35 + Math.min(engagement, 5) * 4 + Math.log10(followers + 1) * 3
    )
  );

  return {
    score,
    rationale: `Keyword overlap ${hits}, brand fit ${brandFit}, engagement ${engagement}%`,
  };
}

export async function matchCampaignBrief(
  supabase: SupabaseClient,
  request: CampaignMatchRequest
): Promise<CampaignMatchResult[]> {
  const limit = Math.min(request.limit ?? 20, 50);
  const search = await searchDiscoveredProfiles(supabase, {
    q: request.brief,
    platform: request.platform,
    country: request.country,
    pageSize: limit * 2,
  });

  const ranked = search.profiles
    .map((profile) => {
      const { score, rationale } = keywordScore(request.brief, profile);
      return {
        profile_id: profile.id,
        username: profile.username,
        platform: profile.platform,
        display_name: profile.display_name,
        match_score: score,
        rationale,
        predicted_performance: {
          estimated_engagement_rate: profile.latest_metrics?.engagement_rate ?? null,
          estimated_reach_band:
            (profile.latest_metrics?.followers ?? 0) >= 1_000_000
              ? "1M+"
              : (profile.latest_metrics?.followers ?? 0) >= 100_000
                ? "100K-1M"
                : "under-100K",
          brand_fit: profile.latest_ai_score?.brand_fit_score ?? null,
        },
      } satisfies CampaignMatchResult;
    })
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, limit);

  if (request.campaignHeaderId) {
    const rows = ranked.map((row) => ({
      campaign_header_id: request.campaignHeaderId,
      brief_text: request.brief,
      profile_id: row.profile_id,
      match_score: row.match_score,
      rationale: row.rationale,
      predicted_performance: row.predicted_performance,
    }));
    await supabase.from("discovery_campaign_matches").insert(rows);
  }

  return ranked;
}
