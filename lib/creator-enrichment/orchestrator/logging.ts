import type { EnrichmentTrigger } from "@/lib/creator-enrichment/types";
import type { CreatorEnrichmentFeature } from "@/lib/creator-enrichment/enrichment-feature";

export type OrchestratorLogEvent =
  | "request_received"
  | "delegated"
  | "completed"
  | "failed";

/** Core fields present on every orchestrator log line for correlation. */
export type OrchestratorLogCore = {
  requestId: string;
  feature: CreatorEnrichmentFeature;
  trigger: EnrichmentTrigger;
  delegatedTo?: string;
  duration?: number;
};

export function logOrchestratorEvent(
  event: OrchestratorLogEvent,
  core: OrchestratorLogCore,
  extra: Record<string, unknown> = {}
): void {
  console.log(
    `[creator-enrichment:orchestrator] ${event}`,
    JSON.stringify({ ...core, ...extra })
  );
}

/** Admission log for Decision Engine gate (batch + single-path diagnostics). */
export function logEnrichmentAdmission(input: {
  creatorId: string;
  decision: string;
  reason: string;
  force: boolean;
  source: string;
}): void {
  console.log(
    "[enrichment-admission]",
    JSON.stringify({
      creatorId: input.creatorId,
      decision: input.decision,
      reason: input.reason,
      force: input.force,
      source: input.source,
    })
  );
}
