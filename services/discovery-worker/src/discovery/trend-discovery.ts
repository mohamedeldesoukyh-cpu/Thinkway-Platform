import { discoverUsernamesFromHashtagPage } from "../crawlers/platform-crawler.js";
import { supabase } from "../db/supabase.js";
import { upsertDiscoveredProfile } from "../db/profiles.js";

export async function runTrendDiscovery(input: {
  platform: "tiktok" | "instagram";
  trendKey: string;
  trendType?: "sound" | "hashtag";
  limit?: number;
}): Promise<{ discovered: number; trendId: string }> {
  const { data: trend, error } = await supabase
    .from("trend_tracking")
    .insert({
      platform: input.platform,
      trend_type: input.trendType ?? "hashtag",
      trend_key: input.trendKey,
      trend_label: input.trendKey,
      metadata: {},
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const usernames = await discoverUsernamesFromHashtagPage(
    input.platform,
    input.trendKey,
    input.limit ?? 25
  );

  let discovered = 0;
  for (const username of usernames) {
    const profileId = await upsertDiscoveredProfile(
      {
        platform: input.platform,
        username,
        profileUrl: `https://${input.platform}.com/${username}`,
      },
      "trend",
      input.trendKey
    );

    await supabase.from("discovery_sources").insert({
      profile_id: profileId,
      method: "trend",
      source_ref: input.trendKey,
      trend_id: trend.id,
      metadata: { trend_type: input.trendType ?? "hashtag" },
    });
    discovered += 1;
  }

  return { discovered, trendId: trend.id as string };
}
