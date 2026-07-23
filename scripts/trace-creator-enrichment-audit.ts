/**
 * Trace who requested enrichment for a creator handle.
 *
 *   node scripts/run-ops-script.mjs scripts/trace-creator-enrichment-audit.ts moviesiforgot
 */
import { createClient } from "@supabase/supabase-js";

const handle = (process.argv[2] ?? "").replace(/^@+/, "").trim().toLowerCase();
if (!handle) {
  console.error("Usage: trace-creator-enrichment-audit.ts <handle>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey?.startsWith("eyJ")) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function loadProfile(id: string | null | undefined) {
  if (!id) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", id)
    .maybeSingle();
  return data;
}

async function main() {
  console.log(`Tracing enrichment audit for handle: @${handle}\n`);

  const { data: accounts, error: accErr } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "id, influencer_id, platform, handle, username, normalized_username, profile_url, created_at, last_enriched_at, enrichment_status, sync_source, apify_run_id"
    )
    .or(
      `handle.ilike.${handle},username.ilike.${handle},normalized_username.ilike.${handle}`
    )
    .limit(10);

  if (accErr) throw new Error(accErr.message);
  if (!accounts?.length) {
    console.log("No platform account found for this handle.");
    return;
  }

  for (const account of accounts) {
    console.log("=== Platform account ===");
    console.log(JSON.stringify(account, null, 2));

    const infId = account.influencer_id;
    const { data: influencer } = await supabase
      .from("influencers")
      .select(
        "id, display_name, created_by, created_at, notes, enrichment_status, last_enriched_at, enrichment_source, enrichment_priority, apify_run_id, country_code, country_codes"
      )
      .eq("id", infId)
      .maybeSingle();

    console.log("\n=== Influencer ===");
    console.log(JSON.stringify(influencer, null, 2));

    const createdBy = await loadProfile(influencer?.created_by);
    if (createdBy) {
      console.log("\n=== Created by ===");
      console.log(JSON.stringify(createdBy, null, 2));
    }

    const { data: runs, error: runsErr } = await supabase
      .from("creator_enrichment_runs")
      .select(
        "id, trigger, priority, status, source, forced, requested_by, job_id, apify_run_id, fields_updated, skipped_reason, error_message, started_at, completed_at, created_at"
      )
      .eq("influencer_id", infId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (runsErr) throw new Error(runsErr.message);

    console.log(`\n=== Enrichment runs (${runs?.length ?? 0}) ===`);
    for (const run of runs ?? []) {
      const requester = await loadProfile(run.requested_by);
      console.log(
        JSON.stringify(
          {
            ...run,
            requested_by_profile: requester,
          },
          null,
          2
        )
      );
      console.log("---");
    }

    const { data: providerRuns } = await supabase
      .from("ipl_provider_runs")
      .select(
        "id, provider, status, external_run_id, platform, profile_url, started_at, completed_at, metadata"
      )
      .eq("influencer_id", infId)
      .order("started_at", { ascending: false })
      .limit(10);

    console.log(`\n=== IPL provider runs (${providerRuns?.length ?? 0}) ===`);
    console.log(JSON.stringify(providerRuns, null, 2));
  }
}

main().catch((error) => {
  console.error("TRACE FAILED:", error);
  process.exit(1);
});
