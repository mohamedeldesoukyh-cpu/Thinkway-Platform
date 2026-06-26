import assert from "node:assert/strict";

import {
  KPI_ACCENT_CLASS,
  KPI_ACCENT_CYCLE,
  KPI_HEALTH_SURFACE_CLASS,
  KPI_HEALTH_VALUE_CLASS,
  KPI_LEGACY_ALERT_HEALTH,
  KPI_VARIANT_ACCENT_CLASS,
  KPI_VARIANT_HEALTH,
} from "./kpi-config";
import {
  formatKpiCurrency,
  formatKpiPercent,
  formatKpiTrendPercent,
  resolveAgingBucketHealth,
  resolveKpiAccentByIndex,
  resolveKpiAccentClass,
  resolveKpiHealthFromLegacyAlert,
  resolveKpiValueClassName,
  resolveKpiVariantAccent,
  resolveKpiVariantHealth,
} from "./kpi-utils";

// Accent map uses semantic tokens only
for (const cls of Object.values(KPI_ACCENT_CLASS)) {
  assert.doesNotMatch(cls, /emerald-|red-|amber-|blue-[0-9]|#[0-9A-Fa-f]/);
}

assert.equal(KPI_ACCENT_CYCLE.length, 4);
assert.equal(resolveKpiAccentByIndex(0), KPI_ACCENT_CLASS.blue);
assert.equal(resolveKpiAccentByIndex(4), KPI_ACCENT_CLASS.blue);

assert.equal(resolveKpiAccentClass("green"), "bg-success/10 text-success");
assert.equal(resolveKpiAccentClass(undefined, "custom-class"), "custom-class");

// Legacy alert → health
assert.equal(resolveKpiHealthFromLegacyAlert("warning"), "warning");
assert.equal(resolveKpiHealthFromLegacyAlert("danger"), "destructive");
assert.equal(KPI_LEGACY_ALERT_HEALTH.danger, "destructive");

// Variant mapping
assert.equal(resolveKpiVariantHealth("negative"), "destructive");
assert.match(resolveKpiVariantAccent("positive"), /success/);
assert.match(KPI_VARIANT_ACCENT_CLASS.negative, /destructive/);
assert.equal(KPI_VARIANT_HEALTH.warning, "warning");

// Value class resolution preserves operational semantics
const revenueClass = resolveKpiValueClassName({ valueSemantic: "revenue" });
assert.match(revenueClass ?? "", /primary/);

const gpNegative = resolveKpiValueClassName({ valueSemantic: "gp", valueNumeric: -1 });
assert.match(gpNegative ?? "", /destructive/);

const explicitHealth = resolveKpiValueClassName({ health: "warning" });
assert.equal(explicitHealth, KPI_HEALTH_VALUE_CLASS.warning);

// Aging severity
assert.equal(resolveAgingBucketHealth("danger"), "destructive");
assert.equal(resolveAgingBucketHealth("warn"), "warning");
assert.equal(resolveAgingBucketHealth("ok"), "neutral");

// Formatting helpers
assert.match(formatKpiCurrency(1000, "USD"), /\$/);
assert.equal(formatKpiCurrency(500, null, { mixed: true }), "500");
assert.equal(formatKpiPercent(12.345), "12.3%");
assert.equal(formatKpiTrendPercent(5.2), "+5.2%");
assert.equal(formatKpiTrendPercent(-3.1), "−3.1%");

// Health surface classes use semantic tokens
for (const cls of Object.values(KPI_HEALTH_SURFACE_CLASS)) {
  assert.doesNotMatch(cls, /red-|amber-|emerald-/);
}

console.log("kpi-config.test.ts: all assertions passed");
