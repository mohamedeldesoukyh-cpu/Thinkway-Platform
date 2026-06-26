import assert from "node:assert/strict";

import {
  buildErAuditMessage,
  erAuditChanged,
  erValuesEqual,
  shouldWriteErAuditLog,
} from "@/lib/performance/engagement-rate-audit";

assert.equal(erValuesEqual(2.5, 2.50001), true);
assert.equal(erValuesEqual(null, 2.5), false);

assert.equal(
  erAuditChanged(
    { engagement_rate: 0.02, engagement_rate_method: "followers" },
    { engagement_rate: 0.2, engagement_rate_method: "views" }
  ),
  true
);

assert.equal(
  buildErAuditMessage({
    triggeredBy: "manual_refresh",
    previous: { engagement_rate: 0.02, engagement_rate_method: "followers" },
    next: { engagement_rate: 0.2, engagement_rate_method: "views" },
  }),
  "ER recalculated using Views after automatic sync."
);

assert.equal(
  buildErAuditMessage({
    triggeredBy: "manual_refresh",
    previous: { engagement_rate: null, engagement_rate_method: null },
    next: { engagement_rate: 0.02, engagement_rate_method: "followers" },
  }),
  "ER recalculated using Followers because views are unavailable."
);

assert.equal(
  buildErAuditMessage({
    triggeredBy: "manual",
    previous: { engagement_rate: 1.2, engagement_rate_method: "views" },
    next: { engagement_rate: 1.5, engagement_rate_method: "views" },
  }),
  "Manual metrics override applied."
);

assert.equal(
  buildErAuditMessage({
    triggeredBy: "manual_restore_automatic",
    previous: { engagement_rate: 1.5, engagement_rate_method: "manual" },
    next: { engagement_rate: 0.2, engagement_rate_method: "views" },
  }),
  "Automatic metrics restored. ER recalculated using Views after automatic sync."
);

assert.equal(
  shouldWriteErAuditLog({
    triggeredBy: "manual_refresh",
    previous: { engagement_rate: 0.02, engagement_rate_method: "followers" },
    next: { engagement_rate: 0.02, engagement_rate_method: "followers" },
    metricsChanged: false,
  }),
  false
);

assert.equal(
  shouldWriteErAuditLog({
    triggeredBy: "manual_refresh",
    previous: { engagement_rate: 0.02, engagement_rate_method: "followers" },
    next: { engagement_rate: 0.2, engagement_rate_method: "views" },
    metricsChanged: true,
  }),
  true
);

console.log("engagement-rate-audit tests passed");
