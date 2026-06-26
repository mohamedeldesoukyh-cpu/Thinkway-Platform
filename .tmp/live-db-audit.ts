import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {
    /* ignore */
  }
  return out;
}

const env = { ...readEnv(".env"), ...readEnv(".env.local") };
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
console.log("url present:", Boolean(url), "key present:", Boolean(key));

const supabase = createClient(url, key, { auth: { persistSession: false } });

const IMPORTED_USERNAMES = [
  "wafasyedofficial",
  "monicamedhat__",
  "halasamirofficial",
  "_tamany_officiall",
  "rooh_hassann",
  "ali.iannacone",
  "sola_omar15",
  "razanejammal",
  "zeinazee_1",
  "monaelshazly.official",
  "jumana.mourad",
  "sera_yusuf",
  "arwakassem129",
  "ittsfarahh",
  "dr_daliaabdelghany",
  "fatema_abdelkareem",
  "tasnim_zeitoun",
  "hindmedhattfaroukk",
  "salmaelgabry17",
  "iman_alabagouri",
];

async function main() {
  const { data: importFiles, error: ifErr } = await supabase
    .from("creator_import_files")
    .select(
      "id, filename, status, total_creators, imported_creators, updated_creators, processing_completed_at"
    )
    .order("processing_completed_at", { ascending: false })
    .limit(5);
  console.log("\n=== recent creator_import_files ===");
  console.log(ifErr?.message ?? JSON.stringify(importFiles, null, 2));

  const { data: accounts, error: accErr } = await supabase
    .from("influencer_platform_accounts")
    .select("influencer_id, username, platform, metadata, sync_source")
    .in("username", IMPORTED_USERNAMES);
  console.log("\n=== platform accounts (by imported username) ===");
  console.log("error:", accErr?.message ?? null, "count:", accounts?.length ?? 0);

  const infIds = [...new Set((accounts ?? []).map((a) => a.influencer_id))];

  const { data: influencers, error: infErr } = infIds.length
    ? await supabase
        .from("influencers")
        .select("id, display_name, categories, status, country_code")
        .in("id", infIds)
    : { data: [], error: null };
  console.log("\n=== influencers.categories ===");
  console.log("error:", infErr?.message ?? null);
  for (const row of influencers ?? []) {
    console.log(
      JSON.stringify({
        display_name: row.display_name,
        status: row.status,
        categories: row.categories,
        cat_len: row.categories?.length ?? 0,
      })
    );
  }

  console.log("\n=== account metadata categories / audience_interests ===");
  for (const a of accounts ?? []) {
    const meta = (a.metadata as Record<string, unknown>) ?? {};
    console.log(
      JSON.stringify({
        username: a.username,
        sync_source: a.sync_source,
        meta_categories: meta.categories,
        meta_audience_interests: meta.audience_interests,
      })
    );
  }

  // Are any stored as discovered_profiles instead?
  const { data: discovered, error: discErr } = await supabase
    .from("discovered_profiles")
    .select("id, username, influencer_id, category_tags, stage, metadata")
    .in("username", IMPORTED_USERNAMES);
  console.log("\n=== discovered_profiles match ===");
  console.log("error:", discErr?.message ?? null, "count:", discovered?.length ?? 0);
  for (const d of discovered ?? []) {
    console.log(
      JSON.stringify({
        username: d.username,
        influencer_id: d.influencer_id,
        category_tags: d.category_tags,
        stage: d.stage,
      })
    );
  }

  // Summary
  const emptyCats = (influencers ?? []).filter(
    (r) => (r.categories?.length ?? 0) === 0
  ).length;
  const metaHasInterests = (accounts ?? []).filter((a) => {
    const meta = (a.metadata as Record<string, unknown>) ?? {};
    return Array.isArray(meta.audience_interests) && meta.audience_interests.length > 0;
  }).length;
  console.log("\n=== SUMMARY ===");
  console.log("matched accounts:", accounts?.length ?? 0);
  console.log("influencers with EMPTY categories:", emptyCats, "/", influencers?.length ?? 0);
  console.log("accounts with metadata.audience_interests populated:", metaHasInterests);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
