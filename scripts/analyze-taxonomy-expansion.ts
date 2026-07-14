/**
 * Taxonomy expansion analyzer — grow CREATOR_CATEGORY_KEYWORDS from real
 * creator data, confidence-gated.
 *
 *   npm run taxonomy:analyze                       # report only
 *   npm run taxonomy:analyze -- --apply            # apply high-confidence rows
 *   npm run taxonomy:analyze -- --min-support=5 --min-share=0.7 --min-recovery=3
 *
 * Pages the unified browse, splits creators into resolved/unresolved via the
 * ONE resolver, extracts signal terms, and proposes keyword→category mappings
 * ONLY where resolved creators prove the association (support + share) and
 * unresolved creators are actually recovered. --apply inserts accepted rows
 * into lib/creators/category-keywords.ts (the single taxonomy — no parallel
 * map), then you re-run backfill + audit + preflight to persist and measure.
 *
 * NEW-category clusters (heavy usage, no resolved evidence) are reported for
 * human decision — the pipeline never invents canonical categories.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- ops script: service client */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { CREATOR_CATEGORY_KEYWORDS } from "@/lib/creators/category-keywords";
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import { resolveCreatorIntelligence } from "@/lib/creator-intelligence/resolver";
import {
  DEFAULT_EXPANSION_OPTIONS,
  extractSignalTerms,
  proposeTaxonomyExpansions,
  type ResolvedSignal,
  type UnresolvedSignal,
} from "@/lib/creator-intelligence/taxonomy-expansion";

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

const KEYWORDS_FILE = path.resolve(process.cwd(), "lib/creators/category-keywords.ts");

function argNumber(name: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  const value = hit ? Number(hit.slice(name.length + 1)) : NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Insert accepted proposals into the single keyword map, before its closing brace. */
function applyToKeywordMap(rows: Array<{ term: string; category: string }>): number {
  const source = readFileSync(KEYWORDS_FILE, "utf8");
  const anchor = "};";
  const mapStart = source.indexOf("export const CREATOR_CATEGORY_KEYWORDS");
  const insertAt = source.indexOf(anchor, mapStart);
  if (mapStart < 0 || insertAt < 0) {
    throw new Error("Could not locate CREATOR_CATEGORY_KEYWORDS map for insertion.");
  }
  const existing = new Set(Object.keys(CREATOR_CATEGORY_KEYWORDS));
  const lines = rows
    .filter((row) => !existing.has(row.term))
    .map((row) =>
      /^[a-z][a-z0-9]*$/.test(row.term)
        ? `  ${row.term}: ${JSON.stringify(row.category)},`
        : `  ${JSON.stringify(row.term)}: ${JSON.stringify(row.category)},`
    );
  if (lines.length === 0) return 0;
  const block = `  // Data-driven expansion (taxonomy:analyze — co-occurrence evidence).\n${lines.join("\n")}\n`;
  writeFileSync(KEYWORDS_FILE, source.slice(0, insertAt) + block + source.slice(insertAt));
  return lines.length;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const options = {
    minSupport: argNumber("--min-support", DEFAULT_EXPANSION_OPTIONS.minSupport),
    minShare: Number(
      process.argv.find((a) => a.startsWith("--min-share="))?.split("=")[1] ??
        DEFAULT_EXPANSION_OPTIONS.minShare
    ),
    minRecovery: argNumber("--min-recovery", DEFAULT_EXPANSION_OPTIONS.minRecovery),
    newCategoryThreshold: argNumber(
      "--new-category-threshold",
      DEFAULT_EXPANSION_OPTIONS.newCategoryThreshold
    ),
  };
  const maxPages = argNumber("--pages", 200);
  const pageSize = argNumber("--page-size", 100);

  const resolved: ResolvedSignal[] = [];
  const unresolved: UnresolvedSignal[] = [];
  let total = 0;

  console.log(`\nTAXONOMY EXPANSION ANALYZER (support≥${options.minSupport}, share≥${options.minShare}, recovery≥${options.minRecovery})\n`);

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await browseUnifiedCreators(
      supabase,
      { page, pageSize, productionOnly: false },
      "discovery"
    );
    const creators = result.creators ?? [];
    if (creators.length === 0) break;
    for (const creator of creators) {
      total += 1;
      const intelligence = resolveCreatorIntelligence(creator);
      const terms = extractSignalTerms(creator);
      if (intelligence.categories.value.length > 0) {
        resolved.push({ terms, categories: intelligence.categories.value });
      } else {
        unresolved.push({ id: creator.unified_id, terms });
      }
    }
    if (!result.has_more && creators.length < pageSize) break;
  }

  const coverageBefore = total === 0 ? 0 : Math.round((resolved.length / total) * 100);
  const report = proposeTaxonomyExpansions(
    resolved,
    unresolved,
    new Set(Object.keys(CREATOR_CATEGORY_KEYWORDS)),
    options
  );

  console.log(`creators audited              ${total}`);
  console.log(`coverage BEFORE               ${coverageBefore}% (${resolved.length})`);
  console.log(`unresolved                    ${unresolved.length}`);
  console.log("");
  console.log(`PROPOSALS (${report.proposals.length}) — term → category  [support, share, recovery]:`);
  for (const p of report.proposals.slice(0, 60)) {
    console.log(
      `  ${p.term.padEnd(28)} → ${p.category.padEnd(18)} [${p.support}, ${(p.share * 100).toFixed(0)}%, +${p.recovery}]`
    );
  }
  const projectedAfter =
    total === 0 ? 0 : Math.round(((resolved.length + report.projectedRecovered) / total) * 100);
  console.log("");
  console.log(`projected recovered           +${report.projectedRecovered} creators`);
  console.log(`projected coverage AFTER      ${projectedAfter}%`);
  console.log("");
  console.log(`NEW-CATEGORY candidates (${report.newCategoryCandidates.length}) — human decision required:`);
  for (const c of report.newCategoryCandidates.slice(0, 15)) {
    console.log(`  ~${c.label.padEnd(26)} recovery=${c.recovery}  terms: ${c.terms.slice(0, 6).join(", ")}`);
  }

  if (apply) {
    const applied = applyToKeywordMap(
      report.proposals.map(({ term, category }) => ({ term, category }))
    );
    console.log(`\nAPPLIED ${applied} keyword(s) to lib/creators/category-keywords.ts.`);
    console.log("Next: npm run test:creator-intelligence && npm run backfill:creator-intelligence");
    console.log("      && npm run audit:creator-intelligence && npm run rollout:preflight");
    console.log("Then re-run this analyzer — iterate until proposals dry up.\n");
  } else {
    console.log("\n(report only — re-run with --apply to write high-confidence rows)\n");
  }
}

main().catch((error) => {
  console.error("TAXONOMY ANALYSIS FAILED:", error);
  process.exit(1);
});
