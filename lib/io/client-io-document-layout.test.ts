import assert from "node:assert/strict";

import {
  applyClientIoDocumentLayout,
  buildClientIoPricingRows,
  resolveClientIoDeliverableRows,
} from "@/lib/io/client-io-document-layout";
import type { ClientIoDocumentData } from "@/lib/io/client-io-document-types";
import { CLIENT_IO_DEFAULT_TERMS } from "@/lib/io/client-io-default-terms";

const sample: ClientIoDocumentData = {
  clientIoId: "cio-1",
  documentNumber: "CIO-2026-0001",
  issuedAt: "2026-06-01T00:00:00.000Z",
  issuedCountry: "Egypt",
  currencyCode: "EGP",
  status: "generated",
  paymentSchedule: "Advance — Prior to campaign launch",
  billingMilestones: [],
  agencyContact: {
    fullName: "Alex Operator",
    title: "Account Manager",
    email: "alex@thinkwaymedia.com",
  },
  terms: CLIENT_IO_DEFAULT_TERMS,
  client: {
    id: "c1",
    name: "Client",
    legalName: "Client LLC",
    tradeLicense: "CR-123",
    address: "Cairo",
    contactPerson: "Jane Doe",
    email: "billing@client.com",
    agencyOrDirect: "agency",
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
  },
  influencerNotes: [
    {
      influencerName: "Creator A",
      fullDescription: "1x Reel + 2x Story",
      usagePeriod: "90 days",
    },
  ],
  deliverables: [
    {
      influencerName: "Creator A",
      platform: "Instagram",
      deliverableType: "Reel",
      quantity: 1,
      handle: "@creatorA",
      scheduledDates: "1 May 2026",
    },
    {
      influencerName: "Creator A",
      platform: "Instagram",
      deliverableType: "Story",
      quantity: 2,
      handle: "@creatorA",
      scheduledDates: "2 May 2026",
    },
  ],
  mainAssignmentDeliverables: [
    {
      influencerName: "Creator A",
      platform: "Instagram",
      deliverableType: "TW-2026-0001-A Package",
      quantity: 1,
      handle: "@creatorA",
      scheduledDates: "1 May 2026 – 2 May 2026",
    },
    {
      influencerName: "Creator B",
      platform: "TikTok",
      deliverableType: "TW-2026-0001-B Package",
      quantity: 1,
      handle: "@creatorB",
      scheduledDates: "—",
    },
  ],
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

const packageMainRows = buildClientIoPricingRows(sample.pricing, "package_main");
assert.equal(packageMainRows[0]?.label, "Influencer Fees (Total)");
assert.equal(packageMainRows.at(-1)?.amount, 237_006);

const packageMainDeliverables = resolveClientIoDeliverableRows(sample, "package_main");
assert.equal(packageMainDeliverables.length, 2);
assert.equal(packageMainDeliverables[0]?.quantity, 1);
assert.equal(resolveClientIoDeliverableRows(sample, "detailed").length, 2);

console.log("client-io-document-layout.test.ts: ok");
