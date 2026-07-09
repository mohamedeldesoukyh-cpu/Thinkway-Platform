#!/usr/bin/env node
/** Retry baseline DNA for influencers still missing creator_dna rows. */
import "@/lib/performance/script-env-preload";

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { ensureCreatorBaselineDna } from "@/features/creator-dna/services/baseline-dna-populator";
import { generateCreatorDnaCoverageReport } from "@/features/creator-dna/services/creator-dna-coverage-report";
import {
  createScriptSupabase,
  formatScriptErrorWithDiagnostics,
  getProjectRoot,
} from "@/lib/performance/script-env";

const REPORT_RELATIVE = "docs/release/1.2/creator-dna-baseline-coverage-report.json";
const REPORT_MD_RELATIVE = "docs/release/1.2/creator-dna-baseline-coverage-report.md";

async function findMissingInfluencerIds(
  supabase: ReturnType<typeof createScriptSupabase>
): Promise<string[]> {
  const dnaIds = new Set<string>();
  const PAGE = 1000;
  let dnaOffset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("creator_dna")
      .select("influencer_id")
      .order("influencer_id", { ascending: true })
      .range(dnaOffset, dnaOffset + PAGE - 1);

    if (error) throw new Error(error.message);
    const batch = data ?? [];
    for (const row of batch) {
      dnaIds.add(row.influencer_id as string);
    }
    if (batch.length < PAGE) break;
    dnaOffset += PAGE;
  }

  const missing: string[] = [];
  let influencerOffset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("influencers")
      .select("id")
      .order("id", { ascending: true })
      .range(influencerOffset, influencerOffset + PAGE - 1);

    if (error) throw new Error(error.message);
    const batch = data ?? [];
    for (const row of batch) {
      const id = row.id as string;
      if (!dnaIds.has(id)) missing.push(id);
    }
    if (batch.length < PAGE) break;
    influencerOffset += PAGE;
  }

  return missing;
}

function writeCoverageArtifacts(report: Awaited<ReturnType<typeof generateCreatorDnaCoverageReport>>) {
  const jsonPath = path.join(getProjectRoot(), REPORT_RELATIVE);
  const mdPath = path.join(getProjectRoot(), REPORT_MD_RELATIVE);
  mkdirSync(path.dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  const lines = [
    "# Creator DNA Baseline — Coverage Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `| Total creators | ${report.totals.creators} |`,
    `| Total DNA documents | ${report.totals.dnaDocuments} |`,
    `| Missing DNA | ${report.totals.missingDna} |`,
    `| Average completeness | ${report.totals.averageCompleteness}% |`,
  ];
  writeFileSync(mdPath, lines.join("\n"), "utf8");
  console.log(`[retry-missing-dna] report → ${jsonPath}`);
}

async function main(): Promise<void> {
  const supabase = createScriptSupabase();
  const missing = await findMissingInfluencerIds(supabase);
  console.log(`[retry-missing-dna] missing=${missing.length}`);

  let fixed = 0;
  let failed = 0;

  for (const influencerId of missing) {
    const result = await ensureCreatorBaselineDna(supabase, influencerId);
    if (result.ok) {
      fixed += 1;
      console.log(`[retry-missing-dna] ok ${influencerId}`);
    } else {
      failed += 1;
      console.error(`[retry-missing-dna] fail ${influencerId}: ${result.message}`);
    }
  }

  const report = await generateCreatorDnaCoverageReport(supabase);
  writeCoverageArtifacts(report);

  console.log(`[retry-missing-dna] fixed=${fixed} failed=${failed}`);
  if (report.totals.missingDna > 0) {
    process.exit(1);
  }
}

main().catch(async (error) => {
  console.error("[retry-missing-dna] fatal\n", await formatScriptErrorWithDiagnostics(error));
  process.exit(1);
});
