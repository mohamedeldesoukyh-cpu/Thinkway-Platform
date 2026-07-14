/**
 * Creator Intelligence enrichment audit — WHY are categories unresolved, and
 * which creators are recoverable from data we already have?
 *
 *   npm run audit:creator-intelligence   [--pages=N] [--page-size=M] [--samples=K]
 *
 * Pages the unified browse (same merge point as the backfill), resolves every
 * creator through the ONE resolver (including the deepened profile-signal
 * inference), and classifies each unresolved creator:
 *
 *   recovered_by_signals   deep inference resolves it NOW (pipeline depth gap —
 *                          fixed; applied by re-running the backfill)
 *   provenance_only        discovery creator whose only tags are crawl search
 *                          intent (excluded by design — import-bug class)
 *   no_signals_at_all      nothing to infer from: no DNA, no AI score, no bio,
 *                          no hashtags/interests/niche/captions → needs
 *                          EXTERNAL enrichment (AI scoring / Apify)
 *   signals_but_no_match   has bio/signals but none map to the canonical
 *                          taxonomy (candidates for keyword-map growth)
 *
 * Plus per-creator missing-source flags (missing_dna / missing_ai_score /
 * missing_bio / missing_profile_signals) and a before → projected-after
 * coverage report. Read-only; writes nothing.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- ops script: service client */
import { createClient } from "@supabase/supabase-js";

import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import { resolveCreatorIntelligence } from "@/lib/creator-intelligence/resolver";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

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

type GapClass =
  | "recovered_by_signals"
  | "provenance_only"
  | "no_signals_at_all"
  | "signals_but_no_match";

type Sample = { unifiedId: string; name: string; missing: string[] };

function missingSourceFlags(creator: UnifiedCreatorResult): string[] {
  const missing: string[] = [];
  if ((creator.dna_completeness ?? 0) === 0) missing.push("missing_dna");
  if (!creator.ai_category?.trim()) missing.push("missing_ai_score");
  if (!creator.bio?.trim()) missing.push("missing_bio");
  const hasSignals =
    (creator.hashtags?.length ?? 0) > 0 ||
    (creator.audience_interests?.length ?? 0) > 0 ||
    Boolean(creator.ai_niche?.trim()) ||
    (creator.recent_publications ?? []).some((p) => p.caption?.trim());
  if (!hasSignals) missing.push("missing_profile_signals");
  return missing;
}

function hasAnyTextSignal(creator: UnifiedCreatorResult): boolean {
  return (
    Boolean(creator.bio?.trim()) ||
    (creator.hashtags?.length ?? 0) > 0 ||
    (creator.audience_interests?.length ?? 0) > 0 ||
    Boolean(creator.ai_niche?.trim()) ||
    (creator.recent_publications ?? []).some((p) => p.caption?.trim())
  );
}

async function main() {
  const maxPages = argNumber("--pages", 200);
  const pageSize = argNumber("--page-size", 100);
  const sampleLimit = argNumber("--samples", 5);

  let total = 0;
  let resolvedBefore = 0; // stored/AI paths that resolve regardless of depth
  let resolvedNow = 0; // everything the current (deepened) resolver resolves
  const gapCounts = new Map<GapClass, number>();
  const missingCounts = new Map<string, number>();
  const samples = new Map<GapClass, Sample[]>();

  console.log(`\nCREATOR INTELLIGENCE — CATEGORY GAP AUDIT (pages=${maxPages}, pageSize=${pageSize})\n`);

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await browseUnifiedCreators(
      supabase,
      { page, pageSize, productionOnly: false },
      "discovery"
    );
    const creators: UnifiedCreatorResult[] = result.creators ?? [];
    if (creators.length === 0) break;

    for (const creator of creators) {
      total += 1;
      const intelligence = resolveCreatorIntelligence(creator);
      const resolved = intelligence.categories.value.length > 0;
      if (resolved) resolvedNow += 1;
      if (resolved && intelligence.categories.source !== "bio_inference") resolvedBefore += 1;

      if (resolved && intelligence.categories.source === "bio_inference") {
        // Resolves via inference — count as previously-resolved only when a
        // stored intelligence category existed (internal creators).
        if (creator.source_type !== "public_discovery" && (creator.categories?.length ?? 0) > 0) {
          resolvedBefore += 1;
        } else {
          bumpGap("recovered_by_signals", creator);
        }
        continue;
      }
      if (resolved) continue;

      // Unresolved even with deep inference — classify why.
      for (const flag of missingSourceFlags(creator)) {
        missingCounts.set(flag, (missingCounts.get(flag) ?? 0) + 1);
      }
      if (
        creator.source_type === "public_discovery" &&
        (creator.browse_category_tags?.length ?? 0) > 0
      ) {
        bumpGap("provenance_only", creator);
      } else if (!hasAnyTextSignal(creator)) {
        bumpGap("no_signals_at_all", creator);
      } else {
        bumpGap("signals_but_no_match", creator);
      }
    }

    if (!result.has_more && creators.length < pageSize) break;
  }

  function bumpGap(gapClass: GapClass, creator: UnifiedCreatorResult) {
    gapCounts.set(gapClass, (gapCounts.get(gapClass) ?? 0) + 1);
    const list = samples.get(gapClass) ?? [];
    if (list.length < sampleLimit) {
      list.push({
        unifiedId: creator.unified_id,
        name: creator.display_name,
        missing: missingSourceFlags(creator),
      });
      samples.set(gapClass, list);
    }
  }

  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  console.log("──────────────────────────────────────────────────");
  console.log(`total creators audited        ${total}`);
  console.log(`coverage BEFORE deepening     ~${pct(resolvedBefore)}% (${resolvedBefore})`);
  console.log(`coverage AFTER deepening      ${pct(resolvedNow)}% (${resolvedNow})  ← apply with npm run backfill:creator-intelligence`);
  console.log("");
  console.log("gap classification (unresolved after deepening + recovered):");
  for (const gapClass of [
    "recovered_by_signals",
    "provenance_only",
    "no_signals_at_all",
    "signals_but_no_match",
  ] as GapClass[]) {
    const count = gapCounts.get(gapClass) ?? 0;
    console.log(`  ${gapClass.padEnd(24)} ${String(count).padStart(6)}  (${pct(count)}%)`);
    for (const sample of samples.get(gapClass) ?? []) {
      console.log(`      e.g. ${sample.unifiedId}  ${sample.name}  [${sample.missing.join(", ")}]`);
    }
  }
  console.log("");
  console.log("missing-source flags among UNRESOLVED creators:");
  for (const [flag, count] of [...missingCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${flag.padEnd(24)} ${String(count).padStart(6)}`);
  }
  console.log("");
  console.log("next actions:");
  console.log("  recovered_by_signals → run npm run backfill:creator-intelligence to persist.");
  console.log("  no_signals_at_all    → external enrichment required (AI scoring / Apify profile fetch).");
  console.log("  signals_but_no_match → review sampled text; extend CREATOR_CATEGORY_KEYWORDS if real niches.");
  console.log("  provenance_only      → same as no_signals unless enrichment adds real categories.\n");
}

main().catch((error) => {
  console.error("AUDIT FAILED:", error);
  process.exit(1);
});
