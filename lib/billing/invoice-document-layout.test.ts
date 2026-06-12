import assert from "node:assert/strict";

import { applyInvoiceDocumentLayout } from "@/lib/billing/invoice-document-layout";
import type { InvoiceDocumentData } from "@/lib/billing/invoice-document-types";

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
      description: "TW-2026-0001-A — Creator A",
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
      id: "l2",
      description: "TW-2026-0001-B — Creator B",
      subDescription: "TikTok video",
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
assert.equal(detailed.lineItems.length, 2);

const packaged = applyInvoiceDocumentLayout(sample, "package");
assert.equal(packaged.lineItems.length, 2);
assert.equal(packaged.lineItems[0]!.description, "Summer Influencer Campaign");
assert.equal(packaged.lineItems[1]!.description, "Agency fees");
assert.equal(packaged.lineItems[0]!.revenueBeforeVat, 490_000);
assert.equal(packaged.lineItems[1]!.revenueBeforeVat, 25_000);

console.log("invoice-document-layout.test.ts: ok");
