#!/usr/bin/env node
import "@/lib/performance/script-env-preload";
import { createScriptSupabase } from "@/lib/performance/script-env";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import {
  isAvatarUrlAllowedForPlatform,
  resolvePublicationCreatorAvatar,
  resolvePublicationEffectivePlatform,
} from "@/lib/performance/creator-avatar";
import { authorAvatarFromSyncLogSummary } from "@/lib/performance/apify-author-avatar";
import { shouldSyncPlatformAvatar } from "@/lib/performance/avatar-sync-policy";

const CAMPAIGN_ID = "20374f67-1c2f-4df0-b999-124a8d506c3c";

async function main() {
  const supabase = createScriptSupabase();

  const { data: pubs, error: pubErr } = await supabase
    .from("campaign_publications")
    .select(
      "id, influencer_id, platform, publication_type, content_url, last_synced_at, metrics_provider"
    )
    .eq("campaign_header_id", CAMPAIGN_ID);

  if (pubErr) throw pubErr;
  console.log(`\n=== Publications (${pubs?.length ?? 0}) ===`);

  const influencerIds = [...new Set((pubs ?? []).map((p) => p.influencer_id).filter(Boolean))] as string[];

  const { data: influencers } = await supabase
    .from("influencers")
    .select("id, display_name, profile_id, metadata")
    .in("id", influencerIds);

  const { data: accounts } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "influencer_id, platform, handle, profile_picture_url, avatar_source, avatar_last_synced_at"
    )
    .in("influencer_id", influencerIds);

  const pubIds = (pubs ?? []).map((p) => p.id);
  const { data: syncLogs } = await supabase
    .from("publication_metric_sync_logs")
    .select("publication_id, provider, status, response_summary, created_at")
    .in("publication_id", pubIds)
    .eq("provider", "apify")
    .order("created_at", { ascending: false });

  console.log(`\n=== Apify sync logs (sample) ===`);
  for (const log of (syncLogs ?? []).slice(0, 3)) {
    const summary = log.response_summary as Record<string, unknown> | null;
    console.log(`  pub=${(log.publication_id as string).slice(0, 8)} keys=${Object.keys(summary ?? {}).join(",")}`);
    console.log(`    authorAvatarUrl=${summary?.authorAvatarUrl ?? "MISSING"}`);
  }

  const apifyByPub = new Map<string, string>();
  for (const log of syncLogs ?? []) {
    if (apifyByPub.has(log.publication_id)) continue;
    const url = authorAvatarFromSyncLogSummary(log.response_summary);
    if (url) apifyByPub.set(log.publication_id, url);
  }

  const nameById = new Map((influencers ?? []).map((i) => [i.id, i.display_name]));
  const metaById = new Map(
    (influencers ?? []).map((i) => {
      const m = i.metadata as Record<string, unknown> | null;
      return [
        i.id,
        {
          avatar_url: typeof m?.avatar_url === "string" ? m.avatar_url : null,
          profile_image_url: typeof m?.profile_image_url === "string" ? m.profile_image_url : null,
        },
      ];
    })
  );

  for (const pub of pubs ?? []) {
    const platformKey = resolvePublicationEffectivePlatform({
      platform: pub.platform,
      publication_type: pub.publication_type,
      content_url: pub.content_url,
    });
    const name = pub.influencer_id ? nameById.get(pub.influencer_id) ?? "?" : "?";
    const account = (accounts ?? []).find(
      (a) =>
        a.influencer_id === pub.influencer_id &&
        canonicalPlatformKey(a.platform ?? "") === platformKey
    );
    const meta = pub.influencer_id ? metaById.get(pub.influencer_id) : null;
    const rawPic = account?.profile_picture_url?.trim() ?? "";
    const socialPic =
      rawPic && isAvatarUrlAllowedForPlatform(platformKey, rawPic) ? rawPic : null;
    const apifyRaw = apifyByPub.get(pub.id) ?? null;
    const apifyPic =
      apifyRaw && isAvatarUrlAllowedForPlatform(platformKey, apifyRaw) ? apifyRaw : null;

    const resolved = resolvePublicationCreatorAvatar({
      platform: platformKey,
      publication_type: pub.publication_type,
      content_url: pub.content_url,
      platform_profile_picture_url: socialPic,
      influencer_avatar_url: meta?.avatar_url ?? null,
      apify_author_avatar_url: apifyPic,
      creator_profile_image_url: meta?.profile_image_url ?? null,
    });

    const syncPolicy = account
      ? shouldSyncPlatformAvatar(account, Date.now(), {
          allowManualCrossPlatformRefresh: Boolean(
            rawPic && !isAvatarUrlAllowedForPlatform(platformKey, rawPic)
          ),
        })
      : null;

    console.log(`\n--- ${name} (${platformKey}) pub=${pub.id.slice(0, 8)} ---`);
    console.log(`  account: ${account ? "yes" : "NO"} handle=${account?.handle ?? "n/a"}`);
    console.log(`  profile_picture_url: ${rawPic ? rawPic.slice(0, 80) + "…" : "EMPTY"}`);
    console.log(`  avatar_source: ${account?.avatar_source ?? "n/a"}`);
    console.log(`  display_allowed: ${Boolean(socialPic)} blocked_ig_bleed=${Boolean(rawPic && !socialPic)}`);
    console.log(`  metadata.avatar_url: ${meta?.avatar_url?.slice(0, 60) ?? "none"}…`);
    console.log(`  apify_author_avatar: ${apifyRaw ? apifyRaw.slice(0, 60) + "…" : "none"}`);
    console.log(`  apify_display_allowed: ${Boolean(apifyPic)}`);
    console.log(`  RESOLVED: ${resolved ? resolved.slice(0, 80) + "…" : "NULL → initials/placeholder"}`);
    console.log(`  shouldSyncPlatformAvatar: ${syncPolicy}`);
    console.log(`  last_synced: ${pub.last_synced_at ?? "never"} provider=${pub.metrics_provider ?? "n/a"}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
