/**
 * Read-only proof trace for ONE creator through all server-side layers.
 * Does NOT modify application code. Run: npx tsx scripts/prove-discovery-search-one-creator.ts [handle]
 */
import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { creatorProfileSourceFromUnified } from "@/lib/creators/creator-profile-source";
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import { creatorAvatarBrowserDisplayUrl } from "@/lib/performance/creator-avatar";
import { creatorRecentPublicationDisplayUrl } from "@/lib/creators/recent-publication-thumb";

const HANDLE = (process.argv[2] ?? "wassoufspecial2").replace(/^@+/, "");

function loadEnv(path: string) {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv(".env.local");
loadEnv(".env");

type FieldSnapshot = {
  profile_image_url: string | null;
  primaryAvatarUrl: string | null;
  source_avatarUrl: string | null;
  avatarDisplayUrl: string | null;
  categories: string[];
  browse_category_tags: string[];
  ai_category: string | null;
  recent_publications_count: number;
  first_feed_thumb: string | null;
  display_name: string;
  bio: string | null;
  platform_followers: number | null;
  platform_engagement: number | null;
  metrics_followers: number | null;
  metrics_engagement: number | null;
  thinkway_score: number;
};

function snapshotCreator(
  creator: Parameters<typeof creatorProfileSourceFromUnified>[0],
  layer: string
): FieldSnapshot & { layer: string; unified_id: string } {
  const source = creatorProfileSourceFromUnified(creator);
  const firstPub = creator.recent_publications?.[0];
  return {
    layer,
    unified_id: creator.unified_id,
    profile_image_url: creator.profile_image_url ?? null,
    primaryAvatarUrl: creator.primaryAvatarUrl ?? null,
    source_avatarUrl: source.avatarUrl ?? null,
    avatarDisplayUrl: creatorAvatarBrowserDisplayUrl(source.avatarUrl, source.profile_url),
    categories: creator.categories ?? [],
    browse_category_tags: creator.browse_category_tags ?? [],
    ai_category: creator.ai_category ?? null,
    recent_publications_count: creator.recent_publications?.length ?? 0,
    first_feed_thumb: firstPub
      ? creatorRecentPublicationDisplayUrl(firstPub)
      : null,
    display_name: creator.display_name,
    bio: creator.bio ?? null,
    platform_followers: creator.platforms[0]?.follower_count ?? null,
    platform_engagement: creator.platforms[0]?.engagement_rate ?? null,
    metrics_followers: creator.metrics.followers.value,
    metrics_engagement: creator.metrics.engagement_rate.value,
    thinkway_score: creator.thinkway_score,
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n=== LAYER 1: DATABASE (@${HANDLE}) ===\n`);

  const { data: accounts, error: accErr } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "id, handle, profile_picture_url, follower_count, engagement_rate, recent_publications, influencer_id, influencers(id, display_name, bio, categories, primary_avatar_url, thinkway_score)"
    )
    .ilike("handle", HANDLE)
    .limit(1);

  if (accErr) {
    console.error("DB account query error:", accErr.message);
  } else if (!accounts?.length) {
    console.log("No platform account for handle — trying first active browse creator…");
    const { data: fallback } = await supabase
      .from("influencer_platform_accounts")
      .select(
        "id, handle, profile_picture_url, follower_count, engagement_rate, recent_publications, influencer_id, influencers(id, display_name, bio, categories, primary_avatar_url, thinkway_score)"
      )
      .not("follower_count", "is", null)
      .order("follower_count", { ascending: false })
      .limit(1);
    if (fallback?.[0]) {
      console.log(JSON.stringify({ fallback_handle: fallback[0].handle, row: fallback[0] }, null, 2));
    }
  } else {
    const row = accounts[0];
    const inf = row.influencers as Record<string, unknown> | null;
    const pubs = row.recent_publications;
    const pubCount = Array.isArray(pubs) ? pubs.length : 0;
    const firstThumb =
      Array.isArray(pubs) && pubs[0] && typeof pubs[0] === "object"
        ? (pubs[0] as Record<string, unknown>).thumbnail ??
          (pubs[0] as Record<string, unknown>).url ??
          null
        : null;

    let dna: Record<string, unknown> | null = null;
    if (row.influencer_id) {
      const { data: dnaRow } = await supabase
        .from("creator_dna")
        .select("document")
        .eq("influencer_id", row.influencer_id)
        .maybeSingle();
      dna = (dnaRow?.document as Record<string, unknown>) ?? null;
    }

    console.log(
      JSON.stringify(
        {
          handle: row.handle,
          influencer_id: row.influencer_id,
          display_name: inf?.display_name ?? null,
          bio: inf?.bio ?? null,
          categories: inf?.categories ?? null,
          primary_avatar_url: inf?.primary_avatar_url ?? null,
          profile_picture_url: row.profile_picture_url ?? null,
          follower_count: row.follower_count,
          engagement_rate: row.engagement_rate,
          thinkway_score: inf?.thinkway_score ?? null,
          platform_recent_publications_count: pubCount,
          first_platform_pub_thumb: firstThumb,
          dna_avatar:
            (dna?.identity as Record<string, { value?: string }>)?.avatarUrl?.value ?? null,
          dna_categories:
            (dna?.audience as Record<string, { value?: string[] }>)?.categories?.value ?? null,
          dna_recent_publications_count: Array.isArray(
            (dna?.content as Record<string, { value?: unknown[] }>)?.recentPublications?.value
          )
            ? ((dna?.content as Record<string, { value?: unknown[] }>).recentPublications?.value
                ?.length ?? 0)
            : 0,
        },
        null,
        2
      )
    );
  }

  const searchHandle =
    accounts?.[0]?.handle ??
    (
      await supabase
        .from("influencer_platform_accounts")
        .select("handle")
        .not("follower_count", "is", null)
        .order("follower_count", { ascending: false })
        .limit(1)
    ).data?.[0]?.handle ??
    HANDLE;

  console.log(`\n=== LAYER 2-3: browseUnifiedCreators search="${searchHandle}" ===\n`);

  const result = await browseUnifiedCreators(
    supabase,
    { page: 1, pageSize: 5, search: String(searchHandle), productionOnly: true },
    "discovery"
  );

  const match =
    result.creators.find((c) =>
      c.platforms.some((p) => p.handle?.toLowerCase().includes(String(searchHandle).toLowerCase()))
    ) ?? result.creators[0];

  if (!match) {
    console.log("No creators returned from browseUnifiedCreators");
    process.exit(0);
  }

  const snap = snapshotCreator(match, "browseUnifiedCreators output (post stripRecentPublicationsForBrowse)");
  console.log(JSON.stringify(snap, null, 2));

  console.log("\n=== LAYER 4: Server action would return identical JSON ===");
  console.log("(browseUnifiedCreatorsAction returns result.creators unchanged)\n");

  console.log("=== LAYER 5-6: Client pass-through (code proof) ===");
  console.log(
    JSON.stringify(
      {
        creators_state: "setCreators(filtered) — same object refs, no field stripping",
        displayCreators:
          "sortCreators(creators) → exact-match filter → hiddenUnifiedIds filter — no field mutation",
        virtual_row_props: "creator={item.creator} — full UnifiedCreatorResult passed unchanged",
      },
      null,
      2
    )
  );

  console.log("\n=== LAYER 7: CreatorSearchExactRow reads ===");
  console.log(
    JSON.stringify(
      {
        avatar: "source.avatarUrl from creatorProfileSourceFromUnified(creator)",
        avatar_src_resolved: snap.avatarDisplayUrl,
        categories_meta_WIP_fixed:
          "resolveExactRowCategoriesLabel → discoveryCreatorCategoriesLabel",
        categories_meta_original_bug:
          "creator.categories.length only (ignores inference)",
        feed: "creator.recent_publications ?? []",
        feed_count_at_row: snap.recent_publications_count,
        name: "creator.display_name",
        star: "creator.thinkway_score",
        stats: "resolveCreatorBrowsePlatformStats(creator)",
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
