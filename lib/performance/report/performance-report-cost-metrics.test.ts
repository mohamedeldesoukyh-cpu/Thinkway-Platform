import assert from "node:assert/strict";

import {
  buildOptionalCostMetricKpiRows,
  isDisplayableCostMetric,
  resolveDisplayableCostMetricColumns,
} from "@/lib/performance/report/performance-report-cost-metrics";

assert.equal(isDisplayableCostMetric(null), false);
assert.equal(isDisplayableCostMetric(undefined), false);
assert.equal(isDisplayableCostMetric(0), false);
assert.equal(isDisplayableCostMetric(12.5), true);

assert.deepEqual(
  resolveDisplayableCostMetricColumns([
    { cpv: null, cpe: 0, cpm: 4.2 },
    { cpv: 0.03, cpe: null, cpm: null },
  ]),
  ["cpv", "cpm"]
);

assert.deepEqual(
  buildOptionalCostMetricKpiRows([
    { label: "CPM", value: null, formatted: "—" },
    { label: "CPV", value: 0.12, formatted: "$0.12" },
    { label: "CPE", value: 0, formatted: "$0.00" },
  ]),
  [["CPV", "$0.12"]]
);

console.log("performance-report-cost-metrics.test.ts: all assertions passed");
