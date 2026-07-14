/**
 * Taxonomy coverage iteration — runs the full expansion loop to convergence:
 *
 *   npm run taxonomy:iterate    [--gate=80] [--max-iterations=5] [--dry-run]
 *
 * Each cycle (child processes via the common ops launcher, so the freshly
 * expanded keyword map is re-imported cleanly every time):
 *   1. taxonomy analyzer --apply --json  (validated proposals only)
 *   2. creator-intelligence test suite   (taxonomy must stay sane)
 *   3. projection backfill               (persist recovered categories)
 *
 * Stops when: coverage ≥ gate, OR no proposals were applied (no further
 * high-confidence mappings exist), OR max iterations. INVARIANT: coverage must
 * never decrease between cycles — the loop aborts loudly if it does. Ends with
 * rollout preflight for the official verdict and prints the consolidated
 * report: per-iteration additions, creators recovered, final coverage, and the
 * remaining-unresolved breakdown.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const gate = Number(process.argv.find((a) => a.startsWith("--gate="))?.split("=")[1] ?? 80);
const maxIterations = Number(
  process.argv.find((a) => a.startsWith("--max-iterations="))?.split("=")[1] ?? 5
);
const dryRun = process.argv.includes("--dry-run");

type IterationSummary = {
  total: number;
  resolved: number;
  unresolved: number;
  coverageBefore: number;
  projectedRecovered: number;
  projectedAfter: number;
  proposals: Array<{ term: string; category: string; recovery: number }>;
  applied: number;
  newCategoryCandidates: Array<{ label: string; terms: string[]; recovery: number }>;
};

function run(command: string, args: string[]): number {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  return result.status ?? 1;
}

function runOps(script: string, args: string[]): number {
  return run("node", ["scripts/run-ops-script.mjs", script, ...args]);
}

async function main() {
  const reportPath = path.join(tmpdir(), `taxonomy-report-${Date.now()}.json`);
  const appliedByIteration: Array<{
    iteration: number;
    coverageBefore: number;
    applied: number;
    terms: Array<{ term: string; category: string; recovery: number }>;
  }> = [];
  let previousCoverage = -1;
  let last: IterationSummary | null = null;

  console.log(`\nTAXONOMY COVERAGE ITERATION — gate ${gate}%, max ${maxIterations} cycles${dryRun ? " (dry-run)" : ""}\n`);

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    console.log(`════════ CYCLE ${iteration} ════════`);
    const analyzerArgs = [`--json=${reportPath}`, ...(dryRun ? [] : ["--apply"])];
    if (runOps("scripts/analyze-taxonomy-expansion.ts", analyzerArgs) !== 0) {
      console.error("ITERATION ABORTED: analyzer failed.");
      process.exit(1);
    }
    last = JSON.parse(readFileSync(reportPath, "utf8")) as IterationSummary;

    // INVARIANT — coverage must never decrease between cycles.
    if (previousCoverage >= 0 && last.coverageBefore < previousCoverage) {
      console.error(
        `ITERATION ABORTED: coverage DECREASED ${previousCoverage}% → ${last.coverageBefore}%. ` +
          "A previous application reduced resolution — revert the last keyword block and investigate."
      );
      process.exit(1);
    }
    previousCoverage = last.coverageBefore;

    appliedByIteration.push({
      iteration,
      coverageBefore: last.coverageBefore,
      applied: last.applied,
      terms: last.proposals.map(({ term, category, recovery }) => ({ term, category, recovery })),
    });

    if (last.coverageBefore >= gate) {
      console.log(`\nGATE MET before further expansion: ${last.coverageBefore}% ≥ ${gate}%.`);
      break;
    }
    if (dryRun) {
      console.log("\n(dry-run — stopping after one analysis cycle)");
      break;
    }
    if (last.applied === 0) {
      console.log("\nCONVERGED: no additional high-confidence mappings exist at current thresholds.");
      break;
    }

    console.log("\n— validating taxonomy after application —");
    if (run("npx", ["tsx", "lib/creator-intelligence/creator-intelligence.test.ts"]) !== 0) {
      console.error("ITERATION ABORTED: creator-intelligence tests failed after applying keywords.");
      process.exit(1);
    }
    console.log("\n— persisting recovered categories (backfill) —");
    if (runOps("scripts/backfill-creator-intelligence.ts", []) !== 0) {
      console.error("ITERATION ABORTED: backfill failed.");
      process.exit(1);
    }
  }

  console.log("\n════════ FINAL PREFLIGHT ════════");
  runOps("scripts/rollout-preflight.ts", []);

  console.log("════════ CONSOLIDATED REPORT ════════");
  for (const cycle of appliedByIteration) {
    console.log(
      `cycle ${cycle.iteration}: coverage ${cycle.coverageBefore}%, applied ${cycle.applied} keyword(s)`
    );
    for (const t of cycle.terms.slice(0, 40)) {
      console.log(`    ${t.term} → ${t.category}  (+${t.recovery})`);
    }
  }
  if (last) {
    console.log(`\nfinal measured coverage        ${last.coverageBefore}%`);
    console.log(`projected after last proposals ${last.projectedAfter}%`);
    console.log(`remaining unresolved           ${last.unresolved}`);
    console.log(`new-category candidates        ${last.newCategoryCandidates.length} (human taxonomy decisions)`);
    for (const c of last.newCategoryCandidates.slice(0, 10)) {
      console.log(`    ~${c.label}  recovery=${c.recovery}  terms: ${c.terms.slice(0, 5).join(", ")}`);
    }
    console.log("\nremaining creators need: external enrichment (no signals), product taxonomy");
    console.log("decisions (clusters above), or acquisition — not further code (see audit:creator-intelligence).");
  }
  rmSync(reportPath, { force: true });
}

main().catch((error) => {
  console.error("TAXONOMY ITERATION FAILED:", error);
  process.exit(1);
});
