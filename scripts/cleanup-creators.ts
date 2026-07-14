/**
 * Creator Cleanup Tool — archive creators with absolutely no usable
 * intelligence, verified against every usage surface. Soft delete only.
 *
 *   npm run cleanup:creators                 # dry-run (default): report only
 *   npm run cleanup:creators -- --apply      # archive verified safe influencers
 *   npm run cleanup:creators -- --limit=500  # cap per run
 *
 * A creator is safe_archive ONLY when it has: no Creator DNA, no AI score, no
 * bio, no audience interests, no captions, no profile signals, no stored
 * categories, no platform metrics, no manual edits (notes / manual or uploaded
 * avatar / manual metric overrides), AND no references in campaign_influencers,
 * campaign_publications, quotation_items, creator_movements (shortlists),
 * portal_uploads, influencer_documents (internal) or discovery_shortlist_items
 * (discovered).
 *
 * Archive mechanism: influencers.status = 'archived' — every browse/RPC
 * already filters status='active', so archived creators leave Discovery and
 * the coverage denominator with zero data loss and zero code changes.
 * Discovered-profile candidates are REPORTED but deferred (no status column;
 * archiving them needs a schema decision).
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- ops script: service client */
import { createClient } from "@supabase/supabase-js";

import {
  classifyCreatorForCleanup,
  type CleanupVerdict,
  type CreatorReferences,
} from "@/lib/creators/cleanup-classification";
import { resolveCreatorIntelligence } from "@/lib/creator-intelligence/resolver";
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
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

const INFLUENCER_REFERENCE_TABLES = [
  "campaign_influencers",
  "campaign_publications",
  "quotation_items",
  "creator_movements",
  "portal_uploads",
  "influencer_documents",
] as const;

