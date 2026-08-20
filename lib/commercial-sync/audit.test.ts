import assert from "node:assert/strict";
import { test } from "node:test";

import { AUDIT_ACTIONS, isAuditAction, normalizeAuditAction } from "@/lib/audit/audit-action";
import { buildQuotationLifecycleAuditInsert } from "@/lib/commercial-sync/audit";

test("existing audit actions remain valid enum values", () => {
  for (const action of Object.values(AUDIT_ACTIONS)) {
    assert.equal(normalizeAuditAction(action), action);
    assert.equal(isAuditAction(action), true);
  }
  assert.equal(isAuditAction("quotation.client_approved"), false);
});

test("client quotation approval writes a valid approve audit record", () => {
  const timestamp = "2026-08-20T15:00:00.000Z";
  const payload = buildQuotationLifecycleAuditInsert({
    quotationId: "quote-1",
    actorId: null,
    event: "quotation.client_approved",
    summary: "Client approved the quotation. Campaign conversion is now allowed.",
    newData: { status: "approved" },
    metadata: {
      review_id: "review-1",
      journey_id: "journey-1",
      actor_label: "Liwa",
      timestamp,
    },
  });

  assert.equal(payload.action, AUDIT_ACTIONS.APPROVE);
  assert.equal(isAuditAction(payload.action), true);
  assert.equal(payload.entity_type, "quotation");
  assert.equal(payload.entity_id, "quote-1");
  assert.equal(payload.actor_id, null);
  assert.equal(payload.new_data?.status, "approved");
  assert.equal(payload.metadata?.entity, "quotation");
  assert.equal(payload.metadata?.event, "client_approved");
  assert.equal(payload.metadata?.quotation_id, "quote-1");
  assert.equal(payload.metadata?.review_id, "review-1");
  assert.equal(payload.metadata?.journey_id, "journey-1");
  assert.equal(payload.metadata?.approval_source, "client_workspace");
  assert.equal(payload.metadata?.actor_kind, "client");
  assert.equal(payload.metadata?.actor_label, "Liwa");
  assert.equal(payload.metadata?.timestamp, timestamp);
  assert.notEqual(payload.metadata?.event, "approved");
  assert.notEqual(payload.action, "quotation.client_approved");
});

test("internal quotation lifecycle events are not rewritten as client approval", () => {
  const payload = buildQuotationLifecycleAuditInsert({
    quotationId: "quote-1",
    actorId: "staff-1",
    event: "quotation.version_created",
    summary: "Generated quotation version QT-2026-0018-V2.",
  });
  assert.equal(payload.action, "quotation.version_created");
  assert.equal(payload.metadata?.event, "quotation.version_created");
  assert.equal(payload.metadata?.approval_source, undefined);
  assert.equal(payload.metadata?.actor_kind, undefined);
});
