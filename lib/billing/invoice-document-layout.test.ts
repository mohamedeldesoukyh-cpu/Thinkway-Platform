import assert from "node:assert/strict";

import { applyInvoiceDocumentLayout } from "@/lib/billing/invoice-document-layout";
import type { InvoiceDocumentData } from "@/lib/billing/invoice-document-types";
import { buildInvoiceTemplateHtml, resolveInvoiceDocumentVat } from "@/lib/billing/invoice-template-html";

const sample: InvoiceDocumentData = {
  invoiceId: "inv-1",
  documentNumber: "INV-001",
  issueDate: "2026-06-01",
  dueDate: "2026-07-01",
  currencyCode: "EGP",
  status: "draft",
  subtotal: 515_000,
  taxAmount: 72_100,
  total: 587_100,
  vatPercent: 14,
  notes: null,
  usdEquivalent: null,
  client: {
    id: "c1",
    name: "Client",
    legalName: "Client LLC",
    documentNumber: "CL-1",
    billingName: "Client LLC",
    addressLine1: null,
    addressLine2: null,
    cityCountry: null,
    vatNumber: null,
    taxId: null,
    paymentTerms: null,
  },
  campaign: {
    id: "camp-1",
    documentNumber: "TW-2026-0001",
    name: "Summer Influencer Campaign",
    startDate: "2026-05-01",
    endDate: "2026-06-30",
    brandName: "Brand X",
    poNumber: "PO-12345",
    clientIoReferences: ["CIO-2026-0001"],
    clientIoReferenceDisplay: "CIO-2026-0001",
    poReferenceDisplay: "PO-12345",
    internalReference: "TW-2026-0001",
  },
  commercialBreakdown: {
    revenueAmount: 490_000,
    agencyFeeAmount: 25_000,
  },
  lineItems: [
    {
      id: "l1",
      description: "TW-2026-0001-A — Creator A · Instagram Reel #1",
      subDescription: "Instagram reel",
      quantity: 1,
      unitPrice: 12_500,
      lineTotal: 14_250,
      revenueBeforeVat: 12_500,
      revenueVatPercent: 14,
      revenueVatAmount: 1_750,
      revenueVatExempt: false,
      lineDocumentNumber: "TW-2026-0001-A",
    },
    {
      id: "l1b",
      description: "TW-2026-0001-A — Creator A · TikTok Video #1",
      subDescription: "TikTok video",
      quantity: 1,
      unitPrice: 12_500,
      lineTotal: 14_250,
      revenueBeforeVat: 12_500,
      revenueVatPercent: 14,
      revenueVatAmount: 1_750,
      revenueVatExempt: false,
      lineDocumentNumber: "TW-2026-0001-A",
    },
    {
      id: "l2",
      description: "TW-2026-0001-B — Creator B · Instagram Reel #1",
      subDescription: "Instagram reel",
      quantity: 1,
      unitPrice: 12_500,
      lineTotal: 14_250,
      revenueBeforeVat: 12_500,
      revenueVatPercent: 14,
      revenueVatAmount: 1_750,
      revenueVatExempt: false,
      lineDocumentNumber: "TW-2026-0001-B",
    },
  ],
};

const detailed = applyInvoiceDocumentLayout(sample, "detailed");
const installmentSample = { ...sample, lineItems: sample.lineItems.map(line => ({ ...line,
  installmentLabel: line.lineDocumentNumber?.endsWith("-A") ? "2nd installment — 50%" : "1st installment — 50%",
})) };
for (const layout of ["detailed", "by_creator", "package"] as const) {
  const rendered = buildInvoiceTemplateHtml(applyInvoiceDocumentLayout(installmentSample, layout));
  assert.ok(rendered.includes("2nd installment — 50%"), `${layout} retains the second installment`);
  assert.ok(rendered.includes("1st installment — 50%"), `${layout} retains separate assignment numbering`);
}
assert.equal(detailed.lineItems.length, 3);

const byCreator = applyInvoiceDocumentLayout(sample, "by_creator");
assert.equal(byCreator.lineItems.length, 2);
assert.equal(byCreator.lineItems[0]!.description, "Creator A — 1 × Instagram reel + 1 × TikTok video · 100% of original billable amount");
assert.equal(byCreator.lineItems[0]!.revenueBeforeVat, 25_000);
assert.equal(byCreator.lineItems[0]!.lineTotal, 28_500);
assert.equal(byCreator.lineItems[1]!.description, "Creator B — 1 × Instagram reel · 100% of original billable amount");

