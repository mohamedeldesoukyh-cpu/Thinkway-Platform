import type { SupabaseClient } from "@supabase/supabase-js";

import type { DiscoveryCoverageEvaluation } from "@/lib/creators/discovery-coverage";

export type DiscoveryCoverageAuditInput = {
  searchId: string;
  searchQuery: Record<string, unknown>;
  coverage: DiscoveryCoverageEvaluation;
  databaseCreatorsCount: number;
  apifyExecuted: boolean;
  reason: string;
  durationMs: number;
};

function isMissingRelationError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("does not exist") &&
    (lower.includes("discovery_coverage_decisions") ||
      lower.includes("relation") ||
      lower.includes("schema cache"))
  );
}

export async function writeDiscoveryCoverageDecision(
  supabase: SupabaseClient,
  input: DiscoveryCoverageAuditInput
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const { error } = await supabase.from("discovery_coverage_decisions").insert({
    search_id: input.searchId,
    search_query: input.searchQuery,
    coverage_score: input.coverage.coverageScore,
    coverage_level: input.coverage.coverageLevel,
    database_creators_count: input.databaseCreatorsCount,
    apify_executed: input.apifyExecuted,
    reason: input.reason,
    duration_ms: input.durationMs,
  } as never);

  if (error) {
    if (isMissingRelationError(error.message)) {
      console.warn(
        "[discovery-coverage] audit table not migrated — skipping write:",
        error.message
      );
      return { ok: true, skipped: true };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
