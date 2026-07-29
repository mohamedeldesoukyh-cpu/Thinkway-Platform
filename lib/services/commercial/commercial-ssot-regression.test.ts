/**
 * Commercial SSOT Phase 1 final validation — regression suite.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCommercialSynchronizationService } from "./commercial-synchronization-service";
import {
  assertOnlyMasterChanges,
  getFieldLevel,
  isDerivedFieldKey,
  isOperationalFieldKey,
  listMasterFields,
} from "./field-registry";
import {
  createInMemoryCommercialStore,
  createInMemoryCommercialSyncPorts,
  seedAssignment,
  seedQuotationItem,
} from "./in-memory-ports";

function seedLinkedPair(
  store: ReturnType<typeof createInMemoryCommercialStore>,
  opts?: { reverseAssignmentOrder?: boolean }
) {
  seedQuotationItem(store, {
    quotationItemId: "CML-001",
    quotationId: "q1",
    values: {
      creator_cost: 10000,
      client_revenue: 15000,
      agency_fee_percent: 10,
      cost_currency: "EGP",
    },
  });
  const a = {
    assignmentId: "asg-A",
    campaignHeaderId: "ch1",
    sourceQuotationItemId: "CML-001",
    values: {
      creator_cost: 10000,
      client_revenue: 15000,
      agency_fee_percent: 10,
    },
  };
  const b = {
    assignmentId: "asg-noise",
    campaignHeaderId: "ch1",
    sourceQuotationItemId: "CML-OTHER",
    values: { creator_cost: 1, client_revenue: 1 },
  };
  seedQuotationItem(store, {
    quotationItemId: "CML-OTHER",
    quotationId: "q1",
    values: { creator_cost: 1, client_revenue: 1 },
  });
  if (opts?.reverseAssignmentOrder) {
    seedAssignment(store, b);
    seedAssignment(store, a);
  } else {
    seedAssignment(store, a);
    seedAssignment(store, b);
  }
}

describe("Commercial SSOT regression — Identity", () => {
  it("1:1 — One Commercial Line → One Campaign Assignment", async () => {
    const store = createInMemoryCommercialStore();
    seedLinkedPair(store);
    const svc = createCommercialSynchronizationService(
      createInMemoryCommercialSyncPorts(store)
    );

    const result = await svc.applyMasterChange({
      actorId: "user-42",
      confirmed: true,
      source: { side: "quotation", quotationItemId: "CML-001" },
      changes: { creator_cost: 12000, client_revenue: 18000 },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.commercialLineId, "CML-001");
    assert.deepEqual(result.assignmentIds, ["asg-A"]);
    assert.equal(store.assignments.get("asg-A")?.values.creator_cost, 12000);
    assert.equal(store.assignments.get("asg-noise")?.values.creator_cost, 1);
  });

  it("1:N — One Commercial Line → Multiple Assignments; all linked peers update", async () => {
    const store = createInMemoryCommercialStore();
    seedQuotationItem(store, {
      quotationItemId: "CML-010",
      quotationId: "q1",
      values: { creator_cost: 100, client_revenue: 200, agency_fee_percent: 10 },
    });
    seedAssignment(store, {
      assignmentId: "july",
      campaignHeaderId: "ch1",
      sourceQuotationItemId: "CML-010",
      values: { creator_cost: 50, client_revenue: 100 },
    });
    seedAssignment(store, {
      assignmentId: "august",
      campaignHeaderId: "ch1",
      sourceQuotationItemId: "CML-010",
      values: { creator_cost: 50, client_revenue: 100 },
    });

    const svc = createCommercialSynchronizationService(
      createInMemoryCommercialSyncPorts(store)
    );
    const result = await svc.applyMasterChange({
      actorId: "user-42",
      confirmed: true,
      source: { side: "quotation", quotationItemId: "CML-010" },
      changes: { creator_cost: 300, client_revenue: 400, agency_fee_percent: 20 },
    });

    assert.equal(result.ok, true);
    assert.equal(store.assignments.get("july")?.values.creator_cost, 150);
    assert.equal(store.assignments.get("august")?.values.creator_cost, 150);
    assert.equal(store.assignments.get("july")?.values.agency_fee_percent, 20);
    assert.equal(store.assignments.get("august")?.values.agency_fee_percent, 20);
  });

  it("never depends on Assignment row / UI order", async () => {
    const store = createInMemoryCommercialStore();
    seedLinkedPair(store, { reverseAssignmentOrder: true });
    // Map iteration order has noise first; sync must still hit CML-001 → asg-A
    const svc = createCommercialSynchronizationService(
      createInMemoryCommercialSyncPorts(store)
    );
    const result = await svc.applyMasterChange({
      actorId: "user-42",
      confirmed: true,
      source: { side: "quotation", quotationItemId: "CML-001" },
      changes: { creator_cost: 7777 },
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.assignmentIds, ["asg-A"]);
    assert.equal(store.assignments.get("asg-A")?.values.creator_cost, 7777);
    assert.equal(store.assignments.get("asg-noise")?.values.creator_cost, 1);
  });
});

describe("Commercial SSOT regression — Field Registry", () => {
  it("Master fields synchronize successfully", async () => {
    const store = createInMemoryCommercialStore();
    seedLinkedPair(store);
    const svc = createCommercialSynchronizationService(
      createInMemoryCommercialSyncPorts(store)
    );
    const result = await svc.applyMasterChange({
      actorId: "u",
      confirmed: true,
      source: { side: "campaign", assignmentId: "asg-A" },
      changes: {
        creator_cost: 1,
        client_revenue: 2,
        cost_currency: "USD",
        agency_fee_percent: 8,
        exchange_rate: 50,
      },
    });
    assert.equal(result.ok, true);
    assert.equal(store.quotationItems.get("CML-001")?.values.cost_currency, "USD");
    assert.equal(store.quotationItems.get("CML-001")?.values.agency_fee_percent, 8);
  });

  it("Derived fields cannot be synchronized / edited via sync", async () => {
    assert.equal(getFieldLevel("gross_profit"), "derived");
    assert.equal(isDerivedFieldKey("gross_margin_pct"), true);
    const rejected = assertOnlyMasterChanges({
      creator_cost: 1,
      gross_profit: 9,
    } as never);
    assert.equal(rejected.ok, false);

    const store = createInMemoryCommercialStore();
    seedLinkedPair(store);
    const svc = createCommercialSynchronizationService(
      createInMemoryCommercialSyncPorts(store)
    );
    const result = await svc.applyMasterChange({
      actorId: "u",
      confirmed: true,
      source: { side: "quotation", quotationItemId: "CML-001" },
      changes: { gross_profit: 500 } as never,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "NON_MASTER_FIELD");
  });

  it("Operational fields are rejected from synchronization", async () => {
    assert.equal(isOperationalFieldKey("publishing_dates"), true);
    const store = createInMemoryCommercialStore();
    seedLinkedPair(store);
    const svc = createCommercialSynchronizationService(
      createInMemoryCommercialSyncPorts(store)
    );
    const result = await svc.applyMasterChange({
      actorId: "u",
      confirmed: true,
      source: { side: "quotation", quotationItemId: "CML-001" },
      changes: { publishing_dates: "2026-08-01" } as never,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "NON_MASTER_FIELD");
      assert.ok(result.rejectedFields?.includes("publishing_dates"));
    }
    assert.equal(
      store.quotationItems.get("CML-001")?.values.creator_cost,
      10000
    );
  });

  it("registry lists Master fields used for generic sync (no hard-coded sync branches required)", () => {
    assert.ok(listMasterFields().length >= 5);
    assert.ok(listMasterFields().every((f) => f.quotationColumn && f.campaignColumn));
  });
});

describe("Commercial SSOT regression — Audit", () => {
  it("audit entry includes CML ID, source, user, timestamp, old/new, result", async () => {
    const store = createInMemoryCommercialStore();
    seedLinkedPair(store);
    const svc = createCommercialSynchronizationService(
      createInMemoryCommercialSyncPorts(store)
    );

    await svc.applyMasterChange({
      actorId: "user-audit",
      confirmed: true,
      source: { side: "quotation", quotationItemId: "CML-001" },
      changes: { creator_cost: 12000 },
    });

    const entry = store.audits.find((a) => a.event === "commercial.master_synced");
    assert.ok(entry);
    assert.equal(entry?.commercialLineId, "CML-001");
    assert.equal(entry?.sourceSide, "quotation");
    assert.equal(entry?.actorId, "user-audit");
    assert.ok(entry?.occurredAt && !Number.isNaN(Date.parse(entry.occurredAt)));
    assert.equal(entry?.result, "synced");
    assert.equal((entry?.oldData as { creator_cost?: number })?.creator_cost, 10000);
    assert.equal((entry?.newData as { creator_cost?: number })?.creator_cost, 12000);
  });

  it("blocked and rejected results are auditable", async () => {
    const store = createInMemoryCommercialStore();
    store.financeLock = { locked: true, reasons: ["invoice"] };
    seedLinkedPair(store);
    const svc = createCommercialSynchronizationService(
      createInMemoryCommercialSyncPorts(store)
    );

    await svc.applyMasterChange({
      actorId: "u",
      confirmed: true,
      source: { side: "quotation", quotationItemId: "CML-001" },
      changes: { creator_cost: 2 },
    });
    const blocked = store.audits.find(
      (a) => a.event === "commercial.sync_blocked_finance_lock"
    );
    assert.equal(blocked?.result, "blocked");

    await svc.applyMasterChange({
      actorId: "u",
      confirmed: true,
      source: { side: "quotation", quotationItemId: "CML-001" },
      changes: { performance_metrics: 1 } as never,
    });
    const rejected = store.audits.find((a) => a.event === "commercial.sync_rejected");
    assert.equal(rejected?.result, "rejected");
  });
});

describe("Commercial SSOT regression — Sync service safety", () => {
  it("partial failure rolls back Quotation and Campaign (no divergence)", async () => {
    const store = createInMemoryCommercialStore();
    seedQuotationItem(store, {
      quotationItemId: "CML-010",
      quotationId: "q1",
      values: { creator_cost: 100, client_revenue: 200 },
    });
    seedAssignment(store, {
      assignmentId: "a1",
      campaignHeaderId: "ch1",
      sourceQuotationItemId: "CML-010",
      values: { creator_cost: 50, client_revenue: 100 },
    });
    seedAssignment(store, {
      assignmentId: "a2",
      campaignHeaderId: "ch1",
      sourceQuotationItemId: "CML-010",
      values: { creator_cost: 50, client_revenue: 100 },
    });
    store.failAssignmentWriteAfter = 1;

    const svc = createCommercialSynchronizationService(
      createInMemoryCommercialSyncPorts(store)
    );
    const result = await svc.applyMasterChange({
      actorId: "u",
      confirmed: true,
      source: { side: "quotation", quotationItemId: "CML-010" },
      changes: { creator_cost: 999, client_revenue: 999 },
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "WRITE_FAILED");
    assert.equal(store.quotationItems.get("CML-010")?.values.creator_cost, 100);
    assert.equal(store.assignments.get("a1")?.values.creator_cost, 50);
    assert.equal(store.assignments.get("a2")?.values.creator_cost, 50);
    assert.ok(
      store.audits.some((a) => a.event === "commercial.sync_rolled_back")
    );
  });

  it("idempotency key prevents duplicate synchronization writes", async () => {
    const store = createInMemoryCommercialStore();
    seedLinkedPair(store);
    const ports = createInMemoryCommercialSyncPorts(store);
    const svc = createCommercialSynchronizationService(ports);

    const first = await svc.applyMasterChange({
      actorId: "u",
      confirmed: true,
      idempotencyKey: "req-1",
      source: { side: "quotation", quotationItemId: "CML-001" },
      changes: { creator_cost: 12000 },
    });
    assert.equal(first.ok, true);

    const recalcCount = store.quotationRecalc.length;
    const second = await svc.applyMasterChange({
      actorId: "u",
      confirmed: true,
      idempotencyKey: "req-1",
      source: { side: "quotation", quotationItemId: "CML-001" },
      changes: { creator_cost: 12000 },
    });
    assert.equal(second.ok, true);
    if (second.ok) assert.equal(second.duplicate, true);
    assert.equal(store.quotationRecalc.length, recalcCount);
    assert.equal(store.quotationItems.get("CML-001")?.values.creator_cost, 12000);
  });

  it("no infinite sync loop — service never re-enters applyMasterChange via ports", async () => {
    const store = createInMemoryCommercialStore();
    seedLinkedPair(store);
    let applyDepth = 0;
    let maxDepth = 0;
    const ports = createInMemoryCommercialSyncPorts(store);
    const svc = createCommercialSynchronizationService(ports);

    const originalWriteQ = ports.writeQuotationMaster;
    ports.writeQuotationMaster = async (id, values) => {
      applyDepth += 1;
      maxDepth = Math.max(maxDepth, applyDepth);
      // Mimic a naive caller that might try to sync again — must not be invoked by service
      await originalWriteQ(id, values);
      applyDepth -= 1;
    };

    await svc.applyMasterChange({
      actorId: "u",
      confirmed: true,
      source: { side: "quotation", quotationItemId: "CML-001" },
      changes: { creator_cost: 1 },
    });
    // Depth stays 1: writes do not call applyMasterChange
    assert.equal(maxDepth, 1);
  });

  it("concurrent updates — stale concurrency token is rejected safely", async () => {
    const store = createInMemoryCommercialStore();
    seedLinkedPair(store);
    store.concurrencyTokens.set("CML-001", "token-v1");
    const svc = createCommercialSynchronizationService(
      createInMemoryCommercialSyncPorts(store)
    );

    const conflict = await svc.applyMasterChange({
      actorId: "user-a",
      confirmed: true,
      expectedConcurrencyToken: "token-stale",
      source: { side: "quotation", quotationItemId: "CML-001" },
      changes: { creator_cost: 1 },
    });
    assert.equal(conflict.ok, false);
    if (!conflict.ok) assert.equal(conflict.code, "CONCURRENCY_CONFLICT");
    assert.equal(store.quotationItems.get("CML-001")?.values.creator_cost, 10000);

    const ok = await svc.applyMasterChange({
      actorId: "user-b",
      confirmed: true,
      expectedConcurrencyToken: "token-v1",
      source: { side: "quotation", quotationItemId: "CML-001" },
      changes: { creator_cost: 2222 },
    });
    assert.equal(ok.ok, true);
    assert.equal(store.quotationItems.get("CML-001")?.values.creator_cost, 2222);
    if (ok.ok) assert.ok(ok.concurrencyToken);
  });

  it("concurrent in-flight duplicate key is rejected", async () => {
    const store = createInMemoryCommercialStore();
    seedLinkedPair(store);
    const ports = createInMemoryCommercialSyncPorts(store);
    store.idempotentInFlight.add("inflight-1");
    const svc = createCommercialSynchronizationService(ports);
    const result = await svc.applyMasterChange({
      actorId: "u",
      confirmed: true,
      idempotencyKey: "inflight-1",
      source: { side: "quotation", quotationItemId: "CML-001" },
      changes: { creator_cost: 1 },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "DUPLICATE_IN_FLIGHT");
  });
});
