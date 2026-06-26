#!/usr/bin/env npx tsx
import { createClient } from "@supabase/supabase-js";
import { resolvePublicationEffectivePlatform } from "@/lib/performance/creator-avatar";
import {
  resolveReachSnapshot,
  computeReachForecast,
  reachMultiplierForContentType,
} from "@/lib/performance/reach-forecast-engine";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Missing env");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const campaignId = "20374f67-1c2f-4df0-b999-124a8d506c3c";

async function main() {
  const { data: pubs, error } = await supabase
    .from("campaign_publications")
    .select(
      "id, influencer_id, platform, publication_type, content_url, views, likes, comments, reach, reach_source, actual_reach, forecast_reach, metrics_provider, metrics_refresh_status"
    )
    .eq("campaign_header_id", campaignId);

  if (error) throw error;

  const influencerIds = [
    ...new Set((pubs ?? []).map((p) => p.influencer_id).filter(Boolean)),
  ] as string[];

  const { data: influencers } = await supabase
    .from("influencers")
    .select("id, display_name")
    .in("id", influencerIds);

  const names = new Map((influencers ?? []).map((i) => [i.id, i.display_name]));

  const { data: accounts } = await supabase
    .from("influencer_platform_accounts")
    .select("influencer_id, platform, follower_count, username")
    .in("influencer_id", influencerIds);

  const accountsByInf = new Map<string, typeof accounts>();
  for (const a of accounts ?? []) {
    const list = accountsByInf.get(a.influencer_id) ?? [];
    list.push(a);
    accountsByInf.set(a.influencer_id, list);
  }

  function analyze(pub: NonNullable<typeof pubs>[number]) {
    const name = names.get(pub.influencer_id ?? "") ?? "unknown";
    const effective = resolvePublicationEffectivePlatform({
      platform: pub.platform,
      publication_type: pub.publication_type,
      content_url: pub.content_url,
    });
    const infAccounts = accountsByInf.get(pub.influencer_id ?? "") ?? [];
    const account = infAccounts.find(
      (row) => canonicalPlatformKey(row.platform ?? "") === effective
    );
    const followers = account?.follower_count ?? null;
    const multiplier = reachMultiplierForContentType(pub.platform, pub.publication_type);
    const forecast = computeReachForecast({
      followers,
      platform: pub.platform,
      publication_type: pub.publication_type,
    });
    const snap = resolveReachSnapshot({
      providerReach: pub.actual_reach ?? null,
      storedReach: pub.reach,
      storedReachSource: pub.reach_source as "actual" | "forecast" | "manual" | null,
      storedActualReach: pub.actual_reach,
      storedForecastReach: pub.forecast_reach,
      followers,
      platform: pub.platform,
      publication_type: pub.publication_type,
    });
    return {
      name,
      id: pub.id,
      influencer_id: pub.influencer_id,
      platform: pub.platform,
      publication_type: pub.publication_type,
      effective_platform: effective,
      followers,
      multiplier,
      forecastReach: forecast.forecastReach,
      db_reach: pub.reach,
      db_reach_source: pub.reach_source,
      db_actual: pub.actual_reach,
      db_forecast: pub.forecast_reach,
      resolved: snap,
      views: pub.views,
      likes: pub.likes,
      metrics_provider: pub.metrics_provider,
      accounts: infAccounts,
    };
  }

  const targets = (pubs ?? []).filter((p) => {
    const n = names.get(p.influencer_id ?? "") ?? "";
    return /amir youssef|yousef ayman/i.test(n);
  });

  console.log("=== TARGET PUBLICATIONS ===");
  for (const p of targets) console.log(JSON.stringify(analyze(p), null, 2));

  console.log("\n=== ALL REACH NULL ROWS ===");
  for (const p of pubs ?? []) {
    if (p.reach == null && p.reach_source == null) {
      const a = analyze(p);
      console.log(
        JSON.stringify(
          {
            name: a.name,
            id: a.id,
            publication_type: a.publication_type,
            platform: a.platform,
            effective: a.effective_platform,
            followers: a.followers,
            multiplier: a.multiplier,
            views: a.views,
            likes: a.likes,
            influencer_id: a.influencer_id,
          },
          null,
          2
        )
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
