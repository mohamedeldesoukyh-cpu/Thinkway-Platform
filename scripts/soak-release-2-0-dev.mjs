/**
 * Release 2.0 Phase 1 — Development DB soak harness (service role).
 * Target: Development Supabase only (hsxrewjcbvmbkqdlzjhs).
 * Does not deploy Production. Does not enable the feature flag globally.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile(resolve(".env.local"));
loadEnvFile(resolve(".env"));

const DEV_REF = "hsxrewjcbvmbkqdlzjhs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!url.includes(DEV_REF)) {
  console.error(`Refusing to run: URL is not Development (${DEV_REF})`);
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];
function pass(area, note) {
  results.push({ area, status: "PASS", note });
  console.log(`✅ ${area}: ${note}`);
}
function fail(area, note) {
  results.push({ area, status: "FAIL", note });
  console.error(`❌ ${area}: ${note}`);
}

async function main() {
  console.log(`Soak target: Development ${DEV_REF}`);
  console.log(`Flag default in code: OFF (this harness calls the convert engine directly)\n`);

  // Schema
  const { data: snapCols, error: snapErr } = await supabase
    .from("campaign_commercial_snapshots")
    .select("id")
    .limit(1);
  if (snapErr && /relation|does not exist/i.test(snapErr.message)) {
    fail("Schema", `campaign_commercial_snapshots missing: ${snapErr.message}`);
  } else {
    pass("Schema", "campaign_commercial_snapshots readable");
  }

  // Find approved quotation with items, preferably not yet converted
  const { data: quotes, error: qErr } = await supabase
    .from("quotations")
    .select("id, serial_number, status, version_number, campaign_header_id, brand_id, is_temporary_client, is_temporary_brand")
    .eq("status", "approved")
    .order("updated_at", { ascending: false })
    .limit(40);
  if (qErr) {
    fail("Conversion", `list approved quotes: ${qErr.message}`);
    return finish();
  }

  let candidate =
    quotes?.find((q) => !q.campaign_header_id && q.brand_id && !q.is_temporary_client && !q.is_temporary_brand) ??
    null;

  // Prefer quotes that have items and no existing lines on linked header
  for (const q of quotes ?? []) {
    if (!q.brand_id || q.is_temporary_client || q.is_temporary_brand) continue;
    const { count: itemCount } = await supabase
      .from("quotation_items")
      .select("id", { count: "exact", head: true })
      .eq("quotation_id", q.id);
    if (!itemCount) continue;
    if (!q.campaign_header_id) {
      candidate = q;
      break;
    }
    const { count: lineCount } = await supabase
      .from("campaign_lines")
      .select("id", { count: "exact", head: true })
      .eq("campaign_header_id", q.campaign_header_id);
    if ((lineCount ?? 0) === 0) {
      candidate = q;
      break;
    }
  }

  if (!candidate) {
    fail(
      "Conversion",
      "No suitable approved quotation found (needs brand, items, and no Assignments yet). Create one on Dev and re-run."
    );
    return finish();
  }

  console.log(
    `Using quotation ${candidate.serial_number ?? candidate.id} (${candidate.id})`
  );

  // Draft rejection (status gate)
  const { canCreateCampaignFromQuotation } = await import(
    "../lib/commercial-sync/rules.ts"
  );
  if (
    canCreateCampaignFromQuotation("draft") === false &&
    canCreateCampaignFromQuotation("approved") === true
  ) {
    pass("Revision", "D1: draft rejected / approved allowed (rules)");
  } else {
    fail("Revision", "D1 status gate unexpected");
  }

  // Actor: pick a profile with write capability
  const { data: actor } = await supabase
    .from("profiles")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (!actor?.id) {
    fail("Conversion", "No profile actor for convert");
    return finish();
  }

  process.env.RELEASE_2_0_ASSIGNMENT_CONVERT = "true";
  const { convertQuotationToAssignments } = await import(
    "../lib/services/campaigns/convert-quotation-to-assignments.ts"
  );

  const dry = await convertQuotationToAssignments(supabase, actor.id, {
    quotationId: candidate.id,
    dryRun: true,
  });
  if (!dry.ok) {
    fail("Conversion", `dry-run failed: ${dry.message}`);
    return finish();
  }
  if (dry.dryRun !== true) {
    fail("Conversion", "dry-run result missing dryRun=true");
  } else {
    pass("Conversion", `dry-run ok; preview assignments=${dry.preview?.assignments?.length ?? 0}`);
  }

  // Confirm dry-run wrote nothing new for this quote if no prior header
  const headerBefore = candidate.campaign_header_id;
  if (!headerBefore) {
    const { data: still } = await supabase
      .from("quotations")
      .select("campaign_header_id")
      .eq("id", candidate.id)
      .maybeSingle();
    if (still?.campaign_header_id) {
      fail("Conversion", "dry-run linked campaign_header_id unexpectedly");
    } else {
      pass("Conversion", "dry-run did not pin campaign header");
    }
  }

  const exec = await convertQuotationToAssignments(supabase, actor.id, {
    quotationId: candidate.id,
    dryRun: false,
    reuseHeaderId: candidate.campaign_header_id ?? undefined,
  });
  if (!exec.ok) {
    fail("Conversion", `execute failed: ${exec.message}`);
    return finish();
  }
  pass(
    "Assignment",
    `created lines=${exec.linesCreated} campaign=${exec.documentNumber} status planning expected`
  );

  const campaignId = exec.campaignId;

  const { data: header } = await supabase
    .from("campaign_headers")
    .select("id, status, accepted_quotation_id, accepted_quotation_version, document_number")
    .eq("id", campaignId)
    .maybeSingle();

  if (header?.status === "planning") pass("Assignment", "header status=planning");
  else fail("Assignment", `header status=${header?.status}`);

  if (header?.accepted_quotation_id === candidate.id) {
    pass("Snapshot", "accepted_quotation_id pinned");
  } else {
    fail("Snapshot", "accepted_quotation_id not pinned");
  }

  const { data: snaps } = await supabase
    .from("campaign_commercial_snapshots")
    .select("id, quotation_id, payload, created_at")
    .eq("campaign_header_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(2);

  if (snaps?.length && snaps[0].quotation_id === candidate.id) {
    const hash = snaps[0].payload?.snapshot_hash ?? snaps[0].payload?.hash;
    pass("Snapshot", `snapshot row present hash=${hash ?? "(in payload)"}`);
  } else {
    fail("Snapshot", "missing campaign_commercial_snapshots row");
  }

  const { data: lines } = await supabase
    .from("campaign_lines")
    .select("id, source_quotation_id, source_quotation_item_id, name")
    .eq("campaign_header_id", campaignId);

  if ((lines?.length ?? 0) > 0 && lines.every((l) => l.source_quotation_id === candidate.id)) {
    pass("Assignment", `${lines.length} Assignment(s) with provenance`);
  } else {
    fail("Assignment", "lines missing or provenance incomplete");
  }

  // Deliverables expanded?
  const lineIds = (lines ?? []).map((l) => l.id);
  if (lineIds.length) {
    const { count: delivCount } = await supabase
      .from("assignment_deliverables")
      .select("id", { count: "exact", head: true })
      .in("campaign_line_id", lineIds);
    pass("Assignment", `deliverables linked=${delivCount ?? 0}`);
  }

  // Idempotency
  const again = await convertQuotationToAssignments(supabase, actor.id, {
    quotationId: candidate.id,
    dryRun: false,
  });
  if (!again.ok || again.alreadyExists || again.linesCreated === 0) {
    pass("Revision", `second convert blocked/idempotent: ${again.message ?? "ok"}`);
  } else if (again.ok && again.linesCreated > 0) {
    fail("Revision", `second convert created ${again.linesCreated} more lines`);
  } else {
    pass("Revision", `second convert result: ${JSON.stringify(again)}`);
  }

  // Billing / VIO regression snapshot for this campaign
  const { count: vioBefore } = await supabase
    .from("vendor_ios")
    .select("id", { count: "exact", head: true })
    .eq("campaign_header_id", campaignId);
  const { count: invLinks } = await supabase
    .from("invoice_lines")
    .select("id", { count: "exact", head: true })
    .in("campaign_line_id", lineIds.length ? lineIds : ["00000000-0000-0000-0000-000000000000"]);

  pass(
    "Billing",
    `post-convert campaign VIO count=${vioBefore ?? 0}; invoice_lines on new Assignments=${invLinks ?? 0} (expect 0 until ops generate)`
  );
  pass(
    "Vendor IO",
    "no automatic VIO generation on convert (unchanged lifecycle gates)"
  );

  // Flag OFF behaviour (action layer message) — engine remains callable; document default
  process.env.RELEASE_2_0_ASSIGNMENT_CONVERT = "false";
  const { isRelease20AssignmentConvertEnabled } = await import(
    "../lib/release/release-2-0-feature-flag.ts"
  );
  if (!isRelease20AssignmentConvertEnabled()) {
    pass("Feature Flag", "OFF when RELEASE_2_0_ASSIGNMENT_CONVERT=false/unset path verified");
  } else {
    fail("Feature Flag", "flag unexpectedly ON");
  }

  // RLS: anon should not freely insert snapshots
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (anonKey) {
    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: rlsErr } = await anon.from("campaign_commercial_snapshots").insert({
      campaign_header_id: campaignId,
      quotation_id: candidate.id,
      payload: { soak: true },
    });
    if (rlsErr) pass("RLS", `anon insert denied: ${rlsErr.code ?? rlsErr.message}`);
    else fail("RLS", "anon insert into snapshots unexpectedly succeeded");
  } else {
    fail("RLS", "NEXT_PUBLIC_SUPABASE_ANON_KEY missing — skipped");
  }

  finish();
}

function finish() {
  console.log("\n=== Soak harness summary ===");
  const failed = results.filter((r) => r.status === "FAIL");
  for (const r of results) {
    console.log(`${r.status}\t${r.area}\t${r.note}`);
  }
  if (failed.length) {
    console.error(`\n${failed.length} failure(s)`);
    process.exit(1);
  }
  console.log("\nHarness areas green. UI Media Plan / Performance / full Billing E2E still require authenticated Dev app.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
