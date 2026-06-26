#!/usr/bin/env node
/** One-off: enrich creator avatars for Arab Bank X La Liga campaign accounts. */
import "@/lib/performance/script-env-preload";
import { createScriptSupabase } from "@/lib/performance/script-env";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { enrichAndPersistPlatformAvatar } from "@/lib/performance/metrics-collector/persist";

const CAMPAIGN_ID = "20374f67-1c2f-4df0-b999-124a8d506c3c";

async function main() {
  const supabase = createScriptSupabase();

  const { data: pubs } = await supabase
    .from("campaign_publications")
    .select("influencer_id, platform, publication_type, content_url")
    .eq("campaign_header_id", CAMPAIGN_ID);

  const pairs = new Map<string, string>();
  for (const pub of pubs ?? []) {
    if (!pub.influencer_id) continue;
    const platform = canonicalPlatformKey(pub.platform ?? "");
    if (platform === "unknown") continue;
    pairs.set(`${pub.influencer_id}:${platform}`, pub.influencer_id);
  }

  let saved = 0;
  let skipped = 0;

  for (const key of pairs.keys()) {
    const [influencerId, platform] = key.split(":");
    const result = await enrichAndPersistPlatformAvatar(supabase, {
      influencerId: influencerId!,
      platform: platform!,
    });
    if (result.saved) {
      saved += 1;
      console.log(`✓ saved ${platform}/${influencerId!.slice(0, 8)}`);
    } else {
      skipped += 1;
      console.log(`✗ skip ${platform}/${influencerId!.slice(0, 8)} — ${result.reason}`);
    }
  }

  console.log(`\nDone: saved=${saved} skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
