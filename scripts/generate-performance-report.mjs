#!/usr/bin/env node
/**
 * Generate bundle + source performance report for CI artifacts / dashboard.
 * Usage:
 *   node scripts/generate-performance-report.mjs
 *   node scripts/generate-performance-report.mjs --write-baseline
 */
import fs from "node:fs";
import path from "node:path";
import {
  collectAllMetrics,
  loadJson,
} from "./lib/collect-performance-metrics.mjs";

const ROOT = process.cwd();
const writeBaseline = process.argv.includes("--write-baseline");

const metrics = collectAllMetrics();
const budgets = loadJson("performance/budgets.json");
const previous = loadJson("performance/reports/latest.json");
const baseline = loadJson("performance/baseline.json");

function delta(current, prior) {
  if (prior == null) return null;
  return Math.round((current - prior) * 10) / 10;
}

function pct(current, prior) {
  if (prior == null || prior <= 0) return null;
  return Math.round(((current - prior) / prior) * 1000) / 10;
}

const priorBundle = previous?.bundle ?? baseline?.bundle ?? null;

const report = {
  version: 1,
  capturedAt: metrics.capturedAt,
  gitSha: process.env.GITHUB_SHA ?? null,
  gitRef: process.env.GITHUB_REF_NAME ?? process.env.GITHUB_REF ?? null,
  bundle: {
    largestJsKb: metrics.bundle.largestJsKb,
    largestCssKb: metrics.bundle.largestCssKb,
    totalJsKb: metrics.bundle.totalJsKb,
    totalCssKb: metrics.bundle.totalCssKb,
    assetsOver100kb: metrics.bundle.assetsOver100kb,
    jsFileCount: metrics.bundle.jsFileCount,
    cssFileCount: metrics.bundle.cssFileCount,
    largestJs: metrics.bundle.largestJs,
    largestCss: metrics.bundle.largestCss,
  },
  source: metrics.source,
  comparison: priorBundle
    ? {
        against: previous ? "previous-report" : "baseline",
        largestJsKbDelta: delta(metrics.bundle.largestJsKb, priorBundle.largestJsKb),
        largestCssKbDelta: delta(
          metrics.bundle.largestCssKb,
          priorBundle.largestCssKb,
        ),
        totalJsKbDelta: delta(metrics.bundle.totalJsKb, priorBundle.totalJsKb),
        largestJsKbPct: pct(metrics.bundle.largestJsKb, priorBundle.largestJsKb),
        largestCssKbPct: pct(metrics.bundle.largestCssKb, priorBundle.largestCssKb),
        totalJsKbPct: pct(metrics.bundle.totalJsKb, priorBundle.totalJsKb),
      }
    : null,
  routes: {
    tracked: budgets?.routes?.tracked ?? [],
    note: budgets?.routes?.notes ?? null,
  },
  budgetsVersion: budgets?.version ?? null,
};

const outDir = path.join(ROOT, "performance", "reports");
fs.mkdirSync(outDir, { recursive: true });

const stamp = metrics.capturedAt.replace(/[:.]/g, "-");
const stamped = path.join(outDir, `report-${stamp}.json`);
const latest = path.join(outDir, "latest.json");
const markdown = path.join(outDir, "latest.md");

fs.writeFileSync(stamped, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(latest, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  `# Thinkway performance report`,
  ``,
  `Captured: ${report.capturedAt}`,
  ``,
  `## Bundle`,
  ``,
  `| Metric | Value | Δ vs ${report.comparison?.against ?? "n/a"} |`,
  `|---|---:|---:|`,
  `| Largest JS (KB) | ${report.bundle.largestJsKb} | ${fmtDelta(report.comparison?.largestJsKbDelta, report.comparison?.largestJsKbPct)} |`,
  `| Largest CSS (KB) | ${report.bundle.largestCssKb} | ${fmtDelta(report.comparison?.largestCssKbDelta, report.comparison?.largestCssKbPct)} |`,
  `| Total JS (KB) | ${report.bundle.totalJsKb} | ${fmtDelta(report.comparison?.totalJsKbDelta, report.comparison?.totalJsKbPct)} |`,
  `| Total CSS (KB) | ${report.bundle.totalCssKb} | — |`,
  `| Assets ≥100KB | ${report.bundle.assetsOver100kb} | — |`,
  ``,
  `## Source`,
  ``,
  `- Root globals CSS chain: **${report.source.rootGlobalCssKb} KB**`,
  `- Client modules: **${report.source.clientModuleCount}**`,
  `- Largest client source: **${report.source.largestClientSourceKb} KB** (\`${report.source.largestClientSourceFile ?? "n/a"}\`)`,
  ``,
  `## Top JS`,
  ``,
  ...report.bundle.largestJs.slice(0, 5).map((f) => `- ${f.kb} KB — \`${f.file}\``),
  ``,
  `## Top CSS`,
  ``,
  ...report.bundle.largestCss.slice(0, 5).map((f) => `- ${f.kb} KB — \`${f.file}\``),
  ``,
  `See \`docs/PERFORMANCE_GOVERNANCE.md\`.`,
  ``,
].join("\n");

fs.writeFileSync(markdown, md);

if (writeBaseline) {
  const nextBaseline = {
    capturedAt: metrics.capturedAt,
    gitRef: report.gitRef,
    gitSha: report.gitSha,
    bundle: {
      largestJsKb: report.bundle.largestJsKb,
      largestCssKb: report.bundle.largestCssKb,
      totalJsKb: report.bundle.totalJsKb,
      totalCssKb: report.bundle.totalCssKb,
      assetsOver100kb: report.bundle.assetsOver100kb,
      jsFileCount: report.bundle.jsFileCount,
      cssFileCount: report.bundle.cssFileCount,
    },
    source: {
      rootGlobalCssKb: report.source.rootGlobalCssKb,
      clientModuleCount: report.source.clientModuleCount,
      largestClientSourceKb: report.source.largestClientSourceKb,
      largestClientSourceFile: report.source.largestClientSourceFile,
    },
    notes: [
      "Updated via npm run report:performance -- --write-baseline",
    ],
  };
  fs.writeFileSync(
    path.join(ROOT, "performance", "baseline.json"),
    `${JSON.stringify(nextBaseline, null, 2)}\n`,
  );
  console.log("Updated performance/baseline.json");
}

function fmtDelta(d, p) {
  if (d == null) return "—";
  const sign = d > 0 ? "+" : "";
  return `${sign}${d} KB${p != null ? ` (${sign}${p}%)` : ""}`;
}

console.log(md);
console.log(`Wrote ${path.relative(ROOT, latest)}`);