function argNumber(name: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  const value = hit ? Number(hit.slice(name.length + 1)) : NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Batch-collect referenced influencer ids across every usage table. */
async function referencedInfluencerIds(ids: string[]): Promise<Map<string, Set<string>>> {
  const referenced = new Map<string, Set<string>>();
  for (const table of INFLUENCER_REFERENCE_TABLES) {
    for (let i = 0; i < ids.length; i += 200) {
      const batch = ids.slice(i, i + 200);
      const { data, error } = await supabase
        .from(table)
        .select("influencer_id")
        .in("influencer_id", batch);
      if (error) {
        // Table may not exist in this environment — report, never guess-safe.
        console.warn(`  (reference check ${table} failed: ${error.message} — treating batch as REFERENCED for safety)`);
        for (const id of batch) {
          const set = referenced.get(id) ?? new Set<string>();
          set.add(table);
          referenced.set(id, set);
        }
        continue;
      }
      for (const row of data ?? []) {
        const set = referenced.get(row.influencer_id) ?? new Set<string>();
        set.add(table);
        referenced.set(row.influencer_id, set);
      }
    }
  }
  return referenced;
}

/** Batch-collect referenced discovered-profile ids (shortlist items). */
async function referencedProfileIds(ids: string[]): Promise<Set<string>> {
  const referenced = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200);
    const { data, error } = await supabase
      .from("discovery_shortlist_items")
      .select("profile_id")
      .in("profile_id", batch);
    if (error) {
      console.warn(`  (discovery_shortlist_items check failed: ${error.message} — treating batch as REFERENCED)`);
      for (const id of batch) referenced.add(id);
      continue;
    }
    for (const row of data ?? []) referenced.add(row.profile_id);
  }
  return referenced;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const limit = argNumber("--limit", 10_000);
  const maxPages = argNumber("--pages", 200);
  const pageSize = argNumber("--page-size", 100);

  console.log(`\nCREATOR CLEANUP ${apply ? "— APPLY (soft archive)" : "— DRY-RUN (report only)"}\n`);

  // 1) Sweep the pool; keep only zero-intelligence candidates for reference checks.
  const candidates: UnifiedCreatorResult[] = [];
  let total = 0;
  let resolvedCount = 0;
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
      if (intelligence.categories.value.length > 0) {
        resolvedCount += 1;
        continue; // has intelligence — never a candidate
      }
      candidates.push(creator);
    }
    if (!result.has_more && creators.length < pageSize) break;
  }

  // 2) Reference checks (batched) for the candidate set only.
  const influencerIds = candidates
    .map((c) => c.influencer_id)
    .filter((id): id is string => Boolean(id));
  const profileIds = candidates
    .filter((c) => !c.influencer_id)
    .map((c) => c.discovered_profile_id)
    .filter((id): id is string => Boolean(id));
  const influencerRefs = await referencedInfluencerIds(influencerIds);
  const profileRefs = await referencedProfileIds(profileIds);

  // 3) Classify.
  const verdicts: CleanupVerdict[] = candidates.map((creator) => {
    const refTables = creator.influencer_id
      ? influencerRefs.get(creator.influencer_id) ?? new Set<string>()
      : new Set<string>();
    const references: CreatorReferences = {
      campaignUsage: refTables.has("campaign_influencers") || refTables.has("campaign_publications"),
      shortlistReferences:
        refTables.has("creator_movements") ||
        (!creator.influencer_id &&
          Boolean(creator.discovered_profile_id) &&
          profileRefs.has(creator.discovered_profile_id!)),
      quotationReferences: refTables.has("quotation_items"),
      portalOrDocuments: refTables.has("portal_uploads") || refTables.has("influencer_documents"),
    };
    return classifyCreatorForCleanup(creator, references);
  });

  const safeInternal = verdicts.filter(
    (v) => v.verdict === "safe_archive" && v.sourceType !== "public_discovery"
  );
  const safeDiscoveredDeferred = verdicts.filter(
    (v) => v.verdict === "safe_archive" && v.sourceType === "public_discovery"
  );
  const mustKeep = verdicts.filter((v) => v.verdict === "must_keep");
  const toArchive = safeInternal.slice(0, limit);

  // 4) Report.
  const keepReasonCounts = new Map<string, number>();
  for (const v of mustKeep) {
    for (const reason of v.keepReasons) {
      keepReasonCounts.set(reason, (keepReasonCounts.get(reason) ?? 0) + 1);
    }
  }
  console.log("──────────────────────────────────────────────────");
  console.log(`total creators                     ${total}`);
  console.log(`with intelligence (never touched)  ${resolvedCount}`);
  console.log(`zero-category candidates checked   ${candidates.length}`);
  console.log("");
  console.log(`SAFE TO ARCHIVE (influencers)      ${safeInternal.length}${apply ? `  → archiving ${toArchive.length}` : ""}`);
  console.log(`SAFE TO ARCHIVE (discovered — deferred, needs schema decision) ${safeDiscoveredDeferred.length}`);
  console.log(`MUST KEEP (candidates w/ signals or references) ${mustKeep.length}`);
  for (const [reason, count] of [...keepReasonCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${reason.padEnd(36)} ${count}`);
  }

  const newTotal = total - toArchive.length;
  const projectedCoverage = newTotal === 0 ? 0 : Math.round((resolvedCount / newTotal) * 100);
  console.log("");
  console.log(`expected pool size after cleanup   ${newTotal}`);
  console.log(`expected category coverage         ${projectedCoverage}%  (resolved ${resolvedCount} / ${newTotal})`);

  // 5) Apply — soft archive only, verified-safe internal influencers only.
  if (apply && toArchive.length > 0) {
    console.log(`\nArchiving ${toArchive.length} influencers (status='archived')…`);
    const ids = toArchive
      .map((v) => candidates.find((c) => c.unified_id === v.unifiedId)?.influencer_id)
      .filter((id): id is string => Boolean(id));
    for (let i = 0; i < ids.length; i += 200) {
      const batch = ids.slice(i, i + 200);
      const { error } = await supabase
        .from("influencers")
        .update({ status: "archived" })
        .in("id", batch)
        .eq("status", "active");
      if (error) {
        console.error(`ARCHIVE FAILED at batch ${i / 200 + 1}: ${error.message}`);
        process.exit(1);
      }
      console.log(`  archived ${Math.min(i + 200, ids.length)}/${ids.length}`);
    }

    // Projection hygiene: the backfill upserts and never deletes, so archived
    // creators' rows must be removed here or the coverage denominator stays
    // stale. The projection is derived data — deletion is safe and rebuildable.
    const unifiedIds = toArchive.map((v) => v.unifiedId);
    for (let i = 0; i < unifiedIds.length; i += 200) {
      const batch = unifiedIds.slice(i, i + 200);
      const { error } = await supabase.from("creator_intelligence").delete().in("unified_id", batch);
      if (error) {
        console.error(`PROJECTION CLEANUP FAILED: ${error.message} — re-run backfill and preflight.`);
        process.exit(1);
      }
    }
    console.log(`  removed ${unifiedIds.length} projection rows`);
    console.log("\nDone. Re-run: npm run backfill:creator-intelligence && npm run rollout:preflight");
    console.log("Restore any creator with: update influencers set status='active' where id=…\n");
  } else if (!apply) {
    console.log("\n(dry-run — re-run with --apply to archive the verified-safe influencers)\n");
  }
}

main().catch((error) => {
  console.error("CLEANUP FAILED:", error);
  process.exit(1);
});
