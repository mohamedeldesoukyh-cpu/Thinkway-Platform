#!/usr/bin/env node
/**
 * Campaign Performance final audit — scans campaign_publications for data quality issues.
 * Run: npm run audit:campaign-performance
 */
import "@/lib/performance/script-env-preload";

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  buildAuditVerdict,
  filterFindingsByCreator,
  runCampaignPerformanceExtendedAudit,
  type CampaignPerformanceAuditFinding,
} from "@/lib/performance/campaign-performance-audit";
import { createScriptSupabase, formatScriptError, getProjectRoot } from "@/lib/performance/script-env";

const root = getProjectRoot();
const OUTPUT_PATH = path.join(root, "docs/CAMPAIGN_PERFORMANCE_FINAL_AUDIT.md");
const STATE_PATH = path.join(root, "docs/.campaign-performance-audit-state.json");

function formatFinding(f: CampaignPerformanceAuditFinding): string {
  const recovery =
    f.recoverable && Object.keys(f.recoverable).length > 0
      ? ` Recoverable: ${JSON.stringify(f.recoverable)}`
      : "";
  return `- **${f.issue}** · ${f.creator} · \`${f.publication_id}\` · ${f.platform} — ${f.detail}${recovery}`;
}

function formatQueueRow(q: { name: string; active: number; waiting: number; delayed: number; failed: number }): string {
  return `| ${q.name} | ${q.active} | ${q.waiting} | ${q.delayed} | ${q.failed} |`;
}

async function main(): Promise<void> {
  const supabase = createScriptSupabase();

  const audit = await runCampaignPerformanceExtendedAudit(supabase);
  const verdict = buildAuditVerdict(audit);
  const shimaaFindings = filterFindingsByCreator(audit.findings, /shimaa/i);
  const husseinFindings = filterFindingsByCreator(audit.findings, /hussein/i);
  const shaibanFindings = filterFindingsByCreator(audit.findings, /shaiban/i);

  const markdown = `# Campaign Performance Final Audit

Generated: ${audit.scannedAt}

## Verdict: **${verdict.verdict}**

${verdict.failReasons.length > 0 ? `### Fail reasons\n${verdict.failReasons.map((r) => `- ${r}`).join("\n")}\n` : ""}
${verdict.warnReasons.length > 0 ? `### Warnings\n${verdict.warnReasons.map((r) => `- ${r}`).join("\n")}\n` : ""}

## Summary

| Check | Count |
| --- | ---: |
| Total campaigns | ${audit.totalCampaigns} |
| Campaigns with publications | ${audit.campaignsWithPublications} |
| Publications scanned | ${audit.totalPublications} |
| Publications missing metrics | ${audit.publicationsMissingMetrics} |
| Publications missing screenshots | ${audit.publicationsMissingScreenshots} |
| Creators missing avatars | ${audit.creatorsMissingAvatars} |
| Stale metrics (>24h) | ${audit.staleMetricsCount} |
| Failed sync jobs (7d) | ${audit.failedSyncJobsCount} |
| Queue backlog (waiting+delayed) | ${audit.queueBacklog} |
| Orphan metrics rows | ${audit.orphanMetricsRows} |
| Orphan screenshot refs | ${audit.orphanScreenshots} |
| Report generation failures | ${audit.reportGenerationFailures} |
| Metrics regressions (recoverable) | ${audit.recoverableMetricsCount} |
| Platform mismatches | ${audit.platformMismatchesCount} |

## Queue status

| Queue | Active | Waiting | Delayed | Failed |
| --- | ---: | ---: | ---: | ---: |
${audit.queueStats.map(formatQueueRow).join("\n")}

## Target creators

### Shimaa Saber (${shimaaFindings.length} findings)
${shimaaFindings.length === 0 ? "_No open findings._" : shimaaFindings.map(formatFinding).join("\n")}

### Hussein Elmaghraby (${husseinFindings.length} findings)
${husseinFindings.length === 0 ? "_No open findings._" : husseinFindings.map(formatFinding).join("\n")}

### Mohamed Shaiban (${shaibanFindings.length} findings)
${shaibanFindings.length === 0 ? "_No open findings._" : shaibanFindings.map(formatFinding).join("\n")}

## All findings (max 100)

${audit.findings.slice(0, 100).map(formatFinding).join("\n") || "_No issues detected._"}

## Recovery

Publications with \`metrics_regression\` include \`recoverable\` metric values from \`publication_metric_sync_logs.metrics_snapshot\`.
Re-run \`npm run refresh:affected-creator-metrics\` after deploying fixes, or apply manual import using those values.

`;

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, markdown, "utf8");
  writeFileSync(
    STATE_PATH,
    JSON.stringify({ scannedAt: audit.scannedAt, verdict: verdict.verdict }, null, 2),
    "utf8"
  );

  console.log(`Audit complete: ${audit.totalPublications} publications scanned`);
  console.log(`Report written to ${OUTPUT_PATH}`);
  console.log(
    `Summary: campaigns=${audit.totalCampaigns}, missing_metrics=${audit.publicationsMissingMetrics}, screenshots=${audit.publicationsMissingScreenshots}, stale=${audit.staleMetricsCount}, failed_jobs=${audit.failedSyncJobsCount}, queue_backlog=${audit.queueBacklog}`
  );
  console.log(`\n=== VERDICT: ${verdict.verdict} ===`);
  if (verdict.failReasons.length) {
    console.log("FAIL reasons:", verdict.failReasons.join("; "));
  }
  if (verdict.warnReasons.length) {
    console.log("WARN reasons:", verdict.warnReasons.join("; "));
  }

  if (verdict.verdict === "FAIL") process.exit(1);
}

main().catch((error) => {
  console.error(formatScriptError(error));
  process.exit(1);
});
