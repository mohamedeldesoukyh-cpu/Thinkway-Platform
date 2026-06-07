/**
 * IO coverage engine — run: npx tsx lib/operations/io-coverage.test.ts
 */
import {
  analyzeIoCoverage,
  hasCommercialDelta,
  hasExistingIoCoverage,
  hasVendorIoAmountDrift,
  isSafeInvoiceRegeneration,
  requiresIoRevision,
  requiresNewIoGeneration,
  type IoLineSnapshot,
} from "@/lib/operations/io-coverage";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function line(overrides: Partial<IoLineSnapshot> & { line_id: string }): IoLineSnapshot {
  return {
    line_id: overrides.line_id,
    line_name: overrides.line_name ?? overrides.line_id,
    vendor_io_id: overrides.vendor_io_id ?? "vio-1",
    active_vendor_io_id: overrides.active_vendor_io_id ?? "vio-1",
    vendor_io_document_number: overrides.vendor_io_document_number ?? "VIO-2026-2",
    vendor_io_amount: overrides.vendor_io_amount ?? null,
    influencer_id: overrides.influencer_id ?? "inf-1",
    revenue_before_vat: overrides.revenue_before_vat ?? 1000,
    cost_before_vat: overrides.cost_before_vat ?? 500,
    deliverables: overrides.deliverables ?? [
      {
        id: "del-1",
        platform: "instagram",
        deliverable_type: "reel",
        quantity: 1,
        revenue_before_vat: 1000,
        cost_before_vat: 500,
      },
    ],
  };
}

function testSafeRegeneration() {
  const baseline = line({ line_id: "l1" });
  const current = line({ line_id: "l1" });
  const analysis = analyzeIoCoverage({
    currents: [current],
    baselines: new Map([["l1", baseline]]),
  });
  assert(analysis.case === "safe_regeneration", "identical snapshot should be safe");
  assert(isSafeInvoiceRegeneration(analysis), "safe flag");
}

function testRevisionWarning() {
  const baseline = line({ line_id: "l1", revenue_before_vat: 1000 });
  const current = line({ line_id: "l1", revenue_before_vat: 1200 });
  assert(requiresIoRevision(baseline, current), "price change requires revision");
  const analysis = analyzeIoCoverage({
    currents: [current],
    baselines: new Map([["l1", baseline]]),
  });
  assert(analysis.case === "revision_warning", "commercial delta → warning case");
}

function testBlockedNewDeliverable() {
  const baseline = line({ line_id: "l1" });
  const current = line({
    line_id: "l1",
    deliverables: [
      ...baseline.deliverables,
      {
        id: "del-new",
        platform: "tiktok",
        deliverable_type: "video",
        quantity: 1,
        revenue_before_vat: 300,
        cost_before_vat: 100,
      },
    ],
  });
  assert(requiresNewIoGeneration(current, baseline), "new deliverable needs IO");
  const analysis = analyzeIoCoverage({
    currents: [current],
    baselines: new Map([["l1", baseline]]),
  });
  assert(analysis.case === "blocked", "new uncovered deliverable blocks");
}

function testNeverHadIo() {
  const current: IoLineSnapshot = {
    line_id: "l1",
    vendor_io_id: null,
    active_vendor_io_id: null,
    vendor_io_document_number: null,
    influencer_id: "inf-1",
    revenue_before_vat: 1000,
    cost_before_vat: 500,
    deliverables: [
      {
        id: "del-1",
        platform: "instagram",
        deliverable_type: "reel",
        quantity: 1,
        revenue_before_vat: 1000,
        cost_before_vat: 500,
      },
    ],
  };
  assert(!hasExistingIoCoverage(current), "no IO coverage");
  assert(requiresNewIoGeneration(current, null), "never had IO");
}

function testScopeIgnoresNonSelectedLines() {
  const lineA = line({ line_id: "l1", line_name: "TW-2026-0001-A" });
  const lineB = line({
    line_id: "l2",
    line_name: "TW-2026-0001-B",
    vendor_io_id: null,
    active_vendor_io_id: null,
    vendor_io_document_number: null,
  });

  const analysis = analyzeIoCoverage({
    currents: [lineA, lineB],
    baselines: new Map([["l1", lineA]]),
    scope: { lineIds: ["l1"] },
  });

  assert(analysis.lines.length === 1, "only selected line analyzed");
  assert(analysis.lines[0]!.line_id === "l1", "selected line only");
  assert(analysis.case === "safe_regeneration", "non-selected uncovered line ignored");
}

function testHasIoWithoutBaselineDoesNotNeedNewIo() {
  const current = line({ line_id: "l1" });
  assert(!requiresNewIoGeneration(current, null), "IO-covered line without baseline is ok");
}

function testCommercialDeltaDeliverableQty() {
  const baseline = line({ line_id: "l1" });
  const current = line({
    line_id: "l1",
    deliverables: [{ ...baseline.deliverables[0]!, quantity: 2 }],
  });
  assert(hasCommercialDelta(baseline, current), "quantity change is commercial delta");
}

function testVendorIoAmountDriftRequiresRevision() {
  const baseline = line({ line_id: "l1", cost_before_vat: 2500 });
  const current = line({
    line_id: "l1",
    cost_before_vat: 2500,
    vendor_io_amount: 2000,
  });
  assert(hasVendorIoAmountDrift(current), "stored VIO amount drift detected");
  assert(
    requiresIoRevision(baseline, current),
    "amount drift requires revision even when commercial matches baseline"
  );
  const analysis = analyzeIoCoverage({
    currents: [current],
    baselines: new Map([["l1", baseline]]),
  });
  assert(analysis.case === "revision_warning", "amount drift → revision warning");
}

function run() {
  testSafeRegeneration();
  testRevisionWarning();
  testBlockedNewDeliverable();
  testNeverHadIo();
  testScopeIgnoresNonSelectedLines();
  testHasIoWithoutBaselineDoesNotNeedNewIo();
  testCommercialDeltaDeliverableQty();
  testVendorIoAmountDriftRequiresRevision();
  console.log("[io-coverage] all checks passed");
}

run();
