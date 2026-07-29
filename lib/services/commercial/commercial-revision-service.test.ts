import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRevisionLinesFromProposals,
  createCommercialRevisionService,
  createInMemoryRevisionPorts,
} from "./commercial-revision-service";
import {
  createInMemoryCommercialStore,
  createInMemoryCommercialSyncPorts,
  seedAssignment,
  seedQuotationItem,
} from "./in-memory-ports";

function seedLinkedCommercial(
  store: ReturnType<typeof createInMemoryCommercialStore>
) {
  seedQuotationItem(store, {
    quotationItemId: "CML-001",
    quotationId: "q1",
    values: {
      creator_cost: 2000,
      client_revenue: 3000,
      agency_fee_percent: 10,
      cost_currency: "AED",
    },
  });
  seedAssignment(store, {
    assignmentId: "asg-A",
    campaignHeaderId: "ch1",
    sourceQuotationItemId: "CML-001",
    values: {
      creator_cost: 2000,
      client_revenue: 3000,
      agency_fee_percent: 10,
      cost_currency: "AED",
    },
  });
  store.concurrencyTokens.set("CML-001", "token-v1");
}

describe("Commercial Revision Phase 4", () => {
  it("creates a draft revision with dirty Master fields only", async () => {
    const commercial = createInMemoryCommercialStore();
    seedLinkedCommercial(commercial);
    const syncPorts = createInMemoryCommercialSyncPorts(commercial);
    const store = createInMemoryRevisionPorts({
      loadConcurrencyToken: (id) => syncPorts.loadConcurrencyToken(id),
    });
    const svc = createCommercialRevisionService(store, syncPorts);

    const lines = buildRevisionLinesFromProposals([
      {
        commercialLineId: "CML-001",
        assignmentIds: ["asg-A"],
        current: {
          creator_cost: 2000,
          client_revenue: 3000,
          agency_fee_percent: 10,
          cost_currency: "AED",
        },
        proposed: {
          creator_cost: 2000,
          client_revenue: 3200,
          agency_fee_percent: 10,
          cost_currency: "AED",
        },
      },
    ]);

    const created = await svc.createRevision({
      actorId: "user-1",
      campaignHeaderId: "ch1",
      quotationId: "q1",
      reason: "Client amended scope",
      comments: "Revenue uplift",
      lines,
      concurrencyTokens: { "CML-001": "token-v1" },
    });

    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.data.status, "draft");
    assert.equal(created.data.revisionNumber, 1);
    assert.deepEqual(created.data.lines[0].newValues, { client_revenue: 3200 });
    assert.deepEqual(created.data.lines[0].changedFields, ["client_revenue"]);
  });

  it("rejects create when Finance Lock is not active", async () => {
    const commercial = createInMemoryCommercialStore();
    seedLinkedCommercial(commercial);
    const syncPorts = createInMemoryCommercialSyncPorts(commercial);
    const store = createInMemoryRevisionPorts({
      financeLocked: async () => ({ locked: false, reasons: [] }),
    });
    const svc = createCommercialRevisionService(store, syncPorts);
    const result = await svc.createRevision({
      actorId: "u",
      campaignHeaderId: "ch1",
      quotationId: "q1",
      reason: "x",
      lines: buildRevisionLinesFromProposals([
        {
          commercialLineId: "CML-001",
          current: { client_revenue: 1 },
          proposed: { client_revenue: 2 },
        },
      ]),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "FINANCE_NOT_LOCKED");
  });

  it("submit → approve/apply synchronizes Quotation + Campaign and versions", async () => {
    const commercial = createInMemoryCommercialStore();
    seedLinkedCommercial(commercial);
    commercial.financeLock = { locked: true, reasons: ["vendor_io"] };
    const syncPorts = createInMemoryCommercialSyncPorts(commercial);
    const store = createInMemoryRevisionPorts({
      loadConcurrencyToken: (id) => syncPorts.loadConcurrencyToken(id),
    });
    const svc = createCommercialRevisionService(store, syncPorts);

    const created = await svc.createRevision({
      actorId: "requester",
      campaignHeaderId: "ch1",
      quotationId: "q1",
      reason: "PO amendment",
      lines: buildRevisionLinesFromProposals([
        {
          commercialLineId: "CML-001",
          assignmentIds: ["asg-A"],
          current: { client_revenue: 3000, creator_cost: 2000 },
          proposed: { client_revenue: 3500, creator_cost: 2000 },
        },
      ]),
      concurrencyTokens: { "CML-001": "token-v1" },
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const submitted = await svc.submitRevision(created.data.id, "requester");
    assert.equal(submitted.ok, true);

    const applied = await svc.approveAndApplyRevision(
      created.data.id,
      "approver",
      "OK"
    );
    assert.equal(applied.ok, true);
    if (!applied.ok) return;

    assert.equal(applied.data.revision.status, "applied");
    assert.equal(applied.data.version.versionNumber, 2);
    assert.equal(applied.data.version.revisionNumber, 1);
    assert.equal(applied.data.version.approvedBy, "approver");
    assert.equal(
      commercial.quotationItems.get("CML-001")?.values.client_revenue,
      3500
    );
    assert.equal(commercial.assignments.get("asg-A")?.values.client_revenue, 3500);
    assert.equal(
      commercial.quotationItems.get("CML-001")?.values.creator_cost,
      2000
    );
    assert.ok(
      commercial.audits.some(
        (a) =>
          a.event === "commercial.master_synced" &&
          a.metadata?.commercial_revision_id === created.data.id
      )
    );
    assert.equal((await svc.listVersionHistory("ch1")).length, 1);
  });

  it("rejection leaves commercials unchanged", async () => {
    const commercial = createInMemoryCommercialStore();
    seedLinkedCommercial(commercial);
    const syncPorts = createInMemoryCommercialSyncPorts(commercial);
    const store = createInMemoryRevisionPorts();
    const svc = createCommercialRevisionService(store, syncPorts);
    const created = await svc.createRevision({
      actorId: "u",
      campaignHeaderId: "ch1",
      quotationId: "q1",
      reason: "try",
      lines: buildRevisionLinesFromProposals([
        {
          commercialLineId: "CML-001",
          current: { client_revenue: 3000 },
          proposed: { client_revenue: 9999 },
        },
      ]),
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    await svc.submitRevision(created.data.id, "u");
    const rejected = await svc.rejectRevision(created.data.id, "boss", "No");
    assert.equal(rejected.ok, true);
    if (rejected.ok) assert.equal(rejected.data.status, "rejected");
    assert.equal(
      commercial.quotationItems.get("CML-001")?.values.client_revenue,
      3000
    );
  });

  it("blocks concurrent pending revisions and stale concurrency tokens", async () => {
    const commercial = createInMemoryCommercialStore();
    seedLinkedCommercial(commercial);
    const syncPorts = createInMemoryCommercialSyncPorts(commercial);
    const store = createInMemoryRevisionPorts({
      loadConcurrencyToken: async () => "token-v2",
    });
    const svc = createCommercialRevisionService(store, syncPorts);

    const a = await svc.createRevision({
      actorId: "u",
      campaignHeaderId: "ch1",
      quotationId: "q1",
      reason: "A",
      lines: buildRevisionLinesFromProposals([
        {
          commercialLineId: "CML-001",
          current: { client_revenue: 3000 },
          proposed: { client_revenue: 3100 },
        },
      ]),
      concurrencyTokens: { "CML-001": "token-v1" },
    });
    assert.equal(a.ok, true);
    if (!a.ok) return;
    await svc.submitRevision(a.data.id, "u");

    const b = await svc.createRevision({
      actorId: "u",
      campaignHeaderId: "ch1",
      quotationId: "q1",
      reason: "B",
      lines: buildRevisionLinesFromProposals([
        {
          commercialLineId: "CML-001",
          current: { client_revenue: 3000 },
          proposed: { client_revenue: 3200 },
        },
      ]),
    });
    assert.equal(b.ok, true);
    if (!b.ok) return;
    const pendingClash = await svc.submitRevision(b.data.id, "u");
    assert.equal(pendingClash.ok, false);
    if (!pendingClash.ok) assert.equal(pendingClash.code, "PENDING_EXISTS");

    const conflict = await svc.approveAndApplyRevision(a.data.id, "approver");
    assert.equal(conflict.ok, false);
    if (!conflict.ok) assert.equal(conflict.code, "CONCURRENCY_CONFLICT");
  });

  it("supports multiple Commercial Lines and 1:N assignment peers on apply", async () => {
    const commercial = createInMemoryCommercialStore();
    seedQuotationItem(commercial, {
      quotationItemId: "CML-010",
      quotationId: "q1",
      values: { creator_cost: 100, client_revenue: 200 },
    });
    seedQuotationItem(commercial, {
      quotationItemId: "CML-011",
      quotationId: "q1",
      values: { creator_cost: 50, client_revenue: 80 },
    });
    seedAssignment(commercial, {
      assignmentId: "july",
      campaignHeaderId: "ch1",
      sourceQuotationItemId: "CML-010",
      values: { creator_cost: 50, client_revenue: 100 },
    });
    seedAssignment(commercial, {
      assignmentId: "august",
      campaignHeaderId: "ch1",
      sourceQuotationItemId: "CML-010",
      values: { creator_cost: 50, client_revenue: 100 },
    });
    seedAssignment(commercial, {
      assignmentId: "other",
      campaignHeaderId: "ch1",
      sourceQuotationItemId: "CML-011",
      values: { creator_cost: 50, client_revenue: 80 },
    });
    commercial.financeLock = { locked: true, reasons: ["invoice"] };
    commercial.concurrencyTokens.set("CML-010", "t10");
    commercial.concurrencyTokens.set("CML-011", "t11");

    const syncPorts = createInMemoryCommercialSyncPorts(commercial);
    const store = createInMemoryRevisionPorts({
      loadConcurrencyToken: (id) => syncPorts.loadConcurrencyToken(id),
    });
    const svc = createCommercialRevisionService(store, syncPorts);

    const created = await svc.createRevision({
      actorId: "u",
      campaignHeaderId: "ch1",
      quotationId: "q1",
      reason: "Multi-line revision",
      lines: buildRevisionLinesFromProposals([
        {
          commercialLineId: "CML-010",
          assignmentIds: ["july", "august"],
          current: { creator_cost: 100, client_revenue: 200 },
          proposed: { creator_cost: 120, client_revenue: 240 },
        },
        {
          commercialLineId: "CML-011",
          assignmentIds: ["other"],
          current: { creator_cost: 50, client_revenue: 80 },
          proposed: { creator_cost: 50, client_revenue: 90 },
        },
      ]),
      concurrencyTokens: { "CML-010": "t10", "CML-011": "t11" },
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    await svc.submitRevision(created.data.id, "u");
    const applied = await svc.approveAndApplyRevision(created.data.id, "approver");
    assert.equal(applied.ok, true);

    assert.equal(commercial.quotationItems.get("CML-010")?.values.creator_cost, 120);
    assert.equal(commercial.assignments.get("july")?.values.creator_cost, 60);
    assert.equal(commercial.assignments.get("august")?.values.creator_cost, 60);
    assert.equal(commercial.quotationItems.get("CML-011")?.values.client_revenue, 90);
    assert.equal(commercial.assignments.get("other")?.values.client_revenue, 90);
  });

  it("preserves version history across sequential revisions (no overwrite)", async () => {
    const commercial = createInMemoryCommercialStore();
    seedLinkedCommercial(commercial);
    commercial.financeLock = { locked: true, reasons: ["vendor_io"] };
    const syncPorts = createInMemoryCommercialSyncPorts(commercial);
    const store = createInMemoryRevisionPorts({
      loadConcurrencyToken: (id) => syncPorts.loadConcurrencyToken(id),
      snapshots: [
        {
          versionNumber: 1,
          revisionNumber: null,
          revisionId: null,
          campaignHeaderId: "ch1",
          createdBy: "system",
          approvedBy: null,
          date: "2026-07-01T00:00:00Z",
          reason: "Convert baseline",
          fieldChangeSummary: [],
          snapshotId: "snap-ch1-v1",
        },
      ],
    });
    const svc = createCommercialRevisionService(store, syncPorts);

    async function revise(revenue: number, token: string) {
      commercial.concurrencyTokens.set("CML-001", token);
      const created = await svc.createRevision({
        actorId: "u",
        campaignHeaderId: "ch1",
        quotationId: "q1",
        reason: `Set revenue ${revenue}`,
        lines: buildRevisionLinesFromProposals([
          {
            commercialLineId: "CML-001",
            current: {
              client_revenue: Number(
                commercial.quotationItems.get("CML-001")?.values.client_revenue
              ),
            },
            proposed: { client_revenue: revenue },
          },
        ]),
        concurrencyTokens: { "CML-001": token },
      });
      assert.equal(created.ok, true);
      if (!created.ok) return;
      await svc.submitRevision(created.data.id, "u");
      const applied = await svc.approveAndApplyRevision(created.data.id, "approver");
      assert.equal(applied.ok, true);
    }

    await revise(3100, "token-v1");
    await revise(3200, commercial.concurrencyTokens.get("CML-001")!);

    const history = await svc.listVersionHistory("ch1");
    assert.ok(history.length >= 3);
    assert.equal(history[0].versionNumber, 3);
    assert.equal(history.find((h) => h.versionNumber === 1)?.reason, "Convert baseline");
    assert.equal(
      commercial.quotationItems.get("CML-001")?.values.client_revenue,
      3200
    );
  });

  it("apply failure does not mark revision applied (rollback semantics)", async () => {
    const commercial = createInMemoryCommercialStore();
    seedLinkedCommercial(commercial);
    commercial.financeLock = { locked: true, reasons: ["vendor_io"] };
    commercial.failAssignmentWriteAfter = 0;
    const syncPorts = createInMemoryCommercialSyncPorts(commercial);
    const store = createInMemoryRevisionPorts({
      loadConcurrencyToken: (id) => syncPorts.loadConcurrencyToken(id),
    });
    const svc = createCommercialRevisionService(store, syncPorts);
    const created = await svc.createRevision({
      actorId: "u",
      campaignHeaderId: "ch1",
      quotationId: "q1",
      reason: "fail",
      lines: buildRevisionLinesFromProposals([
        {
          commercialLineId: "CML-001",
          current: { client_revenue: 3000 },
          proposed: { client_revenue: 4000 },
        },
      ]),
      concurrencyTokens: { "CML-001": "token-v1" },
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    await svc.submitRevision(created.data.id, "u");
    const applied = await svc.approveAndApplyRevision(created.data.id, "approver");
    assert.equal(applied.ok, false);
    const rev = await svc.getRevision(created.data.id);
    assert.notEqual(rev?.status, "applied");
    assert.equal(rev?.status, "pending_approval");
    assert.equal(
      commercial.quotationItems.get("CML-001")?.values.client_revenue,
      3000
    );
  });

  it("future merge scenarios keep Commercial Line ID as the apply join key", async () => {
    // N:1 merge (many Assignments → one surviving CML) is not a separate
    // sync engine: revisions always key by immutable Commercial Line ID.
    const commercial = createInMemoryCommercialStore();
    seedQuotationItem(commercial, {
      quotationItemId: "CML-MERGE",
      quotationId: "q1",
      values: { client_revenue: 1000, creator_cost: 500 },
    });
    seedAssignment(commercial, {
      assignmentId: "survivor",
      campaignHeaderId: "ch1",
      sourceQuotationItemId: "CML-MERGE",
      values: { client_revenue: 1000, creator_cost: 500 },
    });
    commercial.concurrencyTokens.set("CML-MERGE", "t1");
    commercial.financeLock = { locked: true, reasons: ["invoice"] };

    const syncPorts = createInMemoryCommercialSyncPorts(commercial);
    const store = createInMemoryRevisionPorts({
      loadConcurrencyToken: (id) => syncPorts.loadConcurrencyToken(id),
    });
    const svc = createCommercialRevisionService(store, syncPorts);
    const created = await svc.createRevision({
      actorId: "u",
      campaignHeaderId: "ch1",
      quotationId: "q1",
      reason: "Post-merge commercial correction",
      lines: buildRevisionLinesFromProposals([
        {
          commercialLineId: "CML-MERGE",
          assignmentIds: ["survivor"],
          current: { client_revenue: 1000 },
          proposed: { client_revenue: 1250 },
        },
      ]),
      concurrencyTokens: { "CML-MERGE": "t1" },
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    await svc.submitRevision(created.data.id, "u");
    const applied = await svc.approveAndApplyRevision(created.data.id, "approver");
    assert.equal(applied.ok, true);
    assert.equal(
      commercial.quotationItems.get("CML-MERGE")?.values.client_revenue,
      1250
    );
    assert.equal(
      commercial.assignments.get("survivor")?.values.client_revenue,
      1250
    );
    assert.equal(created.data.lines[0]?.commercialLineId, "CML-MERGE");
  });
});
