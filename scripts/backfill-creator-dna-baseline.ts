#!/usr/bin/env node
/**
 * Phase 2 — Backfill Creator DNA baseline for ALL existing influencers.
 *
 * Features:
 * - Continuous progress reporting (total, processed, created, merged, skipped, errors, avg completeness, ETA)
 * - Resume from last successfully processed creator via checkpoint file
 *
 * Run:
 *   npm run backfill:creator-dna-baseline
 *   npm run backfill:creator-dna-baseline -- --dry-run
 *   npm run backfill:creator-dna-baseline -- --reset
 *   npm run backfill:creator-dna-baseline -- --influencer=<uuid>
 */
import "@/lib/performance/script-env-preload";

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

import { ensureCreatorBaselineDna } from "@/features/creator-dna/services/baseline-dna-populator";
import {
  generateCreatorDnaCoverageReport,
  type CreatorDnaCoverageReport,
} from "@/features/creator-dna/services/creator-dna-coverage-report";
import { CreatorDNAService } from "@/features/creator-dna/services/creator-dna-service";
import {
  createScriptSupabase,
  formatScriptErrorWithDiagnostics,
  getProjectRoot,
  parseCliArgs,
} from "@/lib/performance/script-env";

const BATCH_SIZE = 100;
const PROGRESS_INTERVAL_MS = 5_000;
const CHECKPOINT_RELATIVE = "docs/release/1.2/creator-dna-baseline-checkpoint.json";
const REPORT_RELATIVE = "docs/release/1.2/creator-dna-baseline-coverage-report.json";
const REPORT_MD_RELATIVE = "docs/release/1.2/creator-dna-baseline-coverage-report.md";

type BackfillStats = {
  total: number;
  processed: number;
  created: number;
  merged: number;
  skipped: number;
  errors: number;
  completenessSum: number;
  completenessSamples: number;
  startedAt: number;
  lastProcessedId: string | null;
  errorDetails: Array<{ influencerId: string; message: string }>;
};

type CheckpointFile = {
  version: 1;
  lastProcessedId: string | null;
  stats: Omit<BackfillStats, "startedAt"> & { startedAt: string };
  updatedAt: string;
};

function checkpointPath(): string {
  return path.join(getProjectRoot(), CHECKPOINT_RELATIVE);
}

function reportJsonPath(): string {
  return path.join(getProjectRoot(), REPORT_RELATIVE);
}

