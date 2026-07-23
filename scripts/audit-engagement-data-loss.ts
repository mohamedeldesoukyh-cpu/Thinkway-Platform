/**
 * Read-only audit: verify platform-account enrichment metrics still exist in the DB
 * (i.e. the /discovery/search "—" regression was display-only, not persisted loss).
 *
 * Usage: npx tsx scripts/audit-engagement-data-loss.ts
 */
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { count: totalAccounts, error: totalError } = await supabase
    .from("influencer_platform_accounts")
    .select("id", { count: "exact", head: true });
  if (totalError) {
    console.error("Query error:", totalError.message);
  }

  const { count: withEr } = await supabase
    .from("influencer_platform_accounts")
    .select("id", { count: "exact", head: true })
    .not("engagement_rate", "is", null);

  const { count: withFollowers } = await supabase
    .from("influencer_platform_accounts")
    .select("id", { count: "exact", head: true })
    .not("follower_count", "is", null);

  // Suspicious pattern for null-overwrite damage: ER nulled while the inputs that
  // derive it (avg_likes + followers) are still present, touched in the last 14 days.
  const cutoff = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
  const { count: suspicious, data: suspiciousRows } = await supabase
    .from("influencer_platform_accounts")
    .select("id, influencer_id, platform, handle, updated_at", { count: "exact" })
    .is("engagement_rate", null)
    .not("avg_likes", "is", null)
    .gt("follower_count", 0)
    .gte("updated_at", cutoff)
    .limit(20);

  console.log(
    JSON.stringify(
      {
        totalAccounts,
        withEngagementRate: withEr,
        withFollowers,
        recentlyUpdated_erNull_butDerivableFromAvgLikes: suspicious,
        sample: suspiciousRows,
      },
      null,
      2
    )
  );

  // Spot-check creators from the user's screenshot.
  const { data: yaser } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "influencer_id, platform, handle, follower_count, engagement_rate, avg_likes, avg_comments, avg_views, updated_at"
    )
    .or("handle.ilike.%yaser%,handle.ilike.%square_stock%")
    .limit(20);
  console.log("Spot-check (yaser / square_stock):");
  console.log(JSON.stringify(yaser, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
