/**
 * Enterprise stabilization soak — Decision Center / process cue consistency.
 * Development-safe (no writes). Loads campaign headers by document number when
 * Dev credentials are present; otherwise runs fixture matrix only.
 *
 * Usage: npx tsx scripts/soak-lifecycle-consistency.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

import {
  countHardProgressionBlockers,
  deriveCampaignProcessCue,
} from "../features/campaigns/lifecycle/campaign-process-presentation.ts";
import { buildDecisionCenter } from "../features/campaigns/lifecycle/campaign-decision-center.ts";

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
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function fixtureSignals(overrides = {}) {
  return {
    status: "active",
    lineCount: 5,
    hasClientIo: true,
    clientIoStatus: "approved",
    vendorIoCount: 5,
    approvedVendorIoCount: 0,
    sentVendorIoCount: 5,
    deliverableCount: 10,
    overdueDeliverableCount: 0,
    activePerformance: false,
    invoiceCount: 0,
    billingOutstanding: 0,
    blockerCount: 0,
    poExceeded: false,
    ...overrides,
  };
}

function assertApprovedCioConsistency(label, signals, workspaceBlockers = []) {
  const cue = deriveCampaignProcessCue(signals);
  assert.notEqual(cue.entryStageId, "client-io", `${label}: must leave client-io`);
  assert.notEqual(cue.lifecycleSignal, "blocked", `${label}: must not be blocked`);
  assert.ok(
    !/Blocked by open issues/i.test(cue.statusLabel),
    `${label}: no false Blocked by open issues`
  );
  assert.equal(cue.stageSignals["client-io"], "completed", `${label}: CIO completed`);

  const dc = buildDecisionCenter({
    stageId: cue.entryStageId,
    stageLabel: cue.currentStageLabel,
    businessState: "needs_attention",
    enforcement: "soft",
    owner: "Operations",
    waitingFor: "Operations",
    nextAction: cue.nextActionLabel,
    nextActionTab: cue.entryStageId,
    expectedResult: "Advance delivery.",
    missing: [],
    hardBlockers: workspaceBlockers,
    workspaceBlockers,
    signals,
    daysWaiting: 1,
    objects: {
      campaignDocumentNumber: label,
      clientIo: {
        id: "cio",
        document_number: "CIO-TEST",
        status: "approved",
      },
      vendorIos: Array.from({ length: signals.vendorIoCount }, (_, i) => ({
        id: `vio-${i}`,
        document_number: `VIO-${i}`,
        status: i < signals.approvedVendorIoCount ? "approved" : "sent",
        influencer_name: `Creator ${i}`,
      })),
      lines: [],
      deliverables: [],
      invoices: [],
      changeImpactSignals: [],
    },
  });

  assert.equal(dc.narrative.progressionAllowed, true, `${label}: progression allowed`);
  assert.equal(
    dc.blockers.every((b) => b.objectKind !== "client_io"),
    true,
    `${label}: no client_io blockers after approval`
  );
  assert.equal(
    dc.blockers.every(
      (b) =>
        !(
          b.severity === "business_blocker" &&
          /Campaign issue/i.test(b.objectLabel) &&
          /payout/i.test(b.title)
        )
    ),
    true,
    `${label}: payouts must not be Campaign Issue business blockers`
  );

  return { cue, dc };
}

console.log("=== Fixture matrix ===");
assert.equal(countHardProgressionBlockers(["Creator payouts outstanding"]), 0);
assert.equal(countHardProgressionBlockers(["Pending approvals require action"]), 1);
assert.equal(countHardProgressionBlockers(["Outstanding client billing"]), 0);

const cases = [
  ["TW-2026-0005-like", fixtureSignals({ blockerCount: 1 }), ["Creator payouts outstanding"]],
  ["all-vio-approved", fixtureSignals({ approvedVendorIoCount: 5, blockerCount: 1 }), [
    "Creator payouts outstanding",
  ]],
  ["waiting-client", fixtureSignals({ clientIoStatus: "under_client_review", vendorIoCount: 0 }), []],
];

for (const [label, signals, blockers] of cases) {
  if (signals.clientIoStatus === "approved") {
    const { cue } = assertApprovedCioConsistency(label, signals, blockers);
    console.log(`PASS ${label} → stage=${cue.entryStageId} signal=${cue.lifecycleSignal}`);
  } else {
    const cue = deriveCampaignProcessCue(signals);
    assert.equal(cue.entryStageId, "client-io");
    assert.equal(cue.lifecycleSignal, "waiting_client");
    console.log(`PASS ${label} → waiting client`);
  }
}

if (url.includes(DEV_REF) && key) {
  console.log("\n=== Development campaign probe ===");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: headers, error } = await sb
    .from("campaign_headers")
    .select("id, document_number, name, status")
    .in("document_number", ["TW-2026-0005", "TW-2026-0002", "TW-2026-0001"])
    .limit(10);
  if (error) {
    console.warn("Dev probe skipped:", error.message);
  } else {
    for (const h of headers ?? []) {
      const { data: cio } = await sb
        .from("client_ios")
        .select("id, document_number, status")
        .eq("campaign_header_id", h.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { count: vioCount } = await sb
        .from("vendor_ios")
        .select("id", { count: "exact", head: true })
        .eq("campaign_header_id", h.id);
      const { count: lineCount } = await sb
        .from("campaign_lines")
        .select("id", { count: "exact", head: true })
        .eq("campaign_header_id", h.id);

      const signals = fixtureSignals({
        lineCount: lineCount ?? 0,
        hasClientIo: Boolean(cio),
        clientIoStatus: cio?.status ?? null,
        vendorIoCount: vioCount ?? 0,
        approvedVendorIoCount: 0,
        sentVendorIoCount: vioCount ?? 0,
        deliverableCount: Math.max(lineCount ?? 0, 1),
        blockerCount: countHardProgressionBlockers(["Creator payouts outstanding"]),
      });

      if (cio?.status === "approved") {
        assertApprovedCioConsistency(h.document_number, signals, [
          "Creator payouts outstanding",
        ]);
        console.log(
          `PASS ${h.document_number} Dev probe CIO=${cio.status} lines=${lineCount} vio=${vioCount}`
        );
      } else {
        console.log(
          `INFO ${h.document_number} CIO=${cio?.status ?? "none"} — skipped approved-path assert`
        );
      }
    }
  }
} else {
  console.log("\n(Dev Supabase not configured — fixture matrix only)");
}

console.log("\nSOAK PASS — lifecycle consistency");
