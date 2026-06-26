#!/usr/bin/env node
/**
 * Audit publication screenshots — existence, accessibility, size.
 * Auto-requeues failed screenshots when Redis is available.
 * Run: npm run audit:screenshots
 */
import "@/lib/performance/script-env-preload";

import {
  auditScreenshots,
  requeueFailedScreenshots,
} from "@/lib/performance/campaign-performance-audit";
import { createScriptSupabase } from "@/lib/performance/script-env";

async function main(): Promise<void> {
  const supabase = createScriptSupabase();

  console.log("\n=== Campaign Performance — Screenshot Audit ===\n");

  const findings = await auditScreenshots(supabase, { probeRemote: true });
  const byIssue = new Map<string, number>();
  for (const f of findings) {
    byIssue.set(f.issue, (byIssue.get(f.issue) ?? 0) + 1);
  }

  console.log(`Findings: ${findings.length}`);
  for (const [issue, count] of byIssue) {
    console.log(`  ${issue}: ${count}`);
  }

  if (findings.length > 0) {
    console.log("\nSample findings (max 20):");
    for (const f of findings.slice(0, 20)) {
      console.log(`  - ${f.issue} · ${f.publication_id} — ${f.detail}`);
    }
  }

  const requeueIds = findings
    .filter((f) => f.issue !== "missing_url" || f.screenshot_url)
    .map((f) => f.publication_id);

  if (requeueIds.length > 0) {
    const { enqueued } = await requeueFailedScreenshots(supabase, [...new Set(requeueIds)]);
    console.log(`\nRequeued ${enqueued} screenshot job(s).`);
  }

  const critical = findings.filter((f) => f.issue === "inaccessible" || f.issue === "broken_url");
  const verdict = critical.length > 0 ? "FAIL" : findings.length > 0 ? "WARN" : "PASS";
  console.log(`\n=== Verdict: ${verdict} ===\n`);

  if (verdict === "FAIL") process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
