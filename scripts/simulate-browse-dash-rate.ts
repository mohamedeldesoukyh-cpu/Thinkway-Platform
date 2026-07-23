/** Simulate first page of browseUnifiedCreators and count dash metrics. */
import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import { resolveCreatorBrowsePlatformStats } from "@/lib/creators/resolve-browse-display-metrics";

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

function wouldShowDash(creator: Awaited<ReturnType<typeof browseUnifiedCreators>>["creators"][0]) {
  const stats = resolveCreatorBrowsePlatformStats(creator);
  const fb = stats[0]?.followers ?? null;
  const er = stats[0]?.engagement ?? null;
  return {
    name: creator.display_name,
    handle: creator.platforms[0]?.handle ?? null,
    platforms: creator.platforms.length,
    statsRows: stats,
    metricsFollowers: creator.metrics.followers.value,
    metricsEr: creator.metrics.engagement_rate.value,
    displayFollowers: fb,
    displayEr: er,
    dashFollowers: fb == null,
    dashEngagement: er == null,
  };
}

async function main() {
  const result = await browseUnifiedCreators(
    supabase,
    { page: 1, pageSize: 50, source: "all" },
    "audit"
  );

  const rows = result.creators.map(wouldShowDash);
  const dashBoth = rows.filter((r) => r.dashFollowers && r.dashEngagement);
  const hasData = rows.filter((r) => !r.dashFollowers || !r.dashEngagement);

  console.log(`Total: ${rows.length}, dash both: ${dashBoth.length}, has some data: ${hasData.length}`);
  console.log("\n--- DASH BOTH (sample) ---");
  for (const row of dashBoth.slice(0, 15)) {
    console.log(JSON.stringify(row));
  }

  const handles = ["square_stock", "angelika.beautyexpert", "wassoufspecial2", "hgabr"];
  for (const handle of handles) {
    const search = await browseUnifiedCreators(
      supabase,
      { page: 1, pageSize: 5, search: handle },
      "audit"
    );
    console.log(`\n--- search: ${handle} ---`);
    for (const c of search.creators) {
      console.log(JSON.stringify(wouldShowDash(c), null, 2));
    }
  }
}

main().catch(console.error);
