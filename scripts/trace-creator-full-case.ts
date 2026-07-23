/**
 * Full audit case for a creator handle — import path, jobs, audit, actors.
 *
 *   node scripts/run-ops-script.mjs scripts/trace-creator-full-case.ts moviesiforgot
 */
import { createClient } from "@supabase/supabase-js";

const handle = (process.argv[2] ?? "").replace(/^@+/, "").trim().toLowerCase();
if (!handle) {
  console.error("Usage: trace-creator-full-case.ts <handle>");
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
  console.log(`Full case trace for @${handle}\n`);

  const { data: accounts, error: accErr } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "id, influencer_id, platform, handle, username, profile_url, created_at, last_enriched_at, enrichment_status, sync_source, apify_run_id, metadata, field_sources"
    )
    .or(
      `handle.ilike.${handle},username.ilike.${handle},normalized_username.ilike.${handle}`
    )
    .limit(5);

  if (accErr) throw new Error(accErr.message);
  if (!accounts?.length) {
    console.log("No platform account found.");
    return;
  }

  for (const account of accounts) {
    const infId = account.influencer_id;
    const apifyRunId = account.apify_run_id;

    console.log("=== Platform account ===");
    console.log(JSON.stringify(account, null, 2));

    const { data: influencer } = await supabase
      .from("influencers")
      .select(
        "id, display_name, created_by, created_at, notes, metadata, enrichment_status, last_enriched_at, enrichment_source, apify_run_id, country_code, country_codes"
      )
      .eq("id", infId)
      .maybeSingle();

    console.log("\n=== Influencer ===");
    console.log(JSON.stringify(influencer, null, 2));

    const createdBy = await loadProfile(influencer?.created_by);
    console.log("\n=== Created by (profiles) ===");
    console.log(JSON.stringify(createdBy, null, 2));

    const { data: runs } = await supabase
      .from("creator_enrichment_runs")
      .select("*")
      .eq("influencer_id", infId)
      .order("created_at", { ascending: false })
      .limit(10);

    console.log(`\n=== creator_enrichment_runs (${runs?.length ?? 0}) ===`);
    for (const run of runs ?? []) {
      const requester = await loadProfile(run.requested_by);
      console.log(JSON.stringify({ ...run, requested_by_profile: requester }, null, 2));
    }

    const { data: discovered } = await supabase
      .from("discovered_profiles")
      .select(
        "id, platform, username, influencer_id, search_id, source, metadata, created_at"
      )
      .eq("influencer_id", infId)
      .limit(5);
    console.log("\n=== discovered_profiles ===");
    console.log(JSON.stringify(discovered, null, 2));

    const { data: sources } = await supabase
      .from("creator_sources")
      .select("id, source_type, source_file_id, payload, created_at")
      .eq("influencer_id", infId)
      .limit(5);
    console.log("\n=== creator_sources ===");
    console.log(JSON.stringify(sources, null, 2));

    const { data: snapshots } = await supabase
      .from("ipl_profile_snapshots")
      .select(
        "id, provider, external_run_id, platform, created_at, metadata"
      )
      .eq("platform_account_id", account.id)
      .order("created_at", { ascending: false })
      .limit(3);
    console.log("\n=== ipl_profile_snapshots ===");
    console.log(JSON.stringify(snapshots, null, 2));

    const { data: dna } = await supabase
      .from("creator_dna")
      .select("id, last_enrichment_run_id, created_at, updated_at")
      .eq("influencer_id", infId)
      .maybeSingle();
    console.log("\n=== creator_dna ===");
    console.log(JSON.stringify(dna, null, 2));

    const { data: audits } = await supabase
      .from("audit_logs")
      .select("id, actor_id, action, entity_type, entity_id, metadata, created_at")
      .eq("entity_id", infId)
      .order("created_at", { ascending: false })
      .limit(10);
    console.log("\n=== audit_logs (entity_id = influencer) ===");
    for (const a of audits ?? []) {
      const actor = await loadProfile(a.actor_id);
      console.log(JSON.stringify({ ...a, actor }, null, 2));
    }

    if (apifyRunId) {
      const { data: jobsByRun } = await supabase
        .from("discovery_jobs")
        .select(
          "id, job_type, status, created_by, search_id, search_session_id, payload, result, created_at, started_at, completed_at"
        )
        .contains("result", { apifyRunId })
        .limit(5);
      console.log("\n=== discovery_jobs (result contains apifyRunId) ===");
      for (const j of jobsByRun ?? []) {
        const actor = await loadProfile(j.created_by);
        console.log(JSON.stringify({ ...j, created_by_profile: actor }, null, 2));
      }
    }

    const createdAt = influencer?.created_at ?? account.created_at;
    if (createdAt) {
      const windowStart = new Date(new Date(createdAt).getTime() - 5 * 60_000).toISOString();
      const windowEnd = new Date(new Date(createdAt).getTime() + 5 * 60_000).toISOString();

      const { data: nearbyJobs } = await supabase
        .from("discovery_jobs")
        .select(
          "id, job_type, status, created_by, search_id, search_session_id, payload, result, created_at"
        )
        .gte("created_at", windowStart)
        .lte("created_at", windowEnd)
        .order("created_at", { ascending: true })
        .limit(20);

      console.log(`\n=== discovery_jobs (±5min of ${createdAt}) ===`);
      for (const j of nearbyJobs ?? []) {
        const payload = JSON.stringify(j.payload ?? {});
        const result = JSON.stringify(j.result ?? {});
        const relevant =
          payload.includes(handle) ||
          result.includes(handle) ||
          (apifyRunId && (payload.includes(apifyRunId) || result.includes(apifyRunId)));
        if (relevant) {
          const actor = await loadProfile(j.created_by);
          console.log(JSON.stringify({ ...j, created_by_profile: actor }, null, 2));
        }
      }

      const searchId = discovered?.[0]?.search_id;
      if (searchId) {
        const { data: search } = await supabase
          .from("discovery_searches")
          .select("id, query, created_by, metadata, created_at")
          .eq("id", searchId)
          .maybeSingle();
        console.log("\n=== discovery_searches (from discovered_profiles.search_id) ===");
        const searchCreator = await loadProfile(search?.created_by);
        console.log(JSON.stringify({ ...search, created_by_profile: searchCreator }, null, 2));
      }
    }
  }
}

main().catch((error) => {
  console.error("TRACE FAILED:", error);
  process.exit(1);
});
