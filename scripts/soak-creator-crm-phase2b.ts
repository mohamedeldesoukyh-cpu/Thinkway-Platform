/**
 * Phase 2B Development soak — real CRM persistence with writers ON/OFF.
 *
 * Usage: npx tsx scripts/soak-creator-crm-phase2b.ts
 * Requires Dev service role in .env (project hsxrewjcbvmbkqdlzjhs).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { syncCampaignInfluencerForLine } from "../lib/campaigns/campaign-influencer-sync";
import { ensureCommercialCreatorFromQuoteToCampaign } from "../lib/creators/crm/activation-helpers";
import { promoteDiscoveredProfileToInfluencer } from "../lib/discovery/promote-profile";
import { isCreatorCrmWritersEnabled } from "../lib/creators/crm/feature-flag";
import { createEmptyCreatorDNADocument } from "../features/creator-dna/services/document-factory";
import { wrapValue } from "../features/creator-dna/services/field-envelope";
import { CreatorDNAService } from "../features/creator-dna/services/creator-dna-service";

type Check = { id: string; pass: boolean; detail: string };
type Report = {
  ok: boolean;
  supabaseProjectRef: string | null;
  soakTag: string;
  before: Record<string, number>;
  afterWritersOn: Record<string, number>;
  afterWritersOff: Record<string, number>;
  timingsMs: Record<string, number>;
  observations: string[];
  checks: Check[];
  cleanup: { ok: boolean; detail: string };
};

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function projectRef(url?: string) {
  try {
    return url ? new URL(url).hostname.split(".")[0] ?? null : null;
  } catch {
    return null;
  }
}

function check(report: Report, id: string, pass: boolean, detail: string) {
  report.checks.push({ id, pass, detail });
  if (!pass) report.ok = false;
}

function runPsqlFile(sql: string): string {
  const tmp = resolve("scripts/.tmp-soak2b.sql");
  writeFileSync(tmp, sql, "utf8");
  const result = spawnSync(
    process.execPath,
    ["scripts/psql-development.mjs", "-f", tmp],
    { encoding: "utf8", cwd: resolve(".") }
  );
  try {
    unlinkSync(tmp);
  } catch {
    /* ignore */
  }
  if (result.status !== 0) {
    throw new Error(
      `psql failed: ${result.stderr || result.stdout || result.status}`
    );
  }
  return result.stdout ?? "";
}

function runPsql(sql: string): string {
  return runPsqlFile(sql);
}

function parsePsqlScalar(stdout: string): string {
  const lines = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  // Find first data line after header separator (---)
  const sep = lines.findIndex((l) => /^-{3,}/.test(l));
  if (sep >= 0 && lines[sep + 1] && !lines[sep + 1]!.startsWith("(")) {
    return lines[sep + 1]!;
  }
  return lines[1] ?? "";
}

async function crmSnapshot(supabase: SupabaseClient, influencerId?: string) {
  const profiles = await supabase.from("creator_crm_profiles").select("influencer_id, crm_status, activated_reason");
  const events = await supabase
    .from("creator_crm_activation_events")
    .select("id, influencer_id, reason, source_entity_type, source_entity_id");
  const flagged = await supabase
    .from("influencers")
    .select("id", { count: "exact", head: true })
    .eq("has_commercial_profile", true);

  const profileRows = profiles.data ?? [];
  const eventRows = events.data ?? [];
  const forInf = influencerId
    ? {
        profiles: profileRows.filter((p) => p.influencer_id === influencerId).length,
        events: eventRows.filter((e) => e.influencer_id === influencerId).length,
        assignmentEvents: eventRows.filter(
          (e) => e.influencer_id === influencerId && e.reason === "campaign_assignment"
        ).length,
        quotationEvents: eventRows.filter(
          (e) => e.influencer_id === influencerId && e.reason === "quotation_operational"
        ).length,
      }
    : null;

  return {
    profiles: profileRows.length,
    events: eventRows.length,
    flagged: flagged.count ?? 0,
    forInfluencer: forInf,
    eventReasons: eventRows.map((e) => e.reason),
  };
}

