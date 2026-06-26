import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(url, key);

async function main() {
  const { data: recentImports, error: impErr } = await supabase
    .from("creator_import_files")
    .select("id, filename, source_name, updated_creators, imported_creators, status, processing_completed_at")
    .order("processing_completed_at", { ascending: false })
    .limit(5);
  console.log("recent imports error:", impErr?.message ?? null);
  console.log("recent imports:", JSON.stringify(recentImports, null, 2));

  const usernames = [
    "wafasyedofficial",
    "monicamedhat__",
    "halasamirofficial",
    "_tamany_officiall",
    "rooh_hassann",
  ];
  const { data: accounts, error: accErr } = await supabase
    .from("influencer_platform_accounts")
    .select("influencer_id, username, metadata")
    .in("username", usernames);
  console.log("accounts error:", accErr?.message ?? null);
  console.log("matched accounts:", accounts?.length ?? 0);

  const infIds = [...new Set((accounts ?? []).map((a) => a.influencer_id))];
  if (infIds.length > 0) {
    const { data: influencers } = await supabase
      .from("influencers")
      .select("id, display_name, categories, country_code, notes")
      .in("id", infIds);
    console.log("\n=== influencers.categories ===");
    for (const row of influencers ?? []) {
      console.log({
        display_name: row.display_name,
        categories: row.categories,
        categories_len: row.categories?.length ?? 0,
      });
    }
    console.log("\n=== platform account metadata ===");
    for (const row of accounts ?? []) {
      const meta = (row.metadata as Record<string, unknown>) ?? {};
      console.log({
        username: row.username,
        meta_categories: meta.categories,
        meta_audience_interests: meta.audience_interests,
      });
    }
  }

  const { count } = await supabase
    .from("influencers")
    .select("id", { count: "exact", head: true });
  console.log("\ntotal influencers:", count);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
