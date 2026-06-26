#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import { metricsCollectorById } from "@/lib/performance/metrics-collector/metrics-collector";
import { syncCreatorFollowersIfMissing } from "@/lib/performance/metrics-collector/persist";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const influencerId = "04628c90-859c-4286-a5e3-f7c05d108746";
const campaignId = "20374f67-1c2f-4df0-b999-124a8d506c3c";
const pubIds = [
  "02e7e3eb-649c-426a-88e6-6c456dcf541a",
  "43b60c74-383f-4efc-a997-b1d4e5b4815c",
];

async function main() {
  const { data: account } = await supabase
    .from("influencer_platform_accounts")
    .select("platform, handle, profile_url, follower_count")
    .eq("influencer_id", influencerId)
    .eq("platform", "instagram")
    .maybeSingle();

  console.log("Before IG account:", account);

  const sync = await syncCreatorFollowersIfMissing(supabase, {
    influencerId,
    platform: "instagram",
    profileUrl: account?.profile_url,
    username: account?.handle,
  });
  console.log("Sync result:", sync);

  const { data: after } = await supabase
    .from("influencer_platform_accounts")
    .select("platform, follower_count, metrics_source, sync_status")
    .eq("influencer_id", influencerId);
  console.log("Accounts after sync:", after);

  for (const publicationId of pubIds) {
    console.log(`\nRe-collecting publication ${publicationId}...`);
    const outcome = await metricsCollectorById(supabase, {
      publicationId,
      campaignHeaderId: campaignId,
      triggeredBy: "manual_refresh",
    });
    console.log("Outcome:", {
      status: outcome.status,
      message: outcome.message,
    });
  }

  const { data: pubs } = await supabase
    .from("campaign_publications")
    .select("id, reach, reach_source, forecast_reach, actual_reach")
    .in("id", pubIds);
  console.log("\nPublications after re-forecast:", pubs);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
