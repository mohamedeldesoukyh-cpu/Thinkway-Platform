#!/usr/bin/env node
import "@/lib/performance/script-env-preload";
import { createScriptSupabase } from "@/lib/performance/script-env";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { isAvatarUrlAllowedForPlatform } from "@/lib/performance/creator-avatar";
import { shouldSyncPlatformAvatar } from "@/lib/performance/avatar-sync-policy";

async function main() {
  const supabase = createScriptSupabase();

  // Recent successful Apify syncs
  const { data: logs } = await supabase
    .from("publication_metric_sync_logs")
    .select("publication_id, provider, status, response_summary, created_at")
    .eq("provider", "apify")
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(20);

  console.log("\n=== Recent Apify success logs (authorAvatarUrl) ===");
  let withAvatar = 0;
  let withoutAvatar = 0;
  for (const log of logs ?? []) {
    const summary = log.response_summary as Record<string, unknown> | null;
    const avatar = summary?.authorAvatarUrl;
    if (typeof avatar === "string" && avatar.startsWith("http")) {
      withAvatar++;
      console.log(`  ✓ pub=${log.publication_id} avatar=${avatar.slice(0, 60)}…`);
    } else {
      withoutAvatar++;
    }
  }
  console.log(`  with authorAvatarUrl: ${withAvatar}, without: ${withoutAvatar}`);

  // Platform accounts avatar state
  const { data: accounts } = await supabase
    .from("influencer_platform_accounts")
    .select("id, influencer_id, platform, handle, profile_picture_url, avatar_source, avatar_last_synced_at")
    .in("platform", ["instagram", "tiktok"])
    .limit(200);

  const stats = {
    total: accounts?.length ?? 0,
    emptyUrl: 0,
    hasUrl: 0,
    manualWithUrl: 0,
    apifySource: 0,
    discoverySource: 0,
    blockedAtDisplay: 0,
    eligibleForSync: 0,
    noAccountForPub: 0,
  };

  for (const a of accounts ?? []) {
    const url = a.profile_picture_url?.trim() ?? "";
    const platformKey = canonicalPlatformKey(a.platform ?? "");
    if (!url) stats.emptyUrl++;
    else stats.hasUrl++;
    if (a.avatar_source === "manual" && url) stats.manualWithUrl++;
    if (a.avatar_source === "apify") stats.apifySource++;
    if (a.avatar_source === "discovery") stats.discoverySource++;
    if (url && !isAvatarUrlAllowedForPlatform(platformKey, url)) stats.blockedAtDisplay++;
    if (shouldSyncPlatformAvatar(a)) stats.eligibleForSync++;
  }

  console.log("\n=== Platform accounts (instagram/tiktok sample) ===");
  console.log(JSON.stringify(stats, null, 2));

  // Publications with synced metrics but no avatar display path
  const { data: pubs } = await supabase
    .from("campaign_publications")
    .select("id, influencer_id, platform, publication_type, content_url, metrics_provider, last_synced_at")
    .not("last_synced_at", "is", null)
    .in("metrics_provider", ["apify"])
    .not("content_url", "is", null)
    .order("last_synced_at", { ascending: false })
    .limit(10);

  console.log("\n=== Recent Apify-synced publications ===");
  for (const pub of pubs ?? []) {
    const platformKey = canonicalPlatformKey(pub.platform ?? "");
    const account = (accounts ?? []).find(
      (a) =>
        a.influencer_id === pub.influencer_id &&
        canonicalPlatformKey(a.platform ?? "") === platformKey
    );
    const hasAccount = Boolean(account);
    const pic = account?.profile_picture_url?.trim() ?? "";
    const displayOk = pic && isAvatarUrlAllowedForPlatform(platformKey, pic);
    const syncBlocked =
      account &&
      !shouldSyncPlatformAvatar(account, Date.now(), {
        allowManualCrossPlatformRefresh: Boolean(
          pic && !isAvatarUrlAllowedForPlatform(platformKey, pic)
        ),
      });

    console.log(
      `  pub=${pub.id.slice(0, 8)} platform=${platformKey} account=${hasAccount ? "yes" : "NO"} ` +
        `pic=${pic ? "yes" : "empty"} displayOk=${displayOk} syncBlocked=${syncBlocked} ` +
        `source=${account?.avatar_source ?? "n/a"}`
    );
    if (!hasAccount) stats.noAccountForPub++;
  }

  // Pick one pub for live Apify test
  const testPub = pubs?.[0];
  if (testPub?.content_url) {
    console.log("\n=== Live Apify avatar test ===");
    console.log(`URL: ${testPub.content_url}`);
    const { getMetricsCollectorEnv } = await import("@/lib/performance/metrics-collector/config");
    const { tryApifyProvider } = await import("@/lib/performance/metrics-collector/providers/apify");
    const env = getMetricsCollectorEnv();
    if (!env.apifyToken) {
      console.log("APIFY_TOKEN not configured");
      return;
    }
    const platform = canonicalPlatformKey(testPub.platform ?? "instagram");
    const result = await tryApifyProvider({
      publication: { content_url: testPub.content_url },
      platform,
      contentUrl: testPub.content_url,
      env,
    });
    console.log(`status: ${result.error ? "error" : "ok"} metrics=${Boolean(result.metrics)}`);
    console.log(`authorAvatarUrl: ${result.responseSummary?.authorAvatarUrl ?? "MISSING"}`);
    console.log(`previewImageUrl: ${result.responseSummary?.previewImageUrl ? "present" : "missing"}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
