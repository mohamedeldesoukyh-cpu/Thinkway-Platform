/**
 * Document parity — HTML vs PDF legal terms for Vendor IO.
 * Run via: npm run test:vendor-io-terms
 */
import assert from "node:assert/strict";

import {
  renderTermsListHtml,
  serializeTermsText,
  termsAreEqual,
  type ClientIoTerm,
} from "./client-io-terms";
import {
  extractTermsFromVendorIoHtml,
  pdfContainsTermsInOrder,
} from "./extract-vendor-io-terms";
import { renderVendorIoHtml } from "./vendor-io-template-render";
import { INSERTION_ORDER_PDF_OPTIONS, renderHtmlToPdf } from "./vendor-io-pdf";
import { extractPdfText } from "@/lib/discovery-import/parsers/pdf-text";
import { VENDOR_IO_DEFAULT_TERMS } from "./vendor-io-default-terms";
import type { VendorIoDocumentData } from "./vendor-io-document-types";

function fixtureData(terms: ClientIoTerm[]): VendorIoDocumentData {
  return {
    vendorIoId: "00000000-0000-4000-8000-000000000001",
    documentNumber: "VIO-2026-PARITY",
    revisionNumber: 0,
    issuedAt: "2026-07-27T12:00:00.000Z",
    issuedCountry: "Egypt",
    currencyCode: "EGP",
    status: "draft",
    amount: 1000,
    usageRights: null,
    terms,
    influencer: {
      id: "00000000-0000-4000-8000-000000000002",
      displayName: "Parity Vendor",
      legalName: "Parity Vendor LLC",
      email: "parity@example.com",
      phone: null,
      nationality: null,
      address: null,
      nationalId: null,
      categories: [],
      countryCode: "EG",
      languages: [],
      paymentDetails: {},
    },
    campaign: {
      id: "00000000-0000-4000-8000-000000000003",
      documentNumber: "TW-2026-0001",
      name: "Parity Campaign",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      clientName: "Parity Client",
      brandName: "Parity Brand",
      channels: "Instagram",
      usagePeriod: null,
    },
    influencerMetrics: {
      handle: "@parity",
      platforms: "Instagram",
      followerCount: "10K",
      niche: "—",
      audience: "—",
      engagementRate: "—",
    },
    deliverables: [
      {
        platform: "instagram",
        deliverableType: "Reel",
        quantity: 1,
        handle: "@parity",
        scheduledDates: "Jul 2026",
        unitCost: 1000,
        totalCost: 1000,
      },
    ],
    pricing: {
      contentCreationFee: 1000,
      usageRightsFee: 0,
      vatAmount: 0,
      vatPercent: 0,
      totalDue: 1000,
    },
    assignmentLineNames: ["Line A"],
    assignmentDocumentNumbers: ["TW-2026-0001-A"],
  };
}

const SCENARIOS: Array<{ name: string; terms: ClientIoTerm[] }> = [
  { name: "Platform Default", terms: VENDOR_IO_DEFAULT_TERMS },
  {
    name: "Vendor Default",
    terms: [
      { title: "Vendor exclusivity.", body: "Vendor-specific exclusivity clause for parity." },
      { title: "Vendor payment.", body: "Payment follows vendor default net terms." },
    ],
  },
  {
    name: "IO Override",
    terms: [
      { title: "Deal override only.", body: "This override must appear in HTML and PDF identically." },
    ],
  },
];

async function assertHtmlPdfParity(name: string, terms: ClientIoTerm[]) {
  const html = renderVendorIoHtml(fixtureData(terms));
  const fromHtml = extractTermsFromVendorIoHtml(html);

  assert.ok(fromHtml.length > 0, `${name}: HTML must contain terms-list`);
  assert.ok(
    termsAreEqual(fromHtml, terms),
    `${name}: HTML extracted terms must match source (titles/order/bodies)`
  );

  // Numbering 1..N present in HTML fragment
  const listHtml = renderTermsListHtml(terms);
  for (let i = 0; i < terms.length; i++) {
    assert.ok(listHtml.includes(`class="tnum">${i + 1}</span>`), `${name}: missing number ${i + 1}`);
  }

  const pdfResult = await renderHtmlToPdf(html, INSERTION_ORDER_PDF_OPTIONS);
  assert.equal(pdfResult.ok, true, `${name}: PDF render failed (${pdfResult.ok ? "" : pdfResult.error})`);
  if (!pdfResult.ok) return;

  const pdfText = await extractPdfText(pdfResult.buffer);
  assert.ok(
    pdfContainsTermsInOrder(pdfText, terms),
    `${name}: PDF text missing terms in order (legal wording drift)`
  );

  console.log(`PASS  Document parity HTML=PDF — ${name} (${terms.length} clauses)`);
}

async function main() {
  // Snapshot identity for structured JSON used at create/override layers
  const serialized = serializeTermsText(VENDOR_IO_DEFAULT_TERMS);
  assert.ok(serialized.includes("title"));

  for (const scenario of SCENARIOS) {
    await assertHtmlPdfParity(scenario.name, scenario.terms);
  }

  console.log("vendor-io-document-parity.test.ts: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