const packaged = applyInvoiceDocumentLayout(sample, "package");
assert.equal(packaged.lineItems.length, 2);
assert.equal(packaged.lineItems[0]!.description, "Summer Influencer Campaign");
assert.equal(packaged.lineItems[1]!.description, "Agency fees");
assert.equal(packaged.lineItems[0]!.revenueBeforeVat, 490_000);
assert.equal(packaged.lineItems[1]!.revenueBeforeVat, 25_000);

const vat = resolveInvoiceDocumentVat(sample);
assert.equal(vat.taxAmount, 72_100);
assert.equal(vat.vatLabel, "VAT (14%)");

const html = buildInvoiceTemplateHtml(sample);
assert.ok(html.includes("Campaign No."));
assert.ok(html.includes("TW-2026-0001"));
assert.ok(html.includes("Subtotal (excl. VAT)"));
assert.ok(html.includes("VAT (14%)"));
assert.ok(html.includes("EGP 72,100.00") || html.includes("72,100"));
assert.ok(html.includes("Total Amount Due"));

const missingHeaderTax = buildInvoiceTemplateHtml({
  ...sample,
  taxAmount: 0,
  subtotal: 0,
  total: 0,
});
assert.ok(missingHeaderTax.includes("VAT (14%)"));
assert.ok(missingHeaderTax.includes("5,250") || missingHeaderTax.includes("5250"));

console.log("invoice-document-layout.test.ts: ok");

// Percentages remain visible in every client-facing document layout.
const partialSample = { ...sample, notes: "Existing payment terms", lineItems: sample.lineItems.map(line => ({ ...line, description: line.description + " - 50% of original billable amount" })) };
for (const layout of ["detailed", "by_creator", "package"] as const) {
  const document = applyInvoiceDocumentLayout(partialSample, layout);
  const html = buildInvoiceTemplateHtml(document);
  assert.match(html, /50% of original billable amount/);
  assert.match(html, /Existing payment terms/);
  assert.equal(document.total, sample.total);
}
for (const percent of [50,60,33.33]) {
 const partial = {...sample,lineItems:sample.lineItems.map(line=>({...line,description:line.description+' · '+percent+'% of original billable amount'}))};
 for(const layout of ['by_creator','package'] as const){
  const doc=applyInvoiceDocumentLayout(partial,layout);
  assert.ok(doc.lineItems.every(line=>line.description.includes(percent+'% of original billable amount')));
  assert.equal(doc.total,sample.total);
 }
}
const mixed={...sample,lineItems:sample.lineItems.map((line,index)=>({...line,description:line.description+' · '+(index===0?50:60)+'% of original billable amount'}))};
assert.match(applyInvoiceDocumentLayout(mixed,'package').lineItems[0].description,/Mixed billing: 50%, 60%/);

// Compact descriptions use saved creator names, summarize posts, and never copy rows into Notes.
const named = {...partialSample, lineItems:partialSample.lineItems.map(line=>({...line,creatorName:"Actual Creator Name"}))};
const namedDoc = applyInvoiceDocumentLayout(named,"by_creator");
assert.match(namedDoc.lineItems[0].description,/^Actual Creator Name — 1 × Instagram reel/);
assert.equal(namedDoc.notes,"Existing payment terms");
assert.equal(applyInvoiceDocumentLayout({...named,notes:null},"by_creator").notes,null);
assert.equal(applyInvoiceDocumentLayout({...named,notes:null},"package").notes,null);
assert.equal(namedDoc.lineItems.reduce((sum,line)=>sum+line.lineTotal,0),named.lineItems.reduce((sum,line)=>sum+line.lineTotal,0));
assert.match(applyInvoiceDocumentLayout(mixed,"by_creator").lineItems[0].description,/Instagram reel \(50% billed\).*TikTok video \(60% billed\)/);

// The invoice must show the agreed IO schedule without a conflicting fixed Net 30 clause.
for (const layout of ["detailed", "by_creator", "summary"] as const) {
  const terms = "50% advance upon confirmation, remaining 50% within 45 days from campaign completion";
  const document = { ...sample, client: { ...sample.client, paymentTerms: terms } };
  const html = buildInvoiceTemplateHtml(applyInvoiceDocumentLayout(document, layout));
  assert.ok(html.includes(terms));
  assert.ok(!html.includes("within 30 days"));
  assert.ok(!html.includes("Net 30 Days"));
}