function reportMdPath(): string {
  return path.join(getProjectRoot(), REPORT_MD_RELATIVE);
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (minutes < 60) return `${minutes}m ${rem}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function averageCompleteness(stats: BackfillStats): number {
  if (stats.completenessSamples === 0) return 0;
  return Math.round((stats.completenessSum / stats.completenessSamples) * 10) / 10;
}

function estimatedRemainingMs(stats: BackfillStats): number | null {
  if (stats.processed === 0 || stats.total <= stats.processed) return null;
  const elapsed = Date.now() - stats.startedAt;
  const perItem = elapsed / stats.processed;
  return perItem * (stats.total - stats.processed);
}

function formatProgress(stats: BackfillStats): string {
  const eta = estimatedRemainingMs(stats);
  return [
    `total=${stats.total}`,
    `processed=${stats.processed}`,
    `created=${stats.created}`,
    `merged=${stats.merged}`,
    `skipped=${stats.skipped}`,
    `errors=${stats.errors}`,
    `avgCompleteness=${averageCompleteness(stats)}`,
    `eta=${eta != null ? formatDuration(eta) : "—"}`,
    stats.lastProcessedId ? `cursor=${stats.lastProcessedId}` : "cursor=—",
  ].join(" | ");
}

function loadCheckpoint(): CheckpointFile | null {
  const filePath = checkpointPath();
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as CheckpointFile;
  } catch {
    return null;
  }
}

function saveCheckpoint(stats: BackfillStats): void {
  const filePath = checkpointPath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  const payload: CheckpointFile = {
    version: 1,
    lastProcessedId: stats.lastProcessedId,
    stats: {
      total: stats.total,
      processed: stats.processed,
      created: stats.created,
      merged: stats.merged,
      skipped: stats.skipped,
      errors: stats.errors,
      completenessSum: stats.completenessSum,
      completenessSamples: stats.completenessSamples,
      startedAt: new Date(stats.startedAt).toISOString(),
      lastProcessedId: stats.lastProcessedId,
      errorDetails: stats.errorDetails.slice(-50),
    },
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function writeCoverageArtifacts(report: CreatorDnaCoverageReport): void {
  const jsonPath = reportJsonPath();
  const mdPath = reportMdPath();
  mkdirSync(path.dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  const lines = [
    "# Creator DNA Baseline — Coverage Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Totals",
    "",
    `| Metric | Value |`,
    `|--------|------:|`,
    `| Total creators | ${report.totals.creators} |`,
    `| Total DNA documents | ${report.totals.dnaDocuments} |`,
    `| Missing DNA | ${report.totals.missingDna} |`,
    `| Average completeness | ${report.totals.averageCompleteness}% |`,
    `| Created (backfill) | ${report.totals.createdDuringBackfill} |`,
    `| Merged (backfill) | ${report.totals.mergedDuringBackfill} |`,
    `| Skipped (backfill) | ${report.totals.skippedDuringBackfill} |`,
    `| Errors (backfill) | ${report.totals.errorsDuringBackfill} |`,
    "",
    "## Completeness distribution",
    "",
    ...Object.entries(report.completenessDistribution).map(
      ([band, count]) => `- **${band}%**: ${count}`
    ),
    "",
    "## Platform breakdown",
    "",
    ...Object.entries(report.platformBreakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([platform, count]) => `- ${platform}: ${count}`),
    "",
    "## Top missing intelligence fields",
    "",
    ...report.topMissingFields.map((row) => `- ${row.field}: ${row.count}`),
    "",
    "## Lifecycle breakdown",
    "",
    ...Object.entries(report.lifecycleBreakdown).map(
      ([lifecycle, count]) => `- ${lifecycle}: ${count}`
    ),
  ];

  writeFileSync(mdPath, lines.join("\n"), "utf8");
  console.log(`[backfill-dna] coverage report → ${jsonPath}`);
  console.log(`[backfill-dna] coverage report → ${mdPath}`);
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const supabase = createScriptSupabase();
  const service = new CreatorDNAService(supabase);

  const dryRun = args["dry-run"] === true || args.dryRun === true;
  const reset = args.reset === true;
  const influencerFilter =
    typeof args.influencer === "string" ? args.influencer.trim() : null;

  if (reset && existsSync(checkpointPath())) {
    writeFileSync(checkpointPath(), "", "utf8");
    console.log("[backfill-dna] checkpoint reset");
  }

  const checkpoint = reset ? null : loadCheckpoint();
  const resumeFromId = influencerFilter ? null : checkpoint?.lastProcessedId ?? null;

  const { count: totalCreators, error: countError } = await supabase
    .from("influencers")
    .select("id", { count: "exact", head: true });

  if (countError) throw new Error(countError.message);

  const stats: BackfillStats = {
    total: totalCreators ?? 0,
    processed: checkpoint?.stats.processed ?? 0,
    created: checkpoint?.stats.created ?? 0,
    merged: checkpoint?.stats.merged ?? 0,
    skipped: checkpoint?.stats.skipped ?? 0,
    errors: checkpoint?.stats.errors ?? 0,
    completenessSum: checkpoint?.stats.completenessSum ?? 0,
    completenessSamples: checkpoint?.stats.completenessSamples ?? 0,
    startedAt: checkpoint?.stats.startedAt
      ? new Date(checkpoint.stats.startedAt).getTime()
      : Date.now(),
    lastProcessedId: resumeFromId,
    errorDetails: checkpoint?.stats.errorDetails ?? [],
  };

  console.log(
    `[backfill-dna] Creator DNA baseline backfill${dryRun ? " [dry-run]" : ""}${
      resumeFromId ? ` resume after=${resumeFromId}` : ""
    }`
  );
  if (!dryRun) {
    console.log(
      "[backfill-dna] tip: apply migration 20260706120000_creator_dna_intelligence_metadata.sql for cached lifecycle columns"
    );
  }
  console.log(`[backfill-dna] ${formatProgress(stats)}`);

  let lastProgressLog = Date.now();
  let cursorId: string | null = resumeFromId;

  while (true) {
    let query = supabase
      .from("influencers")
      .select("id")
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (influencerFilter) {
      query = query.eq("id", influencerFilter);
    } else if (cursorId) {
      query = query.gt("id", cursorId);
    }

    const { data: rows, error: batchError } = await query;
    if (batchError) throw new Error(batchError.message);

    const batch = (rows ?? []) as Array<{ id: string }>;
    if (batch.length === 0) break;

    for (const row of batch) {
      const influencerId = row.id;

      if (dryRun) {
        stats.processed += 1;
        stats.lastProcessedId = influencerId;
        cursorId = influencerId;
        continue;
      }

      try {
        const hadDna = Boolean(await service.getCreatorDNA(influencerId));
        const result = await ensureCreatorBaselineDna(supabase, influencerId);

        if (!result.ok) {
          stats.errors += 1;
          stats.errorDetails.push({
            influencerId,
            message: result.message,
          });
          stats.processed += 1;
          const now = Date.now();
          if (now - lastProgressLog >= PROGRESS_INTERVAL_MS) {
            console.log(`[backfill-dna] ${formatProgress(stats)}`);
            lastProgressLog = now;
          }
          continue;
        }

        if (result.created) {
          stats.created += 1;
        } else if (result.changedFields.length > 0) {
          stats.merged += 1;
        } else if (hadDna) {
          stats.skipped += 1;
        } else {
          stats.created += 1;
        }

        const dnaRow = await supabase
          .from("creator_dna")
          .select("dna_completeness_score")
          .eq("influencer_id", influencerId)
          .maybeSingle();

        const score = Number(
          (dnaRow.data as { dna_completeness_score?: number | null } | null)
            ?.dna_completeness_score
        );
        if (Number.isFinite(score)) {
          stats.completenessSum += score;
          stats.completenessSamples += 1;
        }

        stats.processed += 1;
        stats.lastProcessedId = influencerId;
        cursorId = influencerId;

        if (!dryRun) {
          saveCheckpoint(stats);
        }
      } catch (error) {
        stats.errors += 1;
        stats.errorDetails.push({
          influencerId,
          message: error instanceof Error ? error.message : String(error),
        });
        stats.processed += 1;
      }

      const now = Date.now();
      if (now - lastProgressLog >= PROGRESS_INTERVAL_MS) {
        console.log(`[backfill-dna] ${formatProgress(stats)}`);
        lastProgressLog = now;
      }
    }

    if (influencerFilter || batch.length < BATCH_SIZE) break;
  }

  console.log(`[backfill-dna] complete ${formatProgress(stats)}`);

  if (dryRun) {
    console.log("[backfill-dna] dry-run complete — no coverage report written");
    return;
  }

  const report = await generateCreatorDnaCoverageReport(supabase, {
    created: stats.created,
    merged: stats.merged,
    skipped: stats.skipped,
    errors: stats.errors,
  });

  writeCoverageArtifacts(report);

  if (report.totals.missingDna > 0) {
    console.log(
      `[backfill-dna] ${report.totals.missingDna} creator(s) still missing DNA — run: npx tsx --import ./lib/performance/script-env-preload.ts scripts/retry-missing-creator-dna.ts`
    );
  }

  if (existsSync(checkpointPath())) {
    writeFileSync(checkpointPath(), "", "utf8");
  }
  console.log("[backfill-dna] checkpoint cleared — backfill finished");
}

main().catch(async (error) => {
  console.error("[backfill-dna] fatal\n", await formatScriptErrorWithDiagnostics(error));
  process.exit(1);
});
