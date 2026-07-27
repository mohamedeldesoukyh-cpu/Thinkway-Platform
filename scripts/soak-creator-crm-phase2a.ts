/**
 * Creator CRM Phase 2A Development soak harness.
 *
 * Creates an isolated soak creator on Dev, runs promote + CRM ensure repeatedly,
 * asserts identity/DNA/CRM invariants, then cleans up.
 *
 * Usage (from repo root, with Dev service role in .env):
 *   npx tsx scripts/soak-creator-crm-phase2a.ts
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { promoteDiscoveredProfileToInfluencer } from "../lib/discovery/promote-profile";
import { CreatorDNAService } from "../features/creator-dna/services/creator-dna-service";
import { ensureCommercialCreator } from "../lib/creators/crm/ensure-commercial-creator";
import { ensureCommercialCreatorFromQuoteToCampaign } from "../lib/creators/crm/activation-helpers";
import { isCreatorCrmWritersEnabled } from "../lib/creators/crm/feature-flag";
import { createEmptyCreatorDNADocument } from "../features/creator-dna/services/document-factory";
import { wrapValue } from "../features/creator-dna/services/field-envelope";

type JsonReport = {
  ok: boolean;
  environment: string;
  supabaseProjectRef: string | null;
  writersEnabled: boolean;
  soakTag: string;
  timingsMs: Record<string, number[]>;
  observations: string[];
  checks: Array<{ id: string; pass: boolean; detail: string }>;
  cleanup: { ok: boolean; detail: string };
};

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function projectRefFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    return host.split(".")[0] ?? null;
  } catch {
    return null;
  }
}

function check(
  report: JsonReport,
  id: string,
  pass: boolean,
  detail: string
) {
  report.checks.push({ id, pass, detail });
  if (!pass) report.ok = false;
}

async function countExact(
  supabase: SupabaseClient,
  table: string,
  column: string,
  value: string
): Promise<number> {
  const { data, error } = await supabase.from(table).select(column).eq(column, value);
  if (error) {
    throw new Error(
      `${table} count failed: ${error.message || error.code || JSON.stringify(error)}`
    );
  }
  return data?.length ?? 0;
}

async function countCrmViaRest(
  supabase: SupabaseClient,
  influencerId: string
): Promise<{ profiles: number; events: number; restOk: boolean; detail: string }> {
  const profiles = await supabase
    .from("creator_crm_profiles")
    .select("influencer_id")
    .eq("influencer_id", influencerId);
  const events = await supabase
    .from("creator_crm_activation_events")
    .select("id")
    .eq("influencer_id", influencerId);
  if (profiles.error || events.error) {
    return {
      profiles: -1,
      events: -1,
      restOk: false,
      detail: `profiles=${profiles.error?.message || profiles.error?.code || "ok"}; events=${events.error?.message || events.error?.code || "ok"}`,
    };
  }
  return {
    profiles: profiles.data?.length ?? 0,
    events: events.data?.length ?? 0,
    restOk: true,
    detail: "rest ok",
  };
}

async function main() {
  loadEnvFile(resolve(".env"));
  loadEnvFile(resolve(".env.local"));
  // Force writer gate OFF for soak regardless of local overrides.
  process.env.CREATOR_CRM_WRITERS_ENABLED = "false";
  delete process.env.NEXT_PUBLIC_CREATOR_CRM_FILTER_ENABLED;
  delete process.env.CREATOR_CRM_FILTER_ENABLED;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const DEV_REF = "hsxrewjcbvmbkqdlzjhs";
  const ref = projectRefFromUrl(url);

  const report: JsonReport = {
    ok: true,
    environment: process.env.THINKWAY_ENV ?? process.env.NEXT_PUBLIC_THINKWAY_ENV ?? "unknown",
    supabaseProjectRef: ref,
    writersEnabled: isCreatorCrmWritersEnabled(),
    soakTag: `soak2a_${Date.now()}`,
    timingsMs: {
      promote: [],
      promoteStagingOnly: [],
      ensureCommercial: [],
      dualEventHelper: [],
    },
    observations: [],
    checks: [],
    cleanup: { ok: false, detail: "not run" },
  };

  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  }
  check(
    report,
    "env_is_development",
    ref === DEV_REF,
    `Expected Dev ref ${DEV_REF}, got ${ref ?? "null"}`
  );
  check(
    report,
    "writers_gate_off",
    report.writersEnabled === false,
    `CREATOR_CRM_WRITERS_ENABLED effective=${report.writersEnabled}`
  );

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const username = report.soakTag;
  const platform = "instagram";
  const profileUrl = `https://www.instagram.com/${username}/`;
  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("id")
    .limit(1)
    .maybeSingle();
  const actorId = (actorProfile?.id as string | undefined) ?? null;
  if (!actorId) {
    report.observations.push("No profiles row found — promote will use null created_by");
  }

  // Pre CRM baseline (prefer row select — head count can fail on fresh grants)
  const crmBeforeRes = await supabase.from("creator_crm_profiles").select("influencer_id");
  const eventsBeforeRes = await supabase.from("creator_crm_activation_events").select("id");
  const crmBefore = crmBeforeRes.error ? -1 : (crmBeforeRes.data?.length ?? 0);
  const eventsBefore = eventsBeforeRes.error ? -1 : (eventsBeforeRes.data?.length ?? 0);

  report.observations.push(
    `CRM baseline before soak: profiles=${crmBefore}, events=${eventsBefore}, restErr=${crmBeforeRes.error?.message || eventsBeforeRes.error?.message || "none"}`
  );

  const { data: discovered, error: dpError } = await supabase
    .from("discovered_profiles")
    .insert({
      platform,
      username,
      profile_url: profileUrl,
      display_name: `Phase2A Soak ${username}`,
      country_code: "AE",
      stage: "discovered",
      category_tags: ["soak"],
      metadata: { soak: "creator_crm_phase2a", tag: username },
    })
    .select("id")
    .single();

  if (dpError || !discovered) {
    throw new Error(`Failed to insert soak discovered_profile: ${dpError?.message}`);
  }
  const discoveredProfileId = discovered.id as string;
  report.observations.push(`Created discovered_profiles.id=${discoveredProfileId}`);

  const stagingDoc = createEmptyCreatorDNADocument();
  stagingDoc.identity.displayName = wrapValue(`Soak ${username}`, "apify", 0.92);
  stagingDoc.identity.handle = wrapValue(username, "apify", 0.95);
  stagingDoc.identity.platform = wrapValue(platform, "apify", 0.95);
  stagingDoc.metrics.followers = wrapValue(12345, "apify", 0.9);

  const { error: stagingError } = await supabase.from("creator_dna_staging").upsert(
    {
      discovered_profile_id: discoveredProfileId,
      document: stagingDoc as never,
      version: 1,
      dna_completeness_score: 12,
    } as never,
    { onConflict: "discovered_profile_id" }
  );
  if (stagingError) {
    throw new Error(`Failed to insert staging DNA: ${stagingError.message}`);
  }
  report.observations.push("Inserted creator_dna_staging with displayName/handle/followers");

  let influencerId: string | null = null;
  const promoteResults: Array<{ created: boolean; influencerId: string }> = [];

  const promoteActor =
    actorId ?? "00000000-0000-0000-0000-000000000001";

  for (let i = 1; i <= 3; i++) {
    const t0 = performance.now();
    const result = await promoteDiscoveredProfileToInfluencer(
      supabase as never,
      discoveredProfileId,
      promoteActor
    );
    report.timingsMs.promote.push(Number((performance.now() - t0).toFixed(2)));
    if (!result.ok) {
      check(report, `promote_pass_${i}`, false, result.message);
      report.observations.push(`Promote #${i} FAILED: ${result.message}`);
      break;
    }
    promoteResults.push({ created: result.created, influencerId: result.influencerId });
    influencerId = result.influencerId;
    report.observations.push(
      `Promote #${i}: created=${result.created} influencerId=${result.influencerId}`
    );
  }

  if (!influencerId) {
    await supabase.from("creator_dna_staging").delete().eq("discovered_profile_id", discoveredProfileId);
    await supabase.from("discovered_profiles").delete().eq("id", discoveredProfileId);
    console.log(JSON.stringify(report, null, 2));
    throw new Error("Promotion did not yield an influencerId");
  }

  check(
    report,
    "promote_first_creates",
    promoteResults[0]?.created === true,
    `first created=${promoteResults[0]?.created}`
  );
  check(
    report,
    "promote_subsequent_noop_created_flag",
    promoteResults.slice(1).every((r) => r.created === false),
    `created flags=${promoteResults.map((r) => r.created).join(",")}`
  );
  check(
    report,
    "single_influencer_id_stable",
    promoteResults.every((r) => r.influencerId === influencerId),
    `ids=${[...new Set(promoteResults.map((r) => r.influencerId))].join(",")}`
  );

  const influencerCount = await countExact(supabase, "influencers", "id", influencerId);
  check(
    report,
    "one_influencer_row",
    influencerCount === 1,
    `influencers rows for id=${influencerCount}`
  );

  const { count: handleDupes } = await supabase
    .from("influencer_platform_accounts")
    .select("id", { count: "exact", head: true })
    .eq("platform", platform)
    .eq("handle", username);
  check(
    report,
    "one_platform_account_for_handle",
    (handleDupes ?? 0) === 1,
    `platform accounts for handle=${handleDupes ?? 0}`
  );

  const dnaCount = await countExact(supabase, "creator_dna", "influencer_id", influencerId);
  check(report, "one_canonical_dna", dnaCount === 1, `creator_dna rows=${dnaCount}`);

  const { data: stagingAfter } = await supabase
    .from("creator_dna_staging")
    .select("promoted_to_influencer_id, promoted_at, version")
    .eq("discovered_profile_id", discoveredProfileId)
    .maybeSingle();

  check(
    report,
    "staging_marked_promoted",
    stagingAfter?.promoted_to_influencer_id === influencerId &&
      Boolean(stagingAfter?.promoted_at),
    `promoted_to=${stagingAfter?.promoted_to_influencer_id ?? "null"} at=${stagingAfter?.promoted_at ?? "null"}`
  );

  // Extra promoteStaging-only calls (idempotent)
  const dnaService = new CreatorDNAService(supabase as never);
  for (let i = 1; i <= 3; i++) {
    const t0 = performance.now();
    const stagingResult = await dnaService.promoteStaging(discoveredProfileId, influencerId);
    report.timingsMs.promoteStagingOnly.push(Number((performance.now() - t0).toFixed(2)));
    check(
      report,
      `staging_repeat_noop_${i}`,
      stagingResult.ok && stagingResult.promoted === false,
      `ok=${stagingResult.ok} promoted=${stagingResult.promoted} msg=${stagingResult.message}`
    );
  }

  const { count: dnaVersions } = await supabase
    .from("creator_dna_versions")
    .select("id", { count: "exact", head: true })
    .eq("influencer_id", influencerId);
  report.observations.push(
    `creator_dna_versions count after 3 promotes + 3 staging calls=${dnaVersions ?? 0}`
  );
  // Soft check: expect small version count (baseline + staging merge), not unbounded growth
  check(
    report,
    "dna_versions_bounded",
    (dnaVersions ?? 0) <= 6,
    `versions=${dnaVersions ?? 0} (threshold <=6 for soak)`
  );

  // Writer gate: ensure + dual-event helpers must not persist
  for (let i = 1; i <= 3; i++) {
    const t0 = performance.now();
    const ensureResult = await ensureCommercialCreator(supabase as never, {
      influencerId,
      reason: "manual_convert",
      actorId,
      roleSlug: "admin",
      bypassRoleCheck: false,
      sourceEntityType: "soak",
      sourceEntityId: discoveredProfileId,
    });
    report.timingsMs.ensureCommercial.push(Number((performance.now() - t0).toFixed(2)));
    check(
      report,
      `ensure_writers_disabled_${i}`,
      ensureResult.ok === true &&
        "writersDisabled" in ensureResult &&
        ensureResult.writersDisabled === true &&
        ensureResult.created === false,
      JSON.stringify(ensureResult)
    );
  }

  const tDual = performance.now();
  const dual = await ensureCommercialCreatorFromQuoteToCampaign(supabase as never, {
    influencerId,
    quotationId: "00000000-0000-4000-8000-000000000099",
    campaignInfluencerId: "00000000-0000-4000-8000-000000000098",
    actorId: promoteActor,
    bypassRoleCheck: true,
  });
  report.timingsMs.dualEventHelper.push(Number((performance.now() - tDual).toFixed(2)));
  check(
    report,
    "dual_event_writers_disabled",
    dual.profile.ok === true &&
      "writersDisabled" in dual.profile &&
      dual.profile.writersDisabled === true &&
      dual.quotationEventId === null &&
      dual.assignmentEventId === null,
    JSON.stringify(dual)
  );

  const crmRest = await countCrmViaRest(supabase, influencerId);
  check(
    report,
    "crm_rest_readable",
    crmRest.restOk,
    crmRest.detail
  );
  check(
    report,
    "no_crm_profile_for_soak",
    crmRest.restOk && crmRest.profiles === 0,
    `crm profiles=${crmRest.profiles}`
  );
  check(
    report,
    "no_crm_events_for_soak",
    crmRest.restOk && crmRest.events === 0,
    `crm events=${crmRest.events}`
  );

  const { data: influencerRow } = await supabase
    .from("influencers")
    .select("has_commercial_profile")
    .eq("id", influencerId)
    .maybeSingle();
  check(
    report,
    "has_commercial_profile_false",
    influencerRow?.has_commercial_profile === false,
    `has_commercial_profile=${String(influencerRow?.has_commercial_profile)}`
  );

  const crmAfterAll = await supabase.from("creator_crm_profiles").select("influencer_id");
  const eventsAfterAll = await supabase.from("creator_crm_activation_events").select("id");
  const crmAfter = crmAfterAll.error ? -1 : (crmAfterAll.data?.length ?? 0);
  const eventsAfter = eventsAfterAll.error ? -1 : (eventsAfterAll.data?.length ?? 0);
  check(
    report,
    "global_crm_unchanged",
    crmAfter === (crmBefore ?? 0) && eventsAfter === (eventsBefore ?? 0),
    `before profiles=${crmBefore} events=${eventsBefore}; after profiles=${crmAfter} events=${eventsAfter}; err=${crmAfterAll.error?.message || eventsAfterAll.error?.message || "none"}`
  );

  // Architecture: discovered profile points at identity; CRM empty
  const { data: linked } = await supabase
    .from("discovered_profiles")
    .select("influencer_id")
    .eq("id", discoveredProfileId)
    .maybeSingle();
  check(
    report,
    "discovery_links_to_identity",
    linked?.influencer_id === influencerId,
    `discovered.influencer_id=${linked?.influencer_id}`
  );

  // Cleanup soak artifacts (identity cascade should clear platform accounts / dna)
  try {
    await supabase.from("creator_dna_staging").delete().eq("discovered_profile_id", discoveredProfileId);
    await supabase.from("discovered_profiles").delete().eq("id", discoveredProfileId);
    await supabase.from("influencers").delete().eq("id", influencerId);
    report.cleanup = { ok: true, detail: `Deleted soak influencer ${influencerId} and discovered profile` };
  } catch (error) {
    report.cleanup = {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
    report.ok = false;
  }

  const avg = (xs: number[]) =>
    xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)) : null;
  report.observations.push(
    `Timing averages ms: promote=${avg(report.timingsMs.promote)}, stagingOnly=${avg(report.timingsMs.promoteStagingOnly)}, ensure=${avg(report.timingsMs.ensureCommercial)}, dual=${avg(report.timingsMs.dualEventHelper)}`
  );

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
