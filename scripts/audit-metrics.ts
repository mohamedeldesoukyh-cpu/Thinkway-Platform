#!/usr/bin/env node
/**
 * Audit publication metrics integrity — ranges, engagements, ER anomalies.
 * Run: npm run audit:metrics
 */
import "@/lib/performance/script-env-preload";

import { auditMetricsIntegrity } from "@/lib/performance/campaign-performance-audit";
import {
  createScriptSupabase,
  formatScriptErrorWithDiagnostics,
} from "@/lib/performance/script-env";

async function main(): Promise<void> {
  const supabase = createScriptSupabase();

  console.log("\n=== Campaign Performance — Metrics Audit ===\n");

  const findings = await auditMetricsIntegrity(supabase);
  const byIssue = new Map<string, number>();
  for (const f of findings) {
    byIssue.set(f.issue, (byIssue.get(f.issue) ?? 0) + 1);
  }

  console.log(`Anomalies: ${findings.length}`);
  for (const [issue, count] of byIssue) {
    console.log(`  ${issue}: ${count}`);
  }

  if (findings.length > 0) {
    console.log("\nSample findings (max 30):");
    for (const f of findings.slice(0, 30)) {
      console.log(`  - ${f.issue} · ${f.publication_id} — ${f.detail}`);
    }
  }

  const critical = findings.filter(
    (f) => f.issue === "negative_metric" || f.issue === "er_out_of_range" || f.issue === "engagements_below_sum"
  );
  const verdict = critical.length > 0 ? "FAIL" : findings.length > 0 ? "WARN" : "PASS";
  console.log(`\n=== Verdict: ${verdict} ===\n`);

  if (verdict === "FAIL") process.exit(1);
}

main().catch(async (error) => {
  console.error(await formatScriptErrorWithDiagnostics(error));
  process.exit(1);
});
