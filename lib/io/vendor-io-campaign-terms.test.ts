import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveEffectiveVendorIoTerms, serializeTermsText } from "./client-io-terms";
import { resolveVendorIoCountry } from "./vendor-io-country";
import { VENDOR_IO_DEFAULT_TERMS, VENDOR_IO_COMPLIANCE_CLAUSES } from "./vendor-io-default-terms";
import { vendorIoCampaignTermsPatch, vendorIoCampaignTermsSchema } from "./vendor-io-campaign-terms";
import { resolveVendorIoPaymentSchedule } from "./vendor-io-payment-terms";
import { normalizeLegalText } from "./extract-vendor-io-terms";

test("PDF comparison handles font apostrophe glyphs and wrapped hyphenated words", () => {
  assert.equal(normalizeLegalText("Agencyʼs non-\nexclusive rights"), normalizeLegalText("Agency’s non-exclusive rights"));
  assert.notEqual(normalizeLegalText("three rounds"), normalizeLegalText("two rounds"));
});

test("new platform terms contain all thirteen supplied clauses and retain Egypt compliance", () => {
  assert.equal(VENDOR_IO_DEFAULT_TERMS.length, 13);
  assert.match(VENDOR_IO_DEFAULT_TERMS[0].body, /three \(3\) rounds/);
  assert.match(VENDOR_IO_DEFAULT_TERMS[0].body, /five \(5\) business days/);
  assert.match(VENDOR_IO_DEFAULT_TERMS[1].body, /does not transfer ownership/);
  assert.match(VENDOR_IO_DEFAULT_TERMS[2].body, /AI-generated/);
  assert.equal(VENDOR_IO_DEFAULT_TERMS[5].body, VENDOR_IO_COMPLIANCE_CLAUSES.EG);
  assert.match(VENDOR_IO_DEFAULT_TERMS[8].body, /non-exclusive/);
  assert.match(VENDOR_IO_DEFAULT_TERMS[9].body, /seven \(7\) days/);
  assert.match(VENDOR_IO_DEFAULT_TERMS[10].title, /Force Majeure/);
  assert.doesNotMatch(VENDOR_IO_DEFAULT_TERMS[11].body, /2,000/);
});

test("CRM country default and per-IO override affect only local compliance", () => {
  for (const creatorCountry of ["AE", "UAE", "United Arab Emirates", "are"]) {
    const uae = resolveEffectiveVendorIoTerms(null, null, { creatorCountry });
    assert.equal(uae[5].body, VENDOR_IO_COMPLIANCE_CLAUSES.AE);
    assert.equal(uae[12].body, VENDOR_IO_DEFAULT_TERMS[12].body);
  }
  assert.equal(resolveVendorIoCountry("EG", "AE"), "EG");
  assert.equal(resolveVendorIoCountry(null, "Egypt"), "EG");
  assert.equal(resolveVendorIoCountry(null, null), "EG");
  const first = resolveEffectiveVendorIoTerms(null, null, { override: "EG", creatorCountry: "AE" });
  const second = resolveEffectiveVendorIoTerms(null, null, { creatorCountry: "AE" });
  assert.equal(first[5].body, VENDOR_IO_COMPLIANCE_CLAUSES.EG);
  assert.equal(second[5].body, VENDOR_IO_COMPLIANCE_CLAUSES.AE);
  assert.equal(VENDOR_IO_DEFAULT_TERMS[5].body, VENDOR_IO_COMPLIANCE_CLAUSES.EG);
});

test("IO custom terms retain precedence and country selection supplies compliance", () => {
  const io = [{ title: "Campaign override.", body: "Keep this negotiated term." }];
  const terms = resolveEffectiveVendorIoTerms(serializeTermsText([{ title: "Vendor default.", body: "Other" }]), serializeTermsText(io), { override: "AE" });
  assert.deepEqual(terms[0], io[0]);
  assert.equal(terms[1].body, VENDOR_IO_COMPLIANCE_CLAUSES.AE);
});

test("campaign patch only edits IO commercial fields and validates length and country", () => {
  const input = {
    id: "00000000-0000-4000-8000-000000000001",
    campaign_header_id: "00000000-0000-4000-8000-000000000002",
    updated_at: "2026-09-24T12:00:00+00:00", usage_rights: "  30 days  ",
    special_payment_terms: "  50% in advance, 50% after approval  ", compliance_country_code: "AE",
  };
  const patch = vendorIoCampaignTermsPatch(vendorIoCampaignTermsSchema.parse(input), "actor");
  assert.deepEqual(patch, { usage_rights: "30 days", special_payment_terms: "50% in advance, 50% after approval", compliance_country_code: "AE", updated_by: "actor" });
  assert.equal(vendorIoCampaignTermsSchema.safeParse({ ...input, compliance_country_code: "US" }).success, false);
  assert.equal(vendorIoCampaignTermsSchema.safeParse({ ...input, special_payment_terms: "x".repeat(501) }).success, false);
  assert.equal(vendorIoCampaignTermsSchema.safeParse({ ...input, usage_rights: "x".repeat(2001) }).success, false);
  const cleared = vendorIoCampaignTermsPatch(vendorIoCampaignTermsSchema.parse({ ...input, usage_rights: "", special_payment_terms: "", compliance_country_code: "" }), "actor");
  assert.equal(cleared.compliance_country_code, null);
  assert.equal(cleared.special_payment_terms, null);
  assert.equal(resolveVendorIoPaymentSchedule({ specialPaymentTerms: patch.special_payment_terms, vendorPaymentTerms: "net_90" }), patch.special_payment_terms);
  assert.equal(resolveVendorIoPaymentSchedule({ specialPaymentTerms: cleared.special_payment_terms, vendorPaymentTerms: "net_90" }), "Net 90");
});
