/**
 * Release 2.0 Phase 1 — Development-only Backfill soak harness.
 * Creates isolated test fixtures (does not mutate TW-2026-0001 / TW-2026-0002 business data).
 * Target: Development Supabase only (hsxrewjcbvmbkqdlzjhs).
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
const SOURCE_QUOTE_ID = "c4bbde19-a9eb-45c6-9098-93978f266fcb"; // QT-2026-0005 template only
const TW_0001 = "20374f67-1c2f-4df0-b999-124a8d506c3c";
const TW_0002 = "689355f6-c2ff-47c6-a31a-c0fdf7e4a134";

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

async function countVios(campaignId) {
  const { count } = await supabase
    .from("vendor_ios")
    .select("id", { count: "exact", head: true })
    .eq("campaign_header_id", campaignId);
  return count ?? 0;
}

async function countInvoices(campaignId) {
  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("campaign_header_id", campaignId);
  return count ?? 0;
}

async function countLines(campaignId) {
  const { count } = await supabase
    .from("campaign_lines")
    .select("id", { count: "exact", head: true })
    .eq("campaign_header_id", campaignId);
  return count ?? 0;
}

async function nextSerial(prefix) {
  const year = new Date().getUTCFullYear();
  const like = `${prefix}-${year}-%`;
  const { data } = await supabase
    .from(prefix === "QT" ? "quotations" : "campaign_headers")
    .select(prefix === "QT" ? "serial_number" : "document_number")
    .ilike(prefix === "QT" ? "serial_number" : "document_number", like)
    .order(prefix === "QT" ? "serial_number" : "document_number", { ascending: false })
    .limit(50);
  let max = 0;
  for (const row of data ?? []) {
    const value = prefix === "QT" ? row.serial_number : row.document_number;
    const m = String(value ?? "").match(new RegExp(`^${prefix}-${year}-(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
}

async function main() {
  console.log(`Backfill soak target: Development ${DEV_REF}`);
  console.log("Creating isolated test fixtures (no mutation of existing business campaigns)\n");

  const baseline = {
    vio1: await countVios(TW_0001),
    vio2: await countVios(TW_0002),
    inv2: await countInvoices(TW_0002),
    lines2: await countLines(TW_0002),
  };
  console.log(
    `Baseline TW-0001 VIO=${baseline.vio1}; TW-0002 VIO=${baseline.vio2} INV=${baseline.inv2} lines=${baseline.lines2}`
  );

  const { data: actor } = await supabase.from("profiles").select("id").limit(1).maybeSingle();
  if (!actor?.id) {
    fail("Fixture", "No profile actor");
    return finish();
  }

  const { data: sourceQuote, error: sqErr } = await supabase
    .from("quotations")
    .select(
      "id, brand_id, client_id, currency, owner_id, created_by, total_cost_egp, total_revenue_egp, total_gp_value_egp, total_gp_pct, total_af_egp, total_agency_margin_egp, gp_target_pct, version_number, is_temporary_client, is_temporary_brand"
    )
    .eq("id", SOURCE_QUOTE_ID)
    .maybeSingle();
  if (sqErr || !sourceQuote) {
    fail("Fixture", `source quote: ${sqErr?.message ?? "missing"}`);
    return finish();
  }

  const { data: sourceItems, error: siErr } = await supabase
    .from("quotation_items")
    .select(
      "influencer_id, profile_id, unified_id, creator_name, platform, handle, followers, engagement_rate, country_code, deliverables, commercial_input_mode, cost, cost_currency, revenue, gp_pct, gp_value, fx_rate_to_egp, cost_egp, revenue_egp, gp_value_egp, sort_order, af_pct, af_value, af_value_egp, option_number, service_description, profile_image_url, profile_url, collapse_group_id, collapse_label"
    )
    .eq("quotation_id", SOURCE_QUOTE_ID)
    .order("sort_order");
  if (siErr || !sourceItems?.length) {
    fail("Fixture", `source items: ${siErr?.message ?? "none"}`);
    return finish();
  }

  const qtSerial = await nextSerial("QT");
  const soakName = `[SOAK-R20-BACKFILL] ${qtSerial}`;

  const { data: newQuote, error: nqErr } = await supabase
    .from("quotations")
    .insert({
      serial_number: qtSerial,
      name: soakName,
      status: "approved",
      brand_id: sourceQuote.brand_id,
      client_id: sourceQuote.client_id,
      campaign_header_id: null,
      shortlist_id: null,
      owner_id: sourceQuote.owner_id ?? actor.id,
      created_by: actor.id,
      approved_by: actor.id,
      approved_at: new Date().toISOString(),
      currency: sourceQuote.currency ?? "EGP",
      total_cost_egp: sourceQuote.total_cost_egp,
      total_revenue_egp: sourceQuote.total_revenue_egp,
      total_gp_value_egp: sourceQuote.total_gp_value_egp,
      total_gp_pct: sourceQuote.total_gp_pct,
      total_af_egp: sourceQuote.total_af_egp,
      total_agency_margin_egp: sourceQuote.total_agency_margin_egp,
      gp_target_pct: sourceQuote.gp_target_pct,
      version_number: sourceQuote.version_number ?? 1,
      is_temporary_client: false,
      is_temporary_brand: false,
      notes: "Development-only Release 2.0 Backfill soak fixture. Safe to delete.",
      metadata: { soak: "release_2_0_backfill", source_quotation_id: SOURCE_QUOTE_ID },
    })
    .select("id, serial_number, version_number")
    .single();

  if (nqErr || !newQuote) {
    fail("Fixture", `create quotation: ${nqErr?.message ?? "failed"}`);
    return finish();
  }
  pass("Fixture", `approved quotation ${newQuote.serial_number} (${newQuote.id})`);

  const itemRows = sourceItems.map((item) => ({
    ...item,
    quotation_id: newQuote.id,
    source_shortlist_item_id: null,
  }));
  const { error: itemsErr } = await supabase.from("quotation_items").insert(itemRows);
  if (itemsErr) {
    fail("Fixture", `clone items: ${itemsErr.message}`);
    return finish();
  }
  pass("Fixture", `cloned ${itemRows.length} quotation item(s)`);

  process.env.RELEASE_2_0_ASSIGNMENT_CONVERT = "true";
  const { createCampaignHeaderFromBrand } = await import(
    "../lib/services/quotations/repositories/quotation-repository.ts"
  );

  const headerCreated = await createCampaignHeaderFromBrand(supabase, actor.id, {
    name: `Campaign — ${soakName}`,
    brandId: sourceQuote.brand_id,
    quotationId: newQuote.id,
    shortlistId: null,
    status: "draft",
    // intentionally omit accepted pin — legacy pre-R2.0 shape
  });
  if (!headerCreated.ok) {
    fail("Fixture", `create empty campaign: ${headerCreated.message}`);
    return finish();
  }

  const campaignId = headerCreated.id;
  const documentNumber = headerCreated.document_number;

  await supabase
    .from("quotations")
    .update({ campaign_header_id: campaignId })
    .eq("id", newQuote.id);

  const linesBefore = await countLines(campaignId);
  if (linesBefore !== 0) {
    fail("Fixture", `expected 0 lines on legacy candidate, got ${linesBefore}`);
    return finish();
  }
  pass(
    "Fixture",
    `legacy candidate ${documentNumber} (${campaignId}) quotation_id linked, 0 Assignments`
  );

  const {
    detectLegacyCampaignForBackfill,
    previewBackfillAssignmentsFromQuotation,
    executeBackfillAssignmentsFromQuotation,
  } = await import("../lib/services/campaigns/backfill-assignments-from-quotation.ts");

  const detection = await detectLegacyCampaignForBackfill(supabase, campaignId);
  if (!detection.eligible || detection.quotationId !== newQuote.id) {
    fail("Backfill", `detection not eligible: ${detection.reason}`);
    return finish();
  }
  pass(
    "Backfill",
    `eligible detected for ${detection.documentNumber} ← ${detection.quotationSerial}`
  );

  const preview = await previewBackfillAssignmentsFromQuotation(
    supabase,
    actor.id,
    campaignId
  );
  if (!preview.ok || preview.dryRun !== true) {
    fail("Backfill", `preview failed: ${preview.ok === false ? preview.message : "missing dryRun"}`);
    return finish();
  }
  const linesAfterPreview = await countLines(campaignId);
  if (linesAfterPreview !== 0) {
    fail("Backfill", `dry-run wrote ${linesAfterPreview} line(s)`);
  } else {
    pass(
      "Backfill",
      `dry-run preview assignments=${preview.preview?.assignments?.length ?? 0}; no writes`
    );
  }

  const { data: pinBefore } = await supabase
    .from("campaign_headers")
    .select("accepted_quotation_id")
    .eq("id", campaignId)
    .maybeSingle();
  if (pinBefore?.accepted_quotation_id) {
    fail("Backfill", "accepted pin unexpectedly set before execute");
  }

  const exec = await executeBackfillAssignmentsFromQuotation(
    supabase,
    actor.id,
    campaignId
  );
  if (!exec.ok) {
    fail("Backfill", `execute failed: ${exec.message}`);
    return finish();
  }
  pass(
    "Backfill",
    `execute created lines=${exec.linesCreated} campaign=${exec.documentNumber}`
  );

  const { data: header } = await supabase
    .from("campaign_headers")
    .select(
      "id, status, accepted_quotation_id, accepted_quotation_version, quotation_id, document_number"
    )
    .eq("id", campaignId)
    .maybeSingle();

  if (header?.status === "planning") pass("Assignment", "header status=planning");
  else fail("Assignment", `header status=${header?.status}`);

  if (header?.accepted_quotation_id === newQuote.id) {
    pass(
      "Snapshot",
      `accepted pin ${header.accepted_quotation_id} v${header.accepted_quotation_version}`
    );
  } else {
    fail("Snapshot", "accepted_quotation_id not pinned after backfill");
  }

  const { data: snaps } = await supabase
    .from("campaign_commercial_snapshots")
    .select("id, quotation_id, payload, created_at")
    .eq("campaign_header_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(2);

  if (snaps?.length === 1 && snaps[0].quotation_id === newQuote.id) {
    const hash = snaps[0].payload?.snapshot_hash ?? snaps[0].payload?.hash;
    pass("Snapshot", `commercial snapshot present hash=${hash ?? "(in payload)"}`);
  } else {
    fail(
      "Snapshot",
      `expected 1 snapshot row, got ${snaps?.length ?? 0}`
    );
  }

  const { data: lines } = await supabase
    .from("campaign_lines")
    .select("id, source_quotation_id, source_quotation_item_id, vendor_io_id, invoice_id")
    .eq("campaign_header_id", campaignId);

  const lineCount = lines?.length ?? 0;
  if (
    lineCount > 0 &&
    lines.every((l) => l.source_quotation_id === newQuote.id && l.source_quotation_item_id)
  ) {
    pass("Assignment", `${lineCount} Assignment(s) with provenance`);
  } else {
    fail("Assignment", "lines missing or provenance incomplete");
  }

  if (lines?.every((l) => !l.vendor_io_id && !l.invoice_id)) {
    pass("Billing", "backfill did not auto-link Vendor IO or invoices on new Assignments");
  } else {
    fail("Billing", "unexpected VIO/invoice links on backfilled lines");
  }

  // Idempotency: re-detect should be ineligible; re-execute must not add lines
  const detection2 = await detectLegacyCampaignForBackfill(supabase, campaignId);
  if (!detection2.eligible && /already has Assignments/i.test(detection2.reason)) {
    pass("Backfill", `re-detect blocked: ${detection2.reason}`);
  } else {
    fail("Backfill", `re-detect unexpected: eligible=${detection2.eligible} ${detection2.reason}`);
  }

  const exec2 = await executeBackfillAssignmentsFromQuotation(
    supabase,
    actor.id,
    campaignId
  );
  const linesAfterSecond = await countLines(campaignId);
  if (!exec2.ok && linesAfterSecond === lineCount) {
    pass(
      "Backfill",
      `second execute idempotent (no new lines); message=${exec2.message}`
    );
  } else if (exec2.ok && (exec2.alreadyExists || exec2.linesCreated === 0) && linesAfterSecond === lineCount) {
    pass("Backfill", "second execute returned alreadyExists / 0 lines");
  } else {
    fail(
      "Backfill",
      `idempotency failed: ok=${exec2.ok} lines ${lineCount}→${linesAfterSecond} msg=${exec2.ok ? exec2.message : exec2.message}`
    );
  }

  const { count: snapCount } = await supabase
    .from("campaign_commercial_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("campaign_header_id", campaignId);
  if ((snapCount ?? 0) === 1) {
    pass("Snapshot", "second run did not duplicate commercial snapshot");
  } else {
    fail("Snapshot", `snapshot count after re-run=${snapCount}`);
  }

  // No unintended impact on existing soak/business campaigns
  const after = {
    vio1: await countVios(TW_0001),
    vio2: await countVios(TW_0002),
    inv2: await countInvoices(TW_0002),
    lines2: await countLines(TW_0002),
  };
  if (
    after.vio1 === baseline.vio1 &&
    after.vio2 === baseline.vio2 &&
    after.inv2 === baseline.inv2 &&
    after.lines2 === baseline.lines2
  ) {
    pass(
      "Regression",
      `TW-0001/TW-0002 VIO/invoice/line counts unchanged (${after.vio1}/${after.vio2}/${after.inv2}/${after.lines2})`
    );
  } else {
    fail(
      "Regression",
      `counts changed: before=${JSON.stringify(baseline)} after=${JSON.stringify(after)}`
    );
  }

  const newCampaignVio = await countVios(campaignId);
  const newCampaignInv = await countInvoices(campaignId);
  if (newCampaignVio === 0 && newCampaignInv === 0) {
    pass("Vendor IO", "no automatic Vendor IO / invoice on backfill campaign");
  } else {
    fail("Vendor IO", `unexpected VIO=${newCampaignVio} INV=${newCampaignInv} on soak campaign`);
  }

  console.log("\n--- Soak fixture IDs (Dev-only; safe to delete) ---");
  console.log(`quotation: ${newQuote.serial_number} ${newQuote.id}`);
  console.log(`campaign:  ${documentNumber} ${campaignId}`);

  finish();
}

function finish() {
  console.log("\n=== Backfill soak summary ===");
  const failed = results.filter((r) => r.status === "FAIL");
  for (const r of results) {
    console.log(`${r.status}\t${r.area}\t${r.note}`);
  }
  if (failed.length) {
    console.error(`\n${failed.length} failure(s)`);
    process.exit(1);
  }
  console.log("\nBackfill soak green on Development.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
