import assert from "node:assert/strict";
import { test } from "node:test";
import { clientIoFxRates } from "./client-io-fx";
import { makeCreatorFx } from "@/lib/commercial/creator-fx";
import { buildClientIoAssignmentSnapshot } from "./client-io-assignment-snapshot";
import { loadClientIoDocumentData, clientIoSnapshotTotal } from "./client-io-document-data";
import { clientIoGeneratedEmailTotal, sumClientIoComposerAgreedAmount } from "@/lib/email/io-email-summary";

test("mixed-currency Client IO freezes custom rates and normal rates independently", async () => {
  const db = { rpc: async (_name: string, args: { p_from_currency: string }) => ({ data: args.p_from_currency === "USD" ? 52.2151 : 15.5, error: null }) };
  const rates = await clientIoFxRates(db as never, [
    { id: "custom", currency_code: "USD", revenue_fx_override: makeCreatorFx("USD", "EGP", 55, 1) },
    { id: "normal", currency_code: "USD" },
    { id: "aed", currency_code: "AED" },
  ], "EGP");
  assert.deepEqual(rates, { custom: 55, normal: 52.2151, aed: 15.5 });
  assert.equal(500 * rates.custom, 27500);
  const snapshot = buildClientIoAssignmentSnapshot({ documentCurrency: "EGP", assignmentFxRates: rates, selectedCampaignLineIds: [], lines: [], deliverables: [] });
  assert.equal(snapshot.documentCurrency, "EGP");
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)).assignmentFxRates, rates);
});

test("native currency preserves original commercial amounts", async () => {
  const db = { rpc: () => { throw new Error("No FX lookup needed"); } };
  assert.deepEqual(await clientIoFxRates(db as never, [{ id: "a", currency_code: "USD", revenue_fx_override: makeCreatorFx("USD", "EGP", 55, 1) }], "USD"), { a: 1 });
});

test("Client IO document totals include custom FX for revenue, usage and fees and remain frozen", async () => {
  const lines = [
    { id: "usd", document_number: "A", name: "USD creator", description: null, metadata: null, currency_code: "USD", revenue: 500, revenue_before_vat: 500, usage_rights_amount: 100, agency_fee_amount: 60, agency_fee_percent: 10, revenue_vat_percent: 14, revenue_vat_exempt: false, revenue_fx_override: makeCreatorFx("USD", "EGP", 55, 1), sort_order: 0 },
    { id: "aed", document_number: "B", name: "AED creator", description: null, metadata: null, currency_code: "AED", revenue: 1000, revenue_before_vat: 1000, usage_rights_amount: 0, agency_fee_amount: 100, agency_fee_percent: 10, revenue_vat_percent: 14, revenue_vat_exempt: false, sort_order: 1 },
  ];
  const db = {
    rpc: async (_name: string, args: { p_from_currency: string }) => ({ data: args.p_from_currency === "USD" ? 52.2151 : 15.5, error: null }),
    from(table: string) {
      const data: Record<string, unknown> = {
        client_ios: { id: "io", status: "draft", campaign_header_id: "campaign", client_id: "client" },
        client_io_assignments: lines.map(l => ({ campaign_line_id: l.id })),
        campaign_headers: { id: "campaign", name: "Campaign", currency_code: "EGP", metadata: {}, brands: null, clients: null },
        clients: { id: "client", name: "Client", metadata: {}, legal_address: {}, billing_address: {} },
        campaign_lines: lines, assignment_deliverables: [], client_io_billing_milestones: [],
      };
      const result = { data: data[table] ?? null, error: null };
      const q = { select() { return q; }, eq() { return q; }, in() { return q; }, order() { return q; }, single: async () => result, then(resolve: (r: unknown) => unknown) { return Promise.resolve(result).then(resolve); } };
      return q;
    },
  };
  const live = await loadClientIoDocumentData(db as never, "io");
  assert.equal(live.currencyCode, "EGP");
  const snapshot = buildClientIoAssignmentSnapshot({ documentCurrency: "EGP", assignmentFxRates: { usd: 55, aed: 15.5 }, selectedCampaignLineIds: ["usd", "aed"], lines, deliverables: [] });
  db.rpc = async () => { throw new Error("Frozen document must not request current FX"); };
  const frozen = await loadClientIoDocumentData(db as never, "io", null, { assignmentSnapshot: snapshot });
  assert.deepEqual(frozen.pricing, live.pricing);
  assert.deepEqual(clientIoSnapshotTotal(snapshot), { amount: frozen.pricing.total, currency: "EGP", assignmentCount: 2 });
  assert.equal(frozen.pricing.revenueTotal, 43000);
  assert.equal(frozen.pricing.usageRightsTotal, 5500);
  assert.equal(frozen.pricing.agencyFeeTotal, 4850);
  assert.deepEqual(clientIoGeneratedEmailTotal(clientIoSnapshotTotal(snapshot)), {
    amount: frozen.pricing.total, currencyCode: frozen.currencyCode,
  });
  assert.deepEqual(sumClientIoComposerAgreedAmount(lines, lines.map(line => line.id), "EGP", { EGP: 1, USD: 52.2151, AED: 15.5 }), {
    amount: frozen.pricing.total, currencyCode: "EGP",
  });
  assert.equal(sumClientIoComposerAgreedAmount(lines, [], "EGP"), null);
  assert.equal(sumClientIoComposerAgreedAmount(lines, ["aed"], "EGP"), null);
});
