import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCommercialSynchronizationService } from "./commercial-synchronization-service";
import {
  diffMasterChanges,
  resolveDerivedRecalcPlan,
} from "./field-registry";
import {
  createInMemoryCommercialStore,
  createInMemoryCommercialSyncPorts,
  seedAssignment,
  seedQuotationItem,
} from "./in-memory-ports";

describe("Dirty-state Master sync", () => {
  it("diffMasterChanges keeps only fields that actually changed", () => {
    const { dirty, fieldChanges } = diffMasterChanges(
      {
        creator_cost: 2000,
        client_revenue: 3000,
        cost_currency: "AED",
        agency_fee_percent: 15,
      },
      {
        creator_cost: 2000,
        client_revenue: 3200,
        cost_currency: "AED",
        agency_fee_percent: 15,
      }
    );
    assert.deepEqual(dirty, { client_revenue: 3200 });
    assert.equal(fieldChanges.length, 1);
    assert.equal(fieldChanges[0].label, "Client Revenue");
    assert.equal(fieldChanges[0].oldValue, 3000);
    assert.equal(fieldChanges[0].newValue, 3200);
  });

  it("sync writes only dirty fields and audits field-level old→new", async () => {
    const store = createInMemoryCommercialStore();
    seedQuotationItem(store, {
      quotationItemId: "CML-001",
      quotationId: "q1",
      values: {
        creator_cost: 2000,
        client_revenue: 3000,
        cost_currency: "AED",
        agency_fee_percent: 15,
      },
    });
    seedAssignment(store, {
      assignmentId: "asg-A",
      campaignHeaderId: "ch1",
      sourceQuotationItemId: "CML-001",
      values: {
        creator_cost: 2000,
        client_revenue: 3000,
        cost_currency: "AED",
        agency_fee_percent: 15,
      },
    });

    const ports = createInMemoryCommercialSyncPorts(store);
    const wroteQ: unknown[] = [];
    const wroteA: unknown[] = [];
    const originalQ = ports.writeQuotationMaster;
    const originalA = ports.writeAssignmentMaster;
    ports.writeQuotationMaster = async (id, values) => {
      wroteQ.push({ id, values });
      return originalQ(id, values);
    };
    ports.writeAssignmentMaster = async (id, values) => {
      wroteA.push({ id, values });
      return originalA(id, values);
    };

    const svc = createCommercialSynchronizationService(ports);
    const result = await svc.applyMasterChange({
      actorId: "finance-user",
      confirmed: true,
      source: { side: "quotation", quotationItemId: "CML-001" },
      changes: {
        creator_cost: 2000,
        client_revenue: 3200,
        cost_currency: "AED",
        agency_fee_percent: 15,
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.applied, { client_revenue: 3200 });
    assert.equal(result.fieldChanges.length, 1);
    assert.deepEqual(wroteQ[0], {
      id: "CML-001",
      values: { client_revenue: 3200 },
    });
    assert.deepEqual(wroteA[0], {
      id: "asg-A",
      values: { client_revenue: 3200 },
    });
    // Unchanged masters preserved on both sides
    assert.equal(store.quotationItems.get("CML-001")?.values.creator_cost, 2000);
    assert.equal(store.quotationItems.get("CML-001")?.values.agency_fee_percent, 15);
    assert.equal(store.assignments.get("asg-A")?.values.creator_cost, 2000);

    const audit = store.audits.find((a) => a.event === "commercial.master_synced");
    assert.ok(audit?.fieldChanges);
    assert.equal(audit?.fieldChanges?.[0].label, "Client Revenue");
    assert.equal(audit?.oldData?.client_revenue, 3000);
    assert.equal(audit?.newData?.client_revenue, 3200);
    assert.match(String(audit?.metadata?.changed_keys), /client_revenue/);
  });

  it("noop when proposed values equal current — no write, no recalc", async () => {
    const store = createInMemoryCommercialStore();
    seedQuotationItem(store, {
      quotationItemId: "CML-001",
      quotationId: "q1",
      values: { creator_cost: 2000, client_revenue: 3000 },
    });
    seedAssignment(store, {
      assignmentId: "asg-A",
      campaignHeaderId: "ch1",
      sourceQuotationItemId: "CML-001",
      values: { creator_cost: 2000, client_revenue: 3000 },
    });
    const svc = createCommercialSynchronizationService(
      createInMemoryCommercialSyncPorts(store)
    );
    const result = await svc.applyMasterChange({
      actorId: "u",
      confirmed: true,
      source: { side: "quotation", quotationItemId: "CML-001" },
      changes: { creator_cost: 2000, client_revenue: 3000 },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.allocation, "noop");
      assert.equal(result.recalculated, false);
    }
    assert.equal(store.quotationRecalc.length, 0);
    assert.equal(store.audits.length, 0);
  });
});

describe("Derived recalculation dependencies", () => {
  it("Revenue dirty triggers GP / totals; notes-like empty masters do not", () => {
    const revenuePlan = resolveDerivedRecalcPlan(["client_revenue"]);
    assert.equal(revenuePlan.requiresQuotationTotals, true);
    assert.ok(revenuePlan.derivedKeys.includes("gross_profit"));
    assert.ok(revenuePlan.derivedKeys.includes("gross_margin_pct"));

    const vatOnly = resolveDerivedRecalcPlan(["revenue_vat_exempt"]);
    assert.equal(vatOnly.requiresQuotationTotals, false);
    assert.equal(vatOnly.requiresCampaignSummary, true);
  });

  it("sync skips quotation totals recalc when only VAT flags change", async () => {
    const store = createInMemoryCommercialStore();
    seedQuotationItem(store, {
      quotationItemId: "CML-001",
      quotationId: "q1",
      values: { creator_cost: 1, client_revenue: 2, revenue_vat_exempt: false },
    });
    seedAssignment(store, {
      assignmentId: "asg-A",
      campaignHeaderId: "ch1",
      sourceQuotationItemId: "CML-001",
      values: { creator_cost: 1, client_revenue: 2, revenue_vat_exempt: false },
    });
    const svc = createCommercialSynchronizationService(
      createInMemoryCommercialSyncPorts(store)
    );
    const result = await svc.applyMasterChange({
      actorId: "u",
      confirmed: true,
      source: { side: "quotation", quotationItemId: "CML-001" },
      changes: { revenue_vat_exempt: true },
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.recalculated, true); // campaign summary only
    assert.equal(store.quotationRecalc.length, 0);
    assert.ok(store.campaignRecalc.includes("ch1"));
  });
});
