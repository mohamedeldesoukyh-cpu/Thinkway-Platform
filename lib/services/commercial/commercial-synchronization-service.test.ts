import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCommercialSynchronizationService } from "./commercial-synchronization-service";
import {
  createInMemoryCommercialStore,
  createInMemoryCommercialSyncPorts,
  seedAssignment,
  seedQuotationItem,
} from "./in-memory-ports";

describe("CommercialSynchronizationService", () => {
  it("rejects unconfirmed sync attempts and audits them", async () => {
    const store = createInMemoryCommercialStore();
    seedQuotationItem(store, {
      quotationItemId: "CML-001",
      quotationId: "q1",
      values: { creator_cost: 10000 },
    });
    const svc = createCommercialSynchronizationService(
      createInMemoryCommercialSyncPorts(store)
    );

    const result = await svc.applyMasterChange({
      actorId: "user-1",
      confirmed: false,
      source: { side: "quotation", quotationItemId: "CML-001" },
      changes: { creator_cost: 12000 },
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "NOT_CONFIRMED");
    assert.equal(store.audits[0]?.event, "commercial.sync_not_confirmed");
    assert.equal(
      store.quotationItems.get("CML-001")?.values.creator_cost,
      10000
    );
  });

  it("rejects Derived / Operational fields", async () => {
    const store = createInMemoryCommercialStore();
    seedQuotationItem(store, {
      quotationItemId: "CML-001",
      quotationId: "q1",
    });
    const svc = createCommercialSynchronizationService(
      createInMemoryCommercialSyncPorts(store)
    );

    const result = await svc.applyMasterChange({
      actorId: "user-1",
      confirmed: true,
      source: { side: "quotation", quotationItemId: "CML-001" },
      changes: {
        creator_cost: 1,
        gross_profit: 99,
      } as never,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "NON_MASTER_FIELD");
      assert.ok(result.rejectedFields?.includes("gross_profit"));
    }
  });

  it("syncs Quotation → Campaign by Commercial Line ID (not position)", async () => {
    const store = createInMemoryCommercialStore();
    seedQuotationItem(store, {
      quotationItemId: "CML-001",
      quotationId: "q1",
      values: { creator_cost: 10000, client_revenue: 15000, agency_fee_percent: 10 },
    });
    seedQuotationItem(store, {
      quotationItemId: "CML-002",
      quotationId: "q1",
      values: { creator_cost: 999, client_revenue: 999 },
    });
    // Deliberately seed Assignments in reverse display order vs quote lines
    seedAssignment(store, {
      assignmentId: "asg-B",
      campaignHeaderId: "ch1",
      sourceQuotationItemId: "CML-002",
      values: { creator_cost: 999, client_revenue: 999 },
    });
    seedAssignment(store, {
      assignmentId: "asg-A",
      campaignHeaderId: "ch1",
      sourceQuotationItemId: "CML-001",
      values: { creator_cost: 10000, client_revenue: 15000 },
    });

    const svc = createCommercialSynchronizationService(
      createInMemoryCommercialSyncPorts(store)
    );

    const result = await svc.applyMasterChange({
      actorId: "user-1",
      confirmed: true,
      source: { side: "quotation", quotationItemId: "CML-001" },
      changes: { creator_cost: 12000, client_revenue: 18000 },
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.commercialLineId, "CML-001");
      assert.deepEqual(result.assignmentIds, ["asg-A"]);
      assert.equal(result.allocation, "single");
    }
    assert.equal(
      store.quotationItems.get("CML-001")?.values.creator_cost,
      12000
    );
    assert.equal(store.assignments.get("asg-A")?.values.creator_cost, 12000);
    assert.equal(store.assignments.get("asg-A")?.values.client_revenue, 18000);
    // Peer line with different Origin must not change
    assert.equal(store.assignments.get("asg-B")?.values.creator_cost, 999);
    assert.ok(store.quotationRecalc.includes("q1"));
    assert.ok(store.campaignRecalc.includes("ch1"));
    assert.equal(store.audits.at(-1)?.event, "commercial.master_synced");
    assert.equal(store.audits.at(-1)?.commercialLineId, "CML-001");
  });

  it("syncs Campaign → Quotation by Origin Commercial Line ID", async () => {
    const store = createInMemoryCommercialStore();
    seedQuotationItem(store, {
      quotationItemId: "CML-001",
      quotationId: "q1",
      values: { creator_cost: 10000, client_revenue: 15000 },
    });
    seedAssignment(store, {
      assignmentId: "asg-A",
      campaignHeaderId: "ch1",
      sourceQuotationItemId: "CML-001",
      values: { creator_cost: 10000, client_revenue: 15000 },
    });

    const svc = createCommercialSynchronizationService(
      createInMemoryCommercialSyncPorts(store)
    );

    const result = await svc.applyMasterChange({
      actorId: "user-1",
      confirmed: true,
      source: { side: "campaign", assignmentId: "asg-A" },
      changes: { creator_cost: 11000 },
    });

    assert.equal(result.ok, true);
    assert.equal(
      store.quotationItems.get("CML-001")?.values.creator_cost,
      11000
    );
    assert.equal(store.assignments.get("asg-A")?.values.creator_cost, 11000);
  });

  it("supports 1:N — Quotation edit equal-splits absolute amounts by CML ID", async () => {
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
      actorId: "user-1",
      confirmed: true,
      source: { side: "quotation", quotationItemId: "CML-010" },
      changes: { creator_cost: 300, client_revenue: 400, agency_fee_percent: 15 },
    });

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.allocation, "equal_split");
    assert.equal(
      store.quotationItems.get("CML-010")?.values.creator_cost,
      300
    );
    assert.equal(store.assignments.get("july")?.values.creator_cost, 150);
    assert.equal(store.assignments.get("august")?.values.creator_cost, 150);
    assert.equal(store.assignments.get("july")?.values.agency_fee_percent, 15);
    assert.equal(store.assignments.get("august")?.values.agency_fee_percent, 15);
  });

  it("blocks sync when finance lock port reports locked (Phase 3 hook)", async () => {
    const store = createInMemoryCommercialStore();
    store.financeLock = { locked: true, reasons: ["vendor_io"] };
    seedQuotationItem(store, {
      quotationItemId: "CML-001",
      quotationId: "q1",
      values: { creator_cost: 1 },
    });
    seedAssignment(store, {
      assignmentId: "asg-A",
      campaignHeaderId: "ch1",
      sourceQuotationItemId: "CML-001",
      values: { creator_cost: 1 },
    });

    const svc = createCommercialSynchronizationService(
      createInMemoryCommercialSyncPorts(store)
    );

    const result = await svc.applyMasterChange({
      actorId: "user-1",
      confirmed: true,
      source: { side: "quotation", quotationItemId: "CML-001" },
      changes: { creator_cost: 2 },
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "FINANCE_LOCKED");
    assert.equal(store.quotationItems.get("CML-001")?.values.creator_cost, 1);
    assert.equal(
      store.audits.at(-1)?.event,
      "commercial.sync_blocked_finance_lock"
    );
  });

  it("fails when Assignment has no Origin Commercial Line ID", async () => {
    const store = createInMemoryCommercialStore();
    seedAssignment(store, {
      assignmentId: "orphan",
      campaignHeaderId: "ch1",
      sourceQuotationItemId: null,
      values: { creator_cost: 1 },
    });
    const svc = createCommercialSynchronizationService(
      createInMemoryCommercialSyncPorts(store)
    );

    const result = await svc.applyMasterChange({
      actorId: "user-1",
      confirmed: true,
      source: { side: "campaign", assignmentId: "orphan" },
      changes: { creator_cost: 2 },
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "UNKNOWN_ORIGIN");
  });
});