async function main() {
  loadEnvFile(resolve(".env"));
  loadEnvFile(resolve(".env.local"));

  const DEV_REF = "hsxrewjcbvmbkqdlzjhs";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const ref = projectRef(url);

  const report: Report = {
    ok: true,
    supabaseProjectRef: ref,
    soakTag: `soak2b_${Date.now()}`,
    before: {},
    afterWritersOn: {},
    afterWritersOff: {},
    timingsMs: {},
    observations: [],
    checks: [],
    cleanup: { ok: false, detail: "not run" },
  };

  check(report, "env_is_development", ref === DEV_REF, `ref=${ref}`);
  if (!url || !key || ref !== DEV_REF) {
    throw new Error("Dev Supabase credentials required (hsxrewjcbvmbkqdlzjhs)");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const beforeSnap = await crmSnapshot(supabase);
  report.before = {
    profiles: beforeSnap.profiles,
    events: beforeSnap.events,
    flagged: beforeSnap.flagged,
  };
  report.observations.push(`Baseline CRM: ${JSON.stringify(report.before)}`);

  const { data: actor } = await supabase.from("profiles").select("id").limit(1).maybeSingle();
  const actorId = (actor?.id as string | undefined) ?? null;

  // Reuse an existing campaign header (header insert triggers brand sync that can fail on Dev).
  const headerPick = runPsql(`
    SELECT id FROM public.campaign_headers ORDER BY created_at DESC LIMIT 1;
  `);
  const headerId = parsePsqlScalar(headerPick);
  if (!/^[0-9a-f-]{36}$/i.test(headerId)) {
    throw new Error(`No campaign_headers on Dev: ${headerPick}`);
  }
  report.observations.push(`Using existing campaign_headers.id=${headerId}`);

  const username = report.soakTag;
  const platform = "instagram";

  // --- Identity (never CRM) ---
  const { data: discovered, error: dpErr } = await supabase
    .from("discovered_profiles")
    .insert({
      platform,
      username,
      profile_url: `https://www.instagram.com/${username}/`,
      display_name: `Phase2B Soak ${username}`,
      country_code: "AE",
      stage: "discovered",
      category_tags: ["soak2b"],
      metadata: { soak: "creator_crm_phase2b", tag: username },
    })
    .select("id")
    .single();
  if (dpErr || !discovered) throw new Error(dpErr?.message ?? "discovered insert failed");

  const stagingDoc = createEmptyCreatorDNADocument();
  stagingDoc.identity.displayName = wrapValue(`Soak ${username}`, "apify", 0.9);
  stagingDoc.identity.handle = wrapValue(username, "apify", 0.95);
  await supabase.from("creator_dna_staging").upsert(
    {
      discovered_profile_id: discovered.id,
      document: stagingDoc as never,
      version: 1,
    } as never,
    { onConflict: "discovered_profile_id" }
  );

  process.env.CREATOR_CRM_WRITERS_ENABLED = "false";
  const promote = await promoteDiscoveredProfileToInfluencer(
    supabase as never,
    discovered.id as string,
    actorId ?? "00000000-0000-0000-0000-000000000001"
  );
  if (!promote.ok) throw new Error(promote.message);
  const influencerId = promote.influencerId;
  report.observations.push(`Promoted identity influencerId=${influencerId} (writers OFF)`);

  const afterPromote = await crmSnapshot(supabase, influencerId);
  check(
    report,
    "promote_creates_no_crm",
    afterPromote.forInfluencer?.profiles === 0 && afterPromote.forInfluencer?.events === 0,
    JSON.stringify(afterPromote.forInfluencer)
  );

  // Staging promote repeat (DNA only)
  const dna = new CreatorDNAService(supabase as never);
  const stagingAgain = await dna.promoteStaging(discovered.id as string, influencerId);
  check(
    report,
    "dna_promote_noop_no_crm",
    stagingAgain.ok && afterPromote.profiles === (await crmSnapshot(supabase)).profiles,
    `stagingPromoted=${stagingAgain.promoted}`
  );

  // --- Writers ON: first assignment ---
  process.env.CREATOR_CRM_WRITERS_ENABLED = "true";
  check(
    report,
    "writers_on",
    isCreatorCrmWritersEnabled() === true,
    `writers=${isCreatorCrmWritersEnabled()}`
  );

  const lineOut = runPsql(`
    INSERT INTO public.campaign_lines (campaign_header_id, name, status, created_by, metadata)
    VALUES (
      '${headerId}'::uuid,
      'Soak line A ${username}',
      'draft',
      ${actorId ? `'${actorId}'::uuid` : "NULL"},
      '{"soak":"creator_crm_phase2b"}'::jsonb
    )
    RETURNING id;
  `);
  const lineId = parsePsqlScalar(lineOut);
  if (!/^[0-9a-f-]{36}$/i.test(lineId)) {
    throw new Error(`Failed to create campaign_lines: ${lineOut}`);
  }

  const t1 = performance.now();
  const sync1 = await syncCampaignInfluencerForLine(supabase as never, {
    campaignId: headerId,
    lineId,
    influencerId,
    payload: {
      status: "confirmed",
      currency: "AED",
      deliverable_count: 1,
      cost_before_vat: 1000,
      cost_vat_percent: 0,
      cost_vat_amount: 0,
      cost_after_vat: 1000,
      created_by: actorId,
      confirmed_at: new Date().toISOString(),
    },
  });
  report.timingsMs.firstAssignment = Number((performance.now() - t1).toFixed(2));
  check(report, "first_assignment_ok", Boolean(sync1.id) && !sync1.error, sync1.error ?? sync1.id);

  const afterFirst = await crmSnapshot(supabase, influencerId);
  check(
    report,
    "one_crm_profile",
    afterFirst.forInfluencer?.profiles === 1,
    JSON.stringify(afterFirst.forInfluencer)
  );
  check(
    report,
    "one_assignment_event",
    afterFirst.forInfluencer?.assignmentEvents === 1 &&
      afterFirst.forInfluencer?.events === 1,
    JSON.stringify(afterFirst.forInfluencer)
  );

  const { count: dnaCount } = await supabase
    .from("creator_dna")
    .select("influencer_id", { count: "exact", head: true })
    .eq("influencer_id", influencerId);
  const { count: infCount } = await supabase
    .from("influencers")
    .select("id", { count: "exact", head: true })
    .eq("id", influencerId);
  check(report, "one_identity", (infCount ?? 0) === 1, `influencers=${infCount}`);
  check(report, "one_dna", (dnaCount ?? 0) === 1, `creator_dna=${dnaCount}`);

  // --- Repeat assignment ---
  const t2 = performance.now();
  const sync2 = await syncCampaignInfluencerForLine(supabase as never, {
    campaignId: headerId,
    lineId,
    influencerId,
    payload: {
      status: "confirmed",
      currency: "AED",
      deliverable_count: 2,
      cost_before_vat: 2000,
      cost_vat_percent: 0,
      cost_vat_amount: 0,
      cost_after_vat: 2000,
      created_by: actorId,
      confirmed_at: new Date().toISOString(),
    },
  });
  report.timingsMs.repeatAssignment = Number((performance.now() - t2).toFixed(2));
  check(report, "repeat_assignment_ok", sync2.id === sync1.id && !sync2.error, `id=${sync2.id}`);

  const afterRepeat = await crmSnapshot(supabase, influencerId);
  check(
    report,
    "repeat_no_second_profile",
    afterRepeat.forInfluencer?.profiles === 1,
    JSON.stringify(afterRepeat.forInfluencer)
  );
  check(
    report,
    "repeat_no_duplicate_assignment_event",
    afterRepeat.forInfluencer?.assignmentEvents === 1,
    JSON.stringify(afterRepeat.forInfluencer)
  );

  const { data: ciRow } = await supabase
    .from("campaign_influencers")
    .select("id, deliverable_count")
    .eq("id", sync1.id)
    .maybeSingle();
  check(
    report,
    "assignment_linkage_updated",
    ciRow?.deliverable_count === 2,
    `deliverable_count=${ciRow?.deliverable_count}`
  );

  // --- Quote → Campaign dual-event (second CI via new line + dual helper) ---
  const lineBOut = runPsql(`
    INSERT INTO public.campaign_lines (campaign_header_id, name, status, created_by, metadata)
    VALUES (
      '${headerId}'::uuid,
      'Soak line B ${username}',
      'draft',
      ${actorId ? `'${actorId}'::uuid` : "NULL"},
      '{"soak":"creator_crm_phase2b_quote"}'::jsonb
    )
    RETURNING id;
  `);
  const lineBId = parsePsqlScalar(lineBOut);
  if (!/^[0-9a-f-]{36}$/i.test(lineBId)) {
    throw new Error(`line B failed: ${lineBOut}`);
  }

  // Simulate quote operationalise: new CI + dual-event (quotation id synthetic)
  const ciBOut = runPsql(`
    INSERT INTO public.campaign_influencers (
      campaign_id, campaign_header_id, campaign_line_id, influencer_id,
      status, created_by, currency, deliverable_count,
      cost_before_vat, cost_vat_percent, cost_vat_amount, cost_after_vat
    ) VALUES (
      '${headerId}'::uuid, '${headerId}'::uuid, '${lineBId}'::uuid, '${influencerId}'::uuid,
      'invited', ${actorId ? `'${actorId}'::uuid` : "NULL"}, 'AED', 1,
      0, 0, 0, 0
    )
    RETURNING id;
  `);
  const ciBId = parsePsqlScalar(ciBOut);
  if (!/^[0-9a-f-]{36}$/i.test(ciBId)) {
    throw new Error(`ci B failed: ${ciBOut}`);
  }

  const quotationId = "00000000-0000-4000-8000-0000000002b1";
  const t3 = performance.now();
  const dual = await ensureCommercialCreatorFromQuoteToCampaign(supabase as never, {
    influencerId,
    quotationId,
    campaignInfluencerId: ciBId,
    actorId,
    bypassRoleCheck: true,
    metadata: { path: "soak_quote_to_campaign" },
  });
  report.timingsMs.quoteToCampaign = Number((performance.now() - t3).toFixed(2));

  check(report, "dual_ok", dual.profile.ok === true, JSON.stringify(dual.profile));
  const afterDual = await crmSnapshot(supabase, influencerId);
  check(
    report,
    "still_one_profile_after_dual",
    afterDual.forInfluencer?.profiles === 1,
    JSON.stringify(afterDual.forInfluencer)
  );
  check(
    report,
    "quotation_operational_event",
    (afterDual.forInfluencer?.quotationEvents ?? 0) >= 1,
    JSON.stringify(afterDual.forInfluencer)
  );
  check(
    report,
    "assignment_events_for_two_cis",
    (afterDual.forInfluencer?.assignmentEvents ?? 0) === 2,
    JSON.stringify(afterDual.forInfluencer)
  );

  // Repeat dual — no duplicates
  const dual2 = await ensureCommercialCreatorFromQuoteToCampaign(supabase as never, {
    influencerId,
    quotationId,
    campaignInfluencerId: ciBId,
    actorId,
    bypassRoleCheck: true,
  });
  const afterDual2 = await crmSnapshot(supabase, influencerId);
  check(
    report,
    "repeat_dual_no_dupes",
    afterDual2.forInfluencer?.profiles === 1 &&
      afterDual2.forInfluencer?.quotationEvents === 1 &&
      afterDual2.forInfluencer?.assignmentEvents === 2,
    JSON.stringify({ dual2, snap: afterDual2.forInfluencer })
  );

  const onSnap = await crmSnapshot(supabase);
  report.afterWritersOn = {
    profiles: onSnap.profiles,
    events: onSnap.events,
    flagged: onSnap.flagged,
  };

  // --- Discovery negative: shortlist-like path = promote already done; ensure not called ---
  // Already verified promote/DNA with writers OFF and CRM empty; with writers ON re-promote:
  const promote2 = await promoteDiscoveredProfileToInfluencer(
    supabase as never,
    discovered.id as string,
    actorId ?? "00000000-0000-0000-0000-000000000001"
  );
  check(report, "rediscovery_promote_ok", promote2.ok === true, JSON.stringify(promote2));
  const afterRediscover = await crmSnapshot(supabase, influencerId);
  check(
    report,
    "rediscovery_no_extra_crm",
    afterRediscover.forInfluencer?.profiles === 1 &&
      afterRediscover.forInfluencer?.events === afterDual2.forInfluencer?.events,
    JSON.stringify(afterRediscover.forInfluencer)
  );

  // --- Writers OFF ---
  process.env.CREATOR_CRM_WRITERS_ENABLED = "false";
  check(
    report,
    "writers_off",
    isCreatorCrmWritersEnabled() === false,
    `writers=${isCreatorCrmWritersEnabled()}`
  );

  const lineCOut = runPsql(`
    INSERT INTO public.campaign_lines (campaign_header_id, name, status, created_by, metadata)
    VALUES (
      '${headerId}'::uuid,
      'Soak line C ${username}',
      'draft',
      ${actorId ? `'${actorId}'::uuid` : "NULL"},
      '{"soak":"creator_crm_phase2b_off"}'::jsonb
    )
    RETURNING id;
  `);
  const lineCId = parsePsqlScalar(lineCOut);

  const profilesBeforeOff = (await crmSnapshot(supabase)).profiles;
  const eventsBeforeOff = (await crmSnapshot(supabase)).events;

  const t4 = performance.now();
  const syncOff = await syncCampaignInfluencerForLine(supabase as never, {
    campaignId: headerId,
    lineId: lineCId,
    influencerId,
    payload: {
      status: "confirmed",
      currency: "AED",
      deliverable_count: 1,
      cost_before_vat: 0,
      cost_vat_percent: 0,
      cost_vat_amount: 0,
      cost_after_vat: 0,
      created_by: actorId,
    },
  });
  report.timingsMs.assignmentWritersOff = Number((performance.now() - t4).toFixed(2));
  check(report, "assignment_ok_writers_off", Boolean(syncOff.id) && !syncOff.error, syncOff.error ?? syncOff.id);

  const offSnap = await crmSnapshot(supabase);
  check(
    report,
    "zero_crm_writes_writers_off",
    offSnap.profiles === profilesBeforeOff && offSnap.events === eventsBeforeOff,
    `profiles ${profilesBeforeOff}->${offSnap.profiles}; events ${eventsBeforeOff}->${offSnap.events}`
  );
  report.afterWritersOff = {
    profiles: offSnap.profiles,
    events: offSnap.events,
    flagged: offSnap.flagged,
  };

  // Cleanup soak artifacts (campaign + influencer cascade)
  try {
    runPsql(`
      DELETE FROM public.campaign_influencers WHERE influencer_id = '${influencerId}'::uuid;
      DELETE FROM public.campaign_lines WHERE name LIKE 'Soak line %${username}%';
    `);
    await supabase.from("creator_dna_staging").delete().eq("discovered_profile_id", discovered.id);
    await supabase.from("discovered_profiles").delete().eq("id", discovered.id);
    await supabase.from("creator_crm_activation_events").delete().eq("influencer_id", influencerId);
    await supabase.from("creator_crm_profiles").delete().eq("influencer_id", influencerId);
    await supabase.from("influencers").delete().eq("id", influencerId);
    const finalSnap = await crmSnapshot(supabase);
    check(
      report,
      "cleanup_restores_baseline",
      finalSnap.profiles === report.before.profiles &&
        finalSnap.events === report.before.events,
      JSON.stringify({ final: finalSnap, before: report.before })
    );
    report.cleanup = { ok: true, detail: "Soak rows deleted; CRM baseline restored" };
  } catch (error) {
    report.cleanup = {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
    report.ok = false;
  }

  const outPath = resolve("docs/architecture/artifacts/phase2b-soak-raw.json");
  try {
    writeFileSync(outPath, JSON.stringify(report, null, 2));
    report.observations.push(`Raw JSON written to ${outPath}`);
  } catch {
    report.observations.push("Could not write artifacts JSON (non-fatal)");
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
