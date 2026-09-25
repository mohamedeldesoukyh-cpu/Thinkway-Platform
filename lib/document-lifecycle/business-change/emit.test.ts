import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assignmentCommercialChangeScope } from "@/lib/assignments/assignment-commercial-masters";
import { planDocumentLifecycleReactions, type EmitBusinessChangeInput } from "./emit";

const before = { revenue_before_vat: 100, cost_before_vat: 70, usage_rights_cost: 0, usage_rights_amount: 0, agency_fee_percent: 0, currency_code: "EGP", cost_vat_percent: 0, revenue_vat_percent: 14 };
function database() {
  return { from(table: string) {
    const query = {
      select() { return query; }, eq() { return query; }, in() { return query; },
      then(resolve: (result: unknown) => unknown) { return Promise.resolve(resolve({ data: [{ id: table, status: "sent", sent_at: "2026-09-01", delivery_method: "manual", delivery_status: "completed", is_superseded: false, document_number: table }], error: null })); },
    };
    return query;
  } } as unknown as SupabaseClient;
}
const input: EmitBusinessChangeInput = { eventType: "creator_price_updated", reasonCode: "creator_price_changed", reasonDetail: "Creator cost changed", campaignHeaderId: "campaign" };

for (const [label, patch] of Object.entries({ cost: { cost_before_vat: 80 }, vat: { cost_vat_percent: 14 }, exemption: { cost_vat_exempt: true }, usage: { usage_rights_cost: 10 } })) {
  test(`${label}-only changes revise Vendor IO but preserve issued Client IO`, async () => {
    const documentScope = assignmentCommercialChangeScope(before, { ...before, ...patch });
    assert.deepEqual(documentScope, { client: false, vendor: true });
    const reactions = await planDocumentLifecycleReactions(database(), { ...input, documentScope });
    assert.deepEqual(reactions.map((r) => r.documentType), ["vendor_io"]);
  });
}
for (const patch of [{ revenue_before_vat: 110 }, { agency_fee_percent: 10 }, { usage_rights_amount: 5 }, { revenue_vat_percent: 5 }]) {
  test(`client billing change ${Object.keys(patch)[0]} still requires Client IO review`, async () => {
    const documentScope = assignmentCommercialChangeScope(before, { ...before, ...patch });
    assert.deepEqual(documentScope, { client: true, vendor: false });
    const reactions = await planDocumentLifecycleReactions(database(), { ...input, eventType: "manual_mark_revision_required", documentScope });
    assert.deepEqual(reactions.map((r) => r.documentType), ["client_io"]);
  });
}
test("mixed client and creator edits revise both documents", async () => {
  const documentScope = assignmentCommercialChangeScope(before, { ...before, cost_before_vat: 80, revenue_before_vat: 120 });
  const reactions = await planDocumentLifecycleReactions(database(), { ...input, documentScope });
  assert.deepEqual(reactions.map((r) => r.documentType), ["vendor_io", "client_io"]);
});
test("legacy creator events cannot mark Client IO without explicit client impact", async () => {
  const reactions = await planDocumentLifecycleReactions(database(), input);
  assert.deepEqual(reactions.map((r) => r.documentType), ["vendor_io"]);
});
test("currency changes remain material; unchanged values and rounding noise do not", () => {
  assert.deepEqual(assignmentCommercialChangeScope(before, { ...before, currency_code: "USD" }), { client: true, vendor: true });
  assert.deepEqual(assignmentCommercialChangeScope(before, { ...before, revenue_before_vat: 100.00001 }), { client: false, vendor: false });
});
test("client scope and payment-term events retain review by default", async () => {
  for (const eventType of ["deliverables_changed", "payment_terms_changed", "campaign_budget_changed"] as const) {
    const reactions = await planDocumentLifecycleReactions(database(), { ...input, eventType });
    assert.ok(reactions.some((r) => r.documentType === "client_io"));
  }
});
