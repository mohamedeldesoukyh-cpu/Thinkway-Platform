/**
 * Discovery pipeline diagnostic — read-only end-to-end trace for a Campaign Plan.
 *
 *   npx tsx scripts/trace-discovery.ts <conversationId> [--query="..."]
 *   npm run trace:discovery -- <conversationId>
 *
 * Loads the campaign object for a conversation, reconstructs the Studio search
 * filters from its facts (reusing the REAL filter builder), runs the actual
 * Discovery browse (reusing the REAL browse + coverage/backfill pipeline), and
 * prints the full funnel with the FIRST LOSS POINT. It also prints the persisted
 * ground truth (latest discovery_coverage_decisions row) and the stored
 * campaign-object slate state, so a fresh run and the real Studio run can be
 * compared.
 *
 * READ-ONLY: no mutations, no fixes, no business-logic changes. It only reads and
 * reuses existing functions. Requires NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY in .env (same as other scripts).
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- diagnostic script: untyped service client + defensive reads */
import "./trace-discovery-enable";

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { loadCampaignObjectForConversation } from "@/features/campaign-intelligence/services/campaign-object-store";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { searchCreatorsInputToBrowseFilters } from "@/features/ai/tools/search-creators-browse";
import type { SearchCreatorsInput } from "@/features/ai/tools/schemas";
import { browseUnifiedCreatorsWithCoverageBackfill } from "@/lib/discovery/coverage-backfill-orchestrator";
import { getDiscoveryControlSettings } from "@/lib/discovery/control-center/discovery-control-service";
import { resolveCountryCode } from "@/lib/creators/country-code";
import { resolveBrowseCategories } from "@/lib/creators/category-filter";

config({ path: ".env" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey?.startsWith("eyJ")) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or valid SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}) as any;

// --- helpers -----------------------------------------------------------------

const line = (label: string, value: unknown) =>
  console.log(`  ${label.padEnd(22)} ${format(value)}`);
const header = (title: string) => console.log(`\n${"─".repeat(64)}\n${title}\n${"─".repeat(64)}`);
const arrow = () => console.log("        ↓");

function format(value: unknown): string {
  if (value == null) return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "(none)";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function argFlag(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
}

// --- capture the existing traceCountDrop funnel (read-only, no logic change) --

type DropEvent = { stage: string; filter: string; before: number; after: number };
const drops: DropEvent[] = [];

function installTraceCapture() {
  const orig = { info: console.info, warn: console.warn };
  const capture = (fallback: (...a: unknown[]) => void) => (...args: unknown[]) => {
    const msg = args[0];
    if (typeof msg === "string" && msg.includes("[search-trace:")) {
      const data = args[1] as { filter?: string; countBefore?: number; countAfter?: number } | undefined;
      if (data && typeof data.countBefore === "number" && typeof data.countAfter === "number") {
        const stage = msg
          .replace(/^\[search-trace:[^\]]*\]\s*/, "")
          .replace(/^COUNT_DROP @ /, "")
          .trim();
        drops.push({ stage, filter: data.filter ?? "", before: data.countBefore, after: data.countAfter });
      }
      return; // suppress the raw trace line — we print a structured funnel instead
    }
    fallback(...args);
  };
  console.info = capture(orig.info) as typeof console.info;
  console.warn = capture(orig.warn) as typeof console.warn;
  return () => {
    console.info = orig.info;
    console.warn = orig.warn;
  };
}

// --- main --------------------------------------------------------------------

