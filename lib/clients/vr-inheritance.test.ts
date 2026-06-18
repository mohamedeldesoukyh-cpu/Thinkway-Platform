import assert from "node:assert/strict";

import {
  getEffectiveBrandVrPercent,
  normalizeBrandVrRateId,
} from "@/lib/clients/vr-inheritance";
import { resolveCampaignVrRatePercent } from "@/lib/analytics/pnl/vr-refund";
import { buildVrReport } from "@/lib/analytics/vr-report/build-vr-report";
import type { PnlLineFact } from "@/lib/analytics/pnl/pnl-report-types";

assert.equal(
  getEffectiveBrandVrPercent(
    { vr_rate_id: "brand-rate", vr_rate_percent: 10 },
    { vr_rate_id: "client-rate", vr_rate_percent: 5 }
  ),
  10,
  "brand override wins"
);

assert.equal(
  getEffectiveBrandVrPercent(
    { vr_rate_id: null, vr_rate_percent: null },
    { vr_rate_id: "client-rate", vr_rate_percent: 5 }
  ),
  5,
  "inherits client default when brand unset"
);

assert.equal(
  normalizeBrandVrRateId("same-id", "same-id"),
  null,
  "matching client default stores null for inheritance"
);

assert.equal(
  resolveCampaignVrRatePercent({
    brandVrRateId: null,
    brandVrRate: null,
    clientVrRate: { rate_percent: 7.5 },
    headerVrRate: { rate_percent: 3 },
  }),
  7.5,
  "client VR% before header snapshot"
);

const facts: PnlLineFact[] = [
  {
    client_id: "c1",
    client_name: "Mindshare Egypt LTD",
    group_id: "g1",
    group_name: "Group",
    period_month: "2026-01",
    revenue: 500_000,
    ur_rev: 0,
    agency_fees: 0,
    cost: 0,
    gp: 0,
    vr_refund: 50_000,
    gp_after_vr: 0,
    vr_rate_percent: 10,
    currency_code: "USD",
  },
  {
    client_id: "c1",
    client_name: "Mindshare Egypt LTD",
    group_id: "g1",
    group_name: "Group",
    period_month: "2026-01",
    revenue: 500_000,
    ur_rev: 0,
    agency_fees: 0,
    cost: 0,
    gp: 0,
    vr_refund: 25_000,
    gp_after_vr: 0,
    vr_rate_percent: 5,
    currency_code: "USD",
  },
];

const report = buildVrReport(facts, 2026, "fy", "USD", ["USD"]);
assert.equal(report.rows[0]?.revenue, 1_000_000);
assert.equal(report.rows[0]?.total_vr, 75_000);
assert.equal(report.rows[0]?.vr_rate_percent, 7.5, "weighted client VR%");

console.log("vr-inheritance.test.ts: all assertions passed");
