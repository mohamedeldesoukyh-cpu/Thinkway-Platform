import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreatorEnrichmentFeature } from "@/lib/creator-enrichment/enrichment-feature";
import type {
  EnrichmentPriority,
  EnrichmentScope,
  EnrichmentTrigger,
} from "@/lib/creator-enrichment/types";
import type { Database } from "@/types/database";

/** Orchestrator operation under evaluation. */
export type DecisionOperation = "refresh" | "enqueue" | "execute" | "batch";

/**
 * Rule opinion — individual rule recommendation.
 * Phase 2.3: FreshnessRule may return `proceed` or `skip`.
 */
export type RuleOpinion = "no_opinion" | "proceed" | "skip" | "defer" | "already_running";

/** Outcome returned by the decision engine. */
export type DecisionOutcome = "proceed" | "skip" | "already_running";

export type RuleEvaluation = {
  ruleId: string;
  priority: number;
  opinion: RuleOpinion;
  reason?: string;
  executionTimeMs: number;
};

export type DecisionContextFields = {
  requestId: string;
  feature: CreatorEnrichmentFeature;
  trigger: EnrichmentTrigger;
  priority: EnrichmentPriority;
  creatorId: string | null;
  platformAccountId: string | null;
  force: boolean;
  scope: EnrichmentScope;
  requestedBy: string | null;
  timestamp: string;
  operation: DecisionOperation;
  delegatedTo: string;
  /** Caller-supplied client when available; snapshot provider may fall back to admin. */
  supabase: SupabaseClient<Database> | null;
};
