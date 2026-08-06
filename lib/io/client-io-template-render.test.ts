import assert from "node:assert/strict";
import { test } from "node:test";

import { CLIENT_IO_DEFAULT_TERMS } from "@/lib/io/client-io-default-terms";
import type { ClientIoDocumentData } from "@/lib/io/client-io-document-types";
import { renderClientIoHtml } from "@/lib/io/client-io-template-render";

const sample: ClientIoDocumentData = {
  clientIoId: "cio-1",
  documentNumber: "CIO-2026-0002",
  issuedAt: "2026-08-01T00:00:00.000Z",
  issuedCountry: "Egypt",
  currencyCode: "EGP",
  status: "generated",
  paymentSchedule: "Net 60 Days",
  billingMilestones: [],
  agencyContact: {
    fullName: "Alex Operator",
    title: "Account Manager",
    email: "alex@thinkwaymedia.com",
  },
  terms: CLIENT_IO_DEFAULT_TERMS,
  client: {
    id: "c1",
    name: "Mind Share Egypt LTD",
    legalName: "Mind Share Egypt LTD",
    tradeLicense: null,
    address: "Cairo",
    contactPerson: null,
    email: "billing@client.com",
    agencyOrDirect: "agency",
  },
  campaign: {
    id: "camp-1",
    documentNumber: "TW-2026-0002",
    name: "Limitless UAE July - August 2026",
    startDate: "2026-08-06",
    endDate: "2026-08-31",
    brandName: "Limitless",
    channels: "Instagram",
    targetMarket: "United Arab Emirates",
  },
  deliverables: [
    {
      influencerName: "@omar_dem",
      platform: "instagram",
      deliverableType: "ig_reel",
      quantity: 1,
      handle: "@omar_dem",
      scheduledDates: "08/26",
    },
  ],
  mainAssignmentDeliverables: [],
  influencerNotes: [
    {
      influencerName: "@omar_dem",
      fullDescription: "1x Reel — UAE market",
      usagePeriod: "30 days paid usage",
    },
  ],
  pricing: {
    currencyCode: "EGP",
    vatPercent: 14,
    vatExempt: false,
    assignmentLines: [],
    revenueTotal: 0,
    usageRightsTotal: 0,
    agencyFeeTotal: 0,
    subtotal: 0,
    vatAmount: 0,
    total: 0,
  },
};

test("renderClientIoHtml uses Agency / Advertiser and influencer notes", () => {
  const html = renderClientIoHtml(sample, "detailed");
  assert.match(html, /Agency \/ Advertiser/);
  assert.doesNotMatch(html, /Business Objective/);
  assert.match(html, /Limitless UAE July - August 2026/);
  assert.match(html, /1x Reel — UAE market/);
  assert.match(html, /30 days paid usage/);
  assert.match(html, /08\/26/);
});

test("renderClientIoHtml uses Client / Advertiser for direct clients", () => {
  const html = renderClientIoHtml(
    {
      ...sample,
      client: { ...sample.client, agencyOrDirect: "direct" },
    },
    "detailed"
  );
  assert.match(html, /Client \/ Advertiser/);
});
