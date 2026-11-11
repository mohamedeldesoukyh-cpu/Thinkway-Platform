import assert from "node:assert/strict";
import { test } from "node:test";
import { isUgcOnlyVendorIo, resolveEffectiveVendorIoTerms, serializeTermsText } from "./client-io-terms";
import { VENDOR_IO_DEFAULT_TERMS, VENDOR_IO_COMPLIANCE_CLAUSES } from "./vendor-io-default-terms";
import { VENDOR_IO_UGC_DEFAULT_TERMS } from "./vendor-io-ugc-default-terms";
import { applyVendorIoComplianceCountry } from "./vendor-io-country";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadVendorIoDocumentData } from "./vendor-io-document-data";
import { renderVendorIoHtml } from "./vendor-io-template-render";
import { composeCreatorAgreementTerms } from "../creators/crm/agreement-compose";

function mockClient(tables: Record<string, unknown>): SupabaseClient {
  return { from(table: string) {
    const result = { data: tables[table] ?? null, error: null };
    const query = {
      select() { return query; }, eq() { return query; }, in() { return query; },
      order() { return query; }, limit() { return query; }, is() { return query; },
      single() { return Promise.resolve(result); }, maybeSingle() { return Promise.resolve(result); },
      then: Promise.resolve(result).then.bind(Promise.resolve(result)),
    };
    return query;
  } } as unknown as SupabaseClient;
}

test("UGC-only scopes use Milad's saved terms for both legacy and current UGC codes", () => {
  for (const deliverableTypes of [["ugc"], ["ugc_video"], ["UGC", "ugc_video"]]) {
    assert.ok(isUgcOnlyVendorIo(deliverableTypes));
    assert.deepEqual(resolveEffectiveVendorIoTerms(null, null, { deliverableTypes, creatorCountry: "AE" }), VENDOR_IO_UGC_DEFAULT_TERMS);
  }
  assert.match(VENDOR_IO_UGC_DEFAULT_TERMS[0].body, /content production only/);
  assert.match(VENDOR_IO_UGC_DEFAULT_TERMS[2].body, /supplied or expressly approved/);
});

test("mixed, non-UGC, empty and unknown scopes retain current standard terms", () => {
  for (const deliverableTypes of [["ugc", "instagram_reel"], ["ugc_video", "instagram_story"], ["instagram_reel"], ["other"], [], undefined]) {
    assert.equal(isUgcOnlyVendorIo(deliverableTypes), false);
    assert.deepEqual(resolveEffectiveVendorIoTerms(null, null, { deliverableTypes }), VENDOR_IO_DEFAULT_TERMS);
  }
});

test("explicit IO and vendor overrides retain precedence over UGC defaults", () => {
  const vendor = [{ title: "Vendor terms", body: "Custom vendor wording" }];
  const io = [{ title: "IO terms", body: "Custom IO wording" }];
  const scope = { deliverableTypes: ["ugc"], creatorCountry: "AE" };
  assert.deepEqual(resolveEffectiveVendorIoTerms(serializeTermsText(vendor), serializeTermsText(io), scope), applyVendorIoComplianceCountry(io, "AE"));
  assert.deepEqual(resolveEffectiveVendorIoTerms(serializeTermsText(vendor), null, scope), applyVendorIoComplianceCountry(vendor, "AE"));
});

test("UGC defaults retain country-specific compliance without mutating the saved template", () => {
  const terms = resolveEffectiveVendorIoTerms(null, null, { deliverableTypes: ["ugc"], override: "EG", creatorCountry: "AE" });
  assert.equal(terms[5].body, VENDOR_IO_COMPLIANCE_CLAUSES.EG);
  assert.equal(terms[0].body, VENDOR_IO_UGC_DEFAULT_TERMS[0].body);
  assert.equal(VENDOR_IO_UGC_DEFAULT_TERMS[5].body, VENDOR_IO_COMPLIANCE_CLAUSES.AE);
});

test("document loader and HTML use the same UGC scope and contracted quantity", async () => {
  for (const types of [["ugc"], ["ugc", "instagram_reel"]]) {
    const client = mockClient({
      vendor_ios: { id: "io", document_number: "VIO-TEST", amount: 2250, currency_code: "AED", status: "draft", influencer_id: "creator", campaign_header_id: "campaign", created_at: "2026-11-11" },
      influencers: { id: "creator", display_name: "Creator", country_code: "AE", categories: [], languages: [] },
      campaign_headers: { id: "campaign", document_number: "TW-TEST", name: "Test", clients: { name: "Client" }, brands: { name: "Brand" } },
      vendor_io_lines: [{ campaign_line_id: "line", campaign_lines: { id: "line", name: "Creator", document_number: "TW-TEST-C", cost_before_vat: 2250 } }],
      assignment_deliverables: types.map(deliverable_type => ({ platform: "instagram", deliverable_type, quantity: 3, unit_cost: 750, total_cost: 2250 })),
      influencer_platform_accounts: [{ platform: "instagram", handle: "creator", is_primary: true, follower_count: 1000 }],
    });
    const doc = await loadVendorIoDocumentData(client, "io");
    assert.equal(doc.deliverables[0].quantity, 3);
    assert.equal(doc.deliverables[0].totalCost, 2250);
    assert.equal(doc.terms[0].body, types.length === 1 ? VENDOR_IO_UGC_DEFAULT_TERMS[0].body : VENDOR_IO_DEFAULT_TERMS[0].body);
    assert.equal(renderVendorIoHtml(doc).includes("content production only"), types.length === 1);
  }
});

test("new agreement composition selects UGC default while preserving saved agreements", async () => {
  const scope = { influencerId: "creator", clientId: "client", deliverableTypes: ["ugc"] };
  const ugc = await composeCreatorAgreementTerms(mockClient({}), scope);
  assert.match(ugc.termsText, /content production only/);
  const mixed = await composeCreatorAgreementTerms(mockClient({}), { ...scope, deliverableTypes: ["ugc", "instagram_reel"] });
  assert.doesNotMatch(mixed.termsText, /content production only/);
  const saved = await composeCreatorAgreementTerms(mockClient({ creator_agreement_templates: { id: "template", terms_text: "Custom agreement" } }), scope);
  assert.equal(saved.termsText, "Custom agreement");
});
