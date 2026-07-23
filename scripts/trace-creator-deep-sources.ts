/** Deep trace: metadata, IPL snapshots, creator_sources for handles with dashes. */
import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const HANDLES = ["square_stock", "angelika.beautyexpert", "wassoufspecial2", "yaser"];

async function main() {
  for (const handle of HANDLES) {
    console.log("\n==========", handle, "==========");
    const { data: accounts } = await supabase
      .from("influencer_platform_accounts")
      .select("*")
      .or(`handle.ilike.${handle},username.ilike.${handle}`)
      .limit(3);

    for (const account of accounts ?? []) {
      console.log("metadata:", JSON.stringify(account.metadata, null, 2)?.slice(0, 2000));
      console.log("field_sources:", JSON.stringify(account.field_sources, null, 2));

      const { data: sources } = await supabase
        .from("creator_sources")
        .select("id, source_type, payload, created_at")
        .eq("influencer_id", account.influencer_id)
        .order("created_at", { ascending: false })
        .limit(3);
      for (const src of sources ?? []) {
        const payload = src.payload as Record<string, unknown> | null;
        console.log(
          "creator_source:",
          src.source_type,
          JSON.stringify(
            {
              followers: payload?.followers ?? payload?.follower_count ?? payload?.followerCount,
              engagement: payload?.engagement_rate ?? payload?.engagementRate,
              avgLikes: payload?.avg_likes ?? payload?.avgLikes,
              keys: payload ? Object.keys(payload).slice(0, 20) : [],
            },
            null,
            2
          )
        );
      }

      const { data: snapshots } = await supabase
        .from("ipl_profile_snapshots")
        .select("id, platform, follower_count, engagement_rate, avg_likes, avg_comments, raw_payload, created_at")
        .eq("platform_account_id", account.id)
        .order("created_at", { ascending: false })
        .limit(2);
      for (const snap of snapshots ?? []) {
        console.log(
          "ipl_snapshot:",
          JSON.stringify(
            {
              created_at: snap.created_at,
              follower_count: snap.follower_count,
              engagement_rate: snap.engagement_rate,
              avg_likes: snap.avg_likes,
              raw_followers:
                (snap.raw_payload as Record<string, unknown> | null)?.followers ??
                (snap.raw_payload as Record<string, unknown> | null)?.followerCount,
            },
            null,
            2
          )
        );
      }
    }

    if (!accounts?.length) {
      const { data: inf } = await supabase
        .from("influencers")
        .select("id, display_name")
        .ilike("display_name", handle)
        .limit(3);
      console.log("orphan influencers:", JSON.stringify(inf));
    }
  }

  // Count DNA docs with avgLikes but null followers
  const { data: allDna, error } = await supabase
    .from("creator_dna")
    .select("influencer_id, document")
    .limit(5000);
  if (error) throw new Error(error.message);

  let withAvgNoFollowers = 0;
  let withFollowers = 0;
  let recoverableFromAvg = 0;
  for (const row of allDna ?? []) {
    const doc = row.document as {
      metrics?: {
        followers?: { value?: number | null };
        engagementRate?: { value?: number | null };
        avgLikes?: { value?: number | null };
        avgComments?: { value?: number | null };
      };
    };
    const followers = doc?.metrics?.followers?.value;
    const avgLikes = doc?.metrics?.avgLikes?.value;
    const avgComments = doc?.metrics?.avgComments?.value;
    const er = doc?.metrics?.engagementRate?.value;
    if (followers != null && followers > 0) withFollowers++;
    if ((avgLikes != null || avgComments != null) && (followers == null || followers <= 0)) {
      withAvgNoFollowers++;
      if (er != null && er > 0) recoverableFromAvg++;
    }
  }
  console.log("\n--- DNA population sample (first 5000 rows) ---");
  console.log({ withFollowers, withAvgNoFollowers, recoverableFromAvg, total: allDna?.length });
}

main().catch(console.error);
