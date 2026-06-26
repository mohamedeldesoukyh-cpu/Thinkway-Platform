#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { resolvePublicationEffectivePlatform } from "@/lib/performance/creator-avatar";
import {
  resolveReachSnapshot,
  computeReachForecast,
  reachMultiplierForContentType,
} from "@/lib/performance/reach-forecast-engine";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { loadPublicationEngagementContext } from "@/lib/performance/metrics-collector/persist";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Missing env", { url: !!url, key: !!key });
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const influencerId = "04628c90-859c-4286-a5e3-f7c05d108746";
const campaignId = "20374f67-1c2f-4df0-b999-124a8d506c3c";
const pubIds = [
  "02e7e3eb-649c-426a-88e6-6c456dcf541a",
  "43b60c74-383f-4efc-a997-b1d4e5b4815c",
];

async function main() {
  const { data: influencer, error: infErr } = await supabase
    .from("influencers")
    .select("id, display_name, metadata")
    .eq("id", influencerId)
    .maybeSingle();
  if (infErr) throw infErr;
  console.log("=== INFLUENCER ===");
  console.log(JSON.stringify(influencer, null, 2));

  const { data: accounts, error: accErr } = await supabase
    .from("influencer_platform_accounts")
    .select("*")
    .eq("influencer_id", influencerId);
  if (accErr) throw accErr;
  console.log("\n=== PLATFORM ACCOUNTS ===");
  console.log(JSON.stringify(accounts, null, 2));

  const handles = (accounts ?? [])
    .map((a) => a.handle ?? a.username)
    .filter(Boolean);
  if (handles.length) {
    const { data: discovered } = await supabase
      .from("discovered_profiles")
      .select("*")
      .or(handles.map((h) => `username.ilike.${h}`).join(","));
    console.log("\n=== DISCOVERED PROFILES (by handle) ===");
    console.log(JSON.stringify(discovered, null, 2));
  }

  const { data: pubs, error: pubErr } = await supabase
    .from("campaign_publications")
    .select("*")
    .in("id", pubIds);
  if (pubErr) throw pubErr;
  console.log("\n=== PUBLICATIONS ===");
  for (const pub of pubs ?? []) {
    const effective = resolvePublicationEffectivePlatform({
      platform: pub.platform,
      publication_type: pub.publication_type,
      content_url: pub.content_url,
    });
    const ctx = await loadPublicationEngagementContext(supabase, {
      publicationId: pub.id,
      campaignHeaderId: campaignId,
    });
    const account = (accounts ?? []).find(
      (row) => canonicalPlatformKey(row.platform ?? "") === effective
    );
    const forecast = computeReachForecast({
      followers: ctx.followers,
      platform: pub.platform,
      publication_type: pub.publication_type,
    });
    const snap = resolveReachSnapshot({
      providerReach: pub.actual_reach ?? null,
      storedReach: pub.reach,
      storedReachSource: pub.reach_source,
      storedActualReach: pub.actual_reach,
      storedForecastReach: pub.forecast_reach,
      followers: ctx.followers,
      platform: pub.platform,
      publication_type: pub.publication_type,
    });
    console.log(
      JSON.stringify(
        {
          id: pub.id,
          platform: pub.platform,
          publication_type: pub.publication_type,
          content_url: pub.content_url,
          effective_platform: effective,
          matched_account: account
            ? {
                platform: account.platform,
                handle: account.handle,
                follower_count: account.follower_count,
              }
            : null,
          engagement_context: ctx,
          forecast,
          reach_snapshot: snap,
          db: {
            reach: pub.reach,
            reach_source: pub.reach_source,
            actual_reach: pub.actual_reach,
            forecast_reach: pub.forecast_reach,
            views: pub.views,
            likes: pub.likes,
          },
        },
        null,
        2
      )
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