async function main() {
  const conversationId = process.argv[2];
  if (!conversationId || conversationId.startsWith("--")) {
    console.error("Usage: npx tsx scripts/trace-discovery.ts <conversationId> [--query=\"...\"]");
    process.exit(1);
  }

  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║  DISCOVERY PIPELINE TRACE — conversation ${conversationId.slice(0, 18)}…`);
  console.log(`╚══════════════════════════════════════════════════════════════╝`);

  // 1) Campaign object + facts ------------------------------------------------
  const campaignObject = await loadCampaignObjectForConversation(supabase, conversationId);
  if (!campaignObject) {
    console.error(`\nNo campaign object found for conversation ${conversationId}.`);
    process.exit(1);
  }
  const facts = getCampaignFacts(campaignObject);
  const creatorsData = (campaignObject.sections?.creators?.data ?? {}) as Record<string, any>;
  const storedRecs: string[] = creatorsData?.recommendations?.creatorIds ?? [];
  const storedDiscovery: string[] = creatorsData?.discovery?.creatorIds ?? [];
  const reasoning: Array<{ expectedRole?: string }> = creatorsData?.recommendations?.selectedReasoning ?? [];
  const tierMix: Record<string, number> = {};
  for (const r of reasoning) {
    const t = r.expectedRole?.trim() || "Unclassified";
    tierMix[t] = (tierMix[t] ?? 0) + 1;
  }

  header("CAMPAIGN FACTS");
  line("client", facts?.clientName);
  line("brand", facts?.brandName);
  line("country / geography", facts?.geography);
  line("platforms", facts?.platforms);
  line("audience", facts?.audience);
  line("budget", facts?.budget ? `${facts.budget.amount} ${facts.budget.currency}` : null);
  line("objective", facts?.objective);
  line("kpis", facts?.kpis);
  line("creator mix (stored)", Object.entries(tierMix).map(([t, n]) => `${n} ${t}`));
  line("strategy?", typeof campaignObject.sections?.strategy?.content === "string" && campaignObject.sections.strategy.content.trim() ? "present" : "empty");

  // 2) Discovery query / filters (reconstructed via the REAL builder) ---------
  const query =
    argFlag("--query") ??
    facts?.rawBriefExcerpt ??
    [facts?.brandName, facts?.objective, facts?.audience, facts?.geography?.join(" "), facts?.platforms?.join(" ")]
      .filter(Boolean)
      .join(". ");

  const input = {
    query,
    country: facts?.geography?.[0],
    platforms: facts?.platforms,
    limit: 50,
  } as SearchCreatorsInput;

  const filters = searchCreatorsInputToBrowseFilters(input);
  const resolvedCategories = resolveBrowseCategories(filters);

  header("DISCOVERY QUERY (reconstructed from facts)");
  line("query", query?.slice(0, 100));
  line("original country", facts?.geography?.[0]);
  line("normalized country", resolveCountryCode(facts?.geography?.[0]));
  line("filters.country", filters.country);
  line("platform / platforms", filters.platforms ?? filters.platform);
  line("filters.categories", filters.categories);
  line("resolved categories", resolvedCategories);
  line("followers", `${filters.minFollowers ?? "—"} … ${filters.maxFollowers ?? "—"}`);

  // 3) Discovery control settings --------------------------------------------
  let settings: any;
  try {
    settings = await getDiscoveryControlSettings(supabase);
    header("DISCOVERY CONTROL SETTINGS");
    line("discoverySource", settings.discoverySource);
    line("searchPriority", settings.searchPriority);
    line("coverageThreshold", settings.coverageThreshold);
    line("automaticEnrichment", settings.automaticEnrichment);
    line("costProtection", settings.costProtection);
  } catch (e) {
    header("DISCOVERY CONTROL SETTINGS");
    console.log("  (failed to load:", (e as Error).message, ")");
  }

  // 4) Run the REAL browse + coverage/backfill (funnel captured) --------------
  header("DISCOVERY FUNNEL (fresh browse)");
  const restore = installTraceCapture();
  let result: any = null;
  let browseError: Error | null = null;
  try {
    result = await browseUnifiedCreatorsWithCoverageBackfill(
      supabase,
      { ...filters, page: 1 } as any,
      "discovery"
    );
  } catch (e) {
    browseError = e as Error;
  } finally {
    restore();
  }

  if (browseError) {
    console.log("  browse threw:", browseError.message);
  }

  const freshCount = result?.creators?.length ?? 0;
  const rpcStage = drops.find((d) => d.stage.startsWith("5_") || d.stage.includes("rpc"));
  console.log(`  RPC / search returned:  ${rpcStage ? rpcStage.before : "(see stages)"}`);
  if (drops.length === 0) {
    console.log("  (no traceCountDrop events captured — run with AI_SEARCH_TRACE=1, or npm run trace:discovery)");
  }
  for (const d of drops) {
    const removed = d.before - d.after;
    const flag = d.before > 0 && d.after === 0 ? "  ⟵ ZEROED" : "";
    console.log(`    ${d.stage.padEnd(26)} ${d.filter.padEnd(20)} ${String(d.before).padStart(5)} → ${String(d.after).padStart(5)}  (−${removed})${flag}`);
  }
  arrow();
  console.log(`  FINAL candidate pool:   ${freshCount}`);
  if (result?.coverage) {
    line("coverage level", result.coverage.coverageLevel);
    line("coverage score", result.coverage.coverageScore);
  }
  if (result?.backfill) {
    line("backfill executed", result.backfill.executed);
    line("backfill reason", result.backfill.reason);
    line("profiles added", result.backfill.profilesAdded);
  } else {
    line("backfill", "not triggered");
  }

  // 5) Persisted ground truth — latest coverage decision ----------------------
  header("LATEST discovery_coverage_decisions ROW (real Studio run)");
  try {
    const { data: decision } = await supabase
      .from("discovery_coverage_decisions")
      .select("database_creators_count, coverage_score, coverage_level, apify_executed, reason, duration_ms, search_query, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (decision) {
      line("created_at", decision.created_at);
      line("db creators count", decision.database_creators_count);
      line("coverage level", decision.coverage_level);
      line("coverage score", decision.coverage_score);
      line("apify executed", decision.apify_executed);
      line("reason", decision.reason);
      line("search_query", decision.search_query);
    } else {
      console.log("  (no rows)");
    }
  } catch (e) {
    console.log("  (failed to query:", (e as Error).message, ")");
  }

  // 6) Stored campaign-object slate state -------------------------------------
  header("STORED SLATE STATE (what the real Studio run produced)");
  line("discovery.creatorIds", storedDiscovery.length);
  line("recommendations.creatorIds", storedRecs.length);
  line("slateProposalStatus", creatorsData?.slateProposalStatus);
  line("pendingProposal", creatorsData?.pendingProposal?.status ?? "—");
  line("phase", creatorsData?.phase);

  // 7) FIRST LOSS POINT -------------------------------------------------------
  header("FIRST LOSS POINT");
  const firstDrop = drops.find((d) => d.before > 0 && d.after === 0);
  if (freshCount === 0) {
    if (firstDrop) {
      console.log(`  Stage:   ${firstDrop.stage} (${firstDrop.filter})`);
      console.log(`  Before:  ${firstDrop.before} creators`);
      console.log(`  After:   ${firstDrop.after} creators`);
      console.log(`  Reason:  the "${firstDrop.filter}" filter removed all candidates.`);
    } else if (rpcStage && rpcStage.before === 0) {
      console.log(`  Stage:   ${rpcStage.stage} (RPC / SQL WHERE clause)`);
      console.log(`  Reason:  the database query returned 0 rows before any post-filter.`);
    } else {
      console.log(`  Stage:   Database / RPC search`);
      console.log(`  Reason:  Discovery returned 0 candidates. Backfill executed=${result?.backfill?.executed ?? false}` +
        ` (reason: ${result?.backfill?.reason ?? "n/a"}). If backfill was skipped, check coverageThreshold above.`);
    }
  } else if (storedDiscovery.length === 0) {
    console.log(`  Stage:   Studio search → persistence`);
    console.log(`  Fresh Discovery returns ${freshCount}, but the campaign object's discovery.creatorIds is EMPTY.`);
    console.log(`  Reason:  the Studio search did not run/complete or its results were not persisted.`);
  } else if (storedRecs.length === 0) {
    console.log(`  Stage:   proposeInitialCreatorSlate()`);
    console.log(`  discovery.creatorIds=${storedDiscovery.length} but recommendations.creatorIds is EMPTY.`);
    console.log(`  Reason:  the proposal stage did not commit (status: ${creatorsData?.slateProposalStatus ?? "?"}).`);
  } else {
    console.log(`  No loss detected in data: Discovery=${freshCount}, discovery.creatorIds=${storedDiscovery.length}, recommendations.creatorIds=${storedRecs.length}.`);
    console.log(`  If the UI still shows no cards, the loss is in rendering/hydration (Vendor Recommendations).`);
  }

  console.log("");
}

main().catch((e) => {
  console.error("\nTRACE FAILED:", e);
  process.exit(1);
});
