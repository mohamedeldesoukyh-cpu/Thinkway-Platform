#!/usr/bin/env node
/**
 * CI gate: fail when hard performance budgets are exceeded.
 * Usage: node scripts/check-performance-budgets.mjs
 * Requires: .next from a production build
 */
import fs from "node:fs";
import path from "node:path";
import {
  collectAllMetrics,
  loadJson,
} from "./lib/collect-performance-metrics.mjs";

const ROOT = process.cwd();
const budgets = loadJson("performance/budgets.json");
const baseline = loadJson("performance/baseline.json");

if (!budgets) {
  console.error("Missing performance/budgets.json");
  process.exit(1);
}

function pctGrowth(current, previous) {
  if (!previous || previous <= 0) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function evaluate(name, value, limits, results) {
  if (value == null || !limits) return;
  const soft = limits.soft;
  const hard = limits.hard;
  const row = { name, value, soft, hard, status: "pass" };
  if (hard != null && value > hard) {
    row.status = "fail";
    results.fails.push(row);
  } else if (soft != null && value > soft) {
    row.status = "warn";
    results.warns.push(row);
  } else {
    results.passes.push(row);
  }
}

const metrics = collectAllMetrics();
const results = { fails: [], warns: [], passes: [] };

const b = metrics.bundle;
const s = metrics.source;
evaluate("bundle.largestJsKb", b.largestJsKb, budgets.bundle.largestJsKb, results);
evaluate("bundle.largestCssKb", b.largestCssKb, budgets.bundle.largestCssKb, results);
evaluate("bundle.totalJsKb", b.totalJsKb, budgets.bundle.totalJsKb, results);
evaluate("bundle.totalCssKb", b.totalCssKb, budgets.bundle.totalCssKb, results);
evaluate("bundle.assetsOver100kb", b.assetsOver100kb, budgets.bundle.assetsOver100kb, results);
evaluate("bundle.jsFileCount", b.jsFileCount, budgets.bundle.jsFileCount, results);
evaluate("source.rootGlobalCssKb", s.rootGlobalCssKb, budgets.source.rootGlobalCssKb, results);
evaluate(
  "source.clientModuleCount",
  s.clientModuleCount,
  budgets.source.clientModuleCount,
  results,
);
evaluate(
  "source.largestClientSourceKb",
  s.largestClientSourceKb,
  budgets.source.largestClientSourceKb,
  results,
);

if (baseline?.bundle && budgets.regression) {
  evaluate(
    "regression.largestJsKbGrowthPct",
    pctGrowth(b.largestJsKb, baseline.bundle.largestJsKb),
    budgets.regression.largestJsKbGrowthPct,
    results,
  );
  evaluate(
    "regression.largestCssKbGrowthPct",
    pctGrowth(b.largestCssKb, baseline.bundle.largestCssKb),
    budgets.regression.largestCssKbGrowthPct,
    results,
  );
  evaluate(
    "regression.totalJsKbGrowthPct",
    pctGrowth(b.totalJsKb, baseline.bundle.totalJsKb),
    budgets.regression.totalJsKbGrowthPct,
    results,
  );
}

const report = {
  capturedAt: metrics.capturedAt,
  metrics,
  baseline: baseline
    ? {
        capturedAt: baseline.capturedAt,
        largestJsKb: baseline.bundle?.largestJsKb,
        largestCssKb: baseline.bundle?.largestCssKb,
        totalJsKb: baseline.bundle?.totalJsKb,
      }
    : null,
  results: {
    fails: results.fails,
    warns: results.warns,
    passes: results.passes,
  },
  score: scoreFromResults(results),
};

function scoreFromResults({ fails, warns, passes }) {
  const total = fails.length + warns.length + passes.length;
  if (total === 0) return 0;
  const points = passes.length * 100 + warns.length * 60 + fails.length * 0;
  return Math.round(points / total);
}

const outDir = path.join(ROOT, "performance", "reports");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "latest-check.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);

console.log("\n=== Thinkway performance budget check ===\n");
console.log(
  `Score: ${report.score}/100  |  pass=${results.passes.length} warn=${results.warns.length} fail=${results.fails.length}`,
);
console.log(
  `Largest JS: ${b.largestJsKb} KB | Largest CSS: ${b.largestCssKb} KB | Total JS: ${b.totalJsKb} KB`,
);
console.log(
  `Root globals CSS: ${s.rootGlobalCssKb} KB | Client modules: ${s.clientModuleCount}`,
);

for (const row of [...results.fails, ...results.warns]) {
  const tag = row.status === "fail" ? "FAIL" : "WARN";
  console.log(
    `  [${tag}] ${row.name}: ${row.value} (soft ${row.soft}, hard ${row.hard})`,
  );
}

if (results.fails.length === 0 && results.warns.length === 0) {
  console.log("\nAll budgets within soft limits.\n");
} else if (results.fails.length === 0) {
  console.log("\nSoft budget warnings only — build continues.\n");
}

if (results.fails.length > 0) {
  console.error(
    `\nHard budget exceeded (${results.fails.length}). See docs/PERFORMANCE_GOVERNANCE.md\n`,
  );
  process.exit(1);
}

process.exit(0);
