import assert from "node:assert/strict";

import {
  applyClientIoDocumentLayout,
  buildClientIoPricingRows,
} from "@/lib/io/client-io-document-layout";
import type { ClientIoDocumentData } from "@/lib/io/client-io-document-types";

const sample: ClientIoDocumentData = {
  clientIoId: "cio-1",
  documentNumber: "CIO-2026-0001",
  issuedAt: "2026-06-01T00:00:00.000Z",
  issuedCountry: "Egypt",
  currencyCode: "EGP",
  status: "generated",
  paymentSchedule: "Advance — Prior to campaign launch",
  client: {
    id: "c1",
    name: "Client",
    legalName: "Client LLC",
    tradeLicense: "CR-123",
    address: "Cairo",
    contactPerson: "Jane Doe",
    email: "billing@client.com",
  },
  campaign: {
    id: "camp-1",
    documentNumber: "TW-2026-0001",
    name: "Summer Influencer Campaign",
    startDate: "2026-05-01",
    endDate: "2026-06-30",
    brandName: "Brand X",
    channels: "Instagram, TikTok",
    targetMarket: "Egypt",
    businessObjective: "Awareness",
    usagePeriod: "90 days",
  },
  deliverables: [],
  pricing: {
    currencyCode: "EGP",
    vatPercent: 14,
    vatExempt: false,
    assignmentLines: [
      {
        lineId: "l1",
        lineDocumentNumber: "TW-2026-0001-A",
        lineName: "Creator A — Instagram Package",
        influencerName: "Creator A",
        revenueBeforeVat: 100_000,
        usageRightsAmount: 10_000,
        agencyFeeAmount: 5_500,
      },
      {
        lineId: "l2",
        lineDocumentNumber: "TW-2026-0001-B",
        lineName: "Creator B — TikTok Package",
        influencerName: "Creator B",
        revenueBeforeVat: 80_000,
        usageRightsAmount: 8_000,
        agencyFeeAmount: 4_400,
      },
    ],
    revenueTotal: 180_000,
    usageRightsTotal: 18_000,
    agencyFeeTotal: 9_900,
    subtotal: 207_900,
    vatAmount: 29_106,
    total: 237_006,
  },
};

const detailedRows = buildClientIoPricingRows(sample.pricing, "detailed");
assert.equal(detailedRows.filter((row) => row.variant === "header").length, 2);
assert.equal(detailedRows.filter((row) => row.label === "Influencer Fees").length, 2);
assert.equal(detailedRows.at(-1)?.variant, "total");
assert.equal(detailedRows.at(-1)?.amount, 237_006);

const packageRows = buildClientIoPricingRows(sample.pricing, "package");
assert.equal(packageRows.length, 6);
assert.equal(packageRows[0]?.label, "Influencer Fees (Total)");
assert.equal(packageRows[0]?.amount, 180_000);
assert.equal(packageRows.at(-1)?.amount, 237_006);

const detailed = applyClientIoDocumentLayout(sample, "detailed");
assert.equal(detailed.pricingRows.length, detailedRows.length);

const packaged = applyClientIoDocumentLayout(sample, "package");
assert.equal(packaged.pricingRows.length, 6);

console.log("client-io-document-layout.test.ts: ok");
