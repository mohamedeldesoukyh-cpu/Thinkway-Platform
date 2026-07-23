/**
 * Repair offline Apify dataset imports missing country by:
 * 1. Demoting false `enriched` → `awaiting_profile_details`
 * 2. Queueing live Instagram profile-details enrichment (existing pipeline)
 *
 *   npm run repair:offline-import-country -- --dry-run
 *   npm run repair:offline-import-country -- --limit=50
 *   npm run repair:offline-import-country -- --execute
 *
 * Country is persisted via runCreatorEnrichment → persistCountryFromApifyProfile.
 */
import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { refreshCreatorMetrics } from "@/lib/services/creators/creator-enrichment-service";

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnv(".env.local");
loadEnv(".env");

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function argNumber(name: string, fallback: number): number {
  const hit = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (!hit) return fallback;
  const value = Number(hit.slice(name.length + 1));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function main() {
  const dryRun = hasFlag("--dry-run") || !hasFlag("--execute");
  const limit = argNumber("--limit", 200);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Offline imports with null country_code
  const { data: candidates, error } = await supabase
    .from("influencers")
    .select("id, display_name, country_code, enrichment_status, notes, metadata")
    .eq("status", "active")
    .is("country_code", null)
    .ilike("notes", "%Apify dataset export (offline)%")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows = candidates ?? [];
  const eligible: typeof rows = [];

  for (const row of rows) {
    const { data: platforms, error: platError } = await supabase
      .from("influencer_platform_accounts")
      .select("id, platform, audience_country")
      .eq("influencer_id", row.id);

    if (platError) throw new Error(platError.message);

    const hasAudience = (platforms ?? []).some((p) => Boolean(p.audience_country?.trim()));
    const isInstagram = (platforms ?? []).some(
      (p) => (p.platform ?? "").toLowerCase() === "instagram"
    );

    if (!hasAudience && isInstagram) {
      eligible.push(row);
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        limit,
        scanned: rows.length,
        eligible: eligible.length,
        sample: eligible.slice(0, 5).map((r) => ({
          id: r.id,
          name: r.display_name,
          status: r.enrichment_status,
        })),
      },
      null,
      2
    )
  );

  if (dryRun) {
    console.log("\nDry run only. Re-run with --execute to demote + queue enrichment.");
    return;
  }

  let demoted = 0;
  let queued = 0;
  let failed = 0;

  for (const row of eligible) {
    const { error: demoteError } = await supabase
      .from("influencers")
      .update({
        enrichment_status: "awaiting_profile_details",
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", row.id);

    if (demoteError) {
      console.error(`demote failed ${row.id}: ${demoteError.message}`);
      failed += 1;
      continue;
    }
    demoted += 1;

    const result = await refreshCreatorMetrics(supabase, row.id, {
      force: true,
      scope: "all",
      trigger: "manual",
      dataSource: "live_apify",
    });

    if (!result.ok) {
      failed += 1;
      console.error(`enqueue failed ${row.id}: ${result.message ?? "unknown"}`);
      continue;
    }

    queued += 1;
    console.log(
      `${result.queued ? "queued" : "ran"} ${row.display_name} (${row.id}) — ${result.message}`
    );
  }

  console.log(JSON.stringify({ demoted, queued, failed }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
