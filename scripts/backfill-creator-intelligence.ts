/**
 * Backfill the Creator Intelligence SQL projection (Phase H).
 *
 *   npx tsx scripts/backfill-creator-intelligence.ts [--pages=N] [--page-size=M]
 *
 * Pages through the unified creator browse (the same merge point every
 * consumer uses), resolves each page through the ONE resolver, and upserts the
 * `creator_intelligence` projection table. Also prints the intelligence
 * coverage report per page batch — the number that gates predicate cutover.
 *
 * Additive/write-scoped: only writes to creator_intelligence; never touches
 * source tables. Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- ops script: service client */
import { createClient } from "@supabase/supabase-js";

import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import { evaluateIntelligenceCoverage } from "@/lib/creator-intelligence/coverage";
import { upsertCreatorIntelligenceProjection } from "@/lib/creator-intelligence/projection";
import { resolveCreatorIntelligenceBatch } from "@/lib/creator-intelligence/resolver";

// Environment is loaded by scripts/run-ops-script.mjs (single env-loading path).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey?.startsWith("eyJ")) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or valid SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}) as any;

function argNumber(name: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  const value = hit ? Number(hit.slice(name.length + 1)) : NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function main() {
  const maxPages = argNumber("--pages", 200);
  const pageSize = argNumber("--page-size", 100);
  let total = 0;
  let categoriesResolved = 0;

  console.log(`Backfilling creator_intelligence (pages=${maxPages}, pageSize=${pageSize})…`);

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await browseUnifiedCreators(
      supabase,
      { page, pageSize, productionOnly: false },
      "discovery"
    );
    const creators = result.creators ?? [];
    if (creators.length === 0) break;

    const profiles = resolveCreatorIntelligenceBatch(creators);
    const { upserted, error } = await upsertCreatorIntelligenceProjection(supabase, profiles);
    if (error) {
      console.error(`  page ${page}: upsert FAILED — ${error}`);
      process.exit(1);
    }

    const coverage = evaluateIntelligenceCoverage(profiles);
    total += upserted;
    categoriesResolved += coverage.categories.resolved;
    console.log(
      `  page ${page}: upserted ${upserted} (categories resolved ${coverage.categories.resolved}/${coverage.total})`
    );

    if (!result.has_more && creators.length < pageSize) break;
  }

  const coveragePct = total === 0 ? 0 : Math.round((categoriesResolved / total) * 100);
  console.log(`\nDone. ${total} profiles projected; category coverage ${coveragePct}%.`);
  console.log("Cutover gate: flip SQL predicates only when platform coverage meets the target");
  console.log("(see docs/CREATOR_INTELLIGENCE_ARCHITECTURE.md — recommend ≥80%).");
}

main().catch((error) => {
  console.error("BACKFILL FAILED:", error);
  process.exit(1);
});
