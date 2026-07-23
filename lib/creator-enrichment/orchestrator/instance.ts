/**
 * Default adapter wiring for {@link CreatorEnrichmentOrchestrator}.
 *
 * Only this module should import `*Impl` functions directly.
 * All product features must use the public API layer instead.
 */
import { enqueueCreatorEnrichmentImpl } from "@/lib/creator-enrichment/queue-impl";
import {
  executeCreatorMetricsRefreshImpl,
  refreshCreatorMetricsBatchByUnifiedIdsImpl,
  refreshCreatorMetricsImpl,
} from "@/lib/services/creators/creator-enrichment-service-impl";

import {
  CreatorEnrichmentOrchestrator,
  type CreatorEnrichmentOrchestratorAdapters,
} from "./creator-enrichment-orchestrator";

export function createDefaultOrchestratorAdapters(): CreatorEnrichmentOrchestratorAdapters {
  return {
    refreshCreatorMetrics: refreshCreatorMetricsImpl,
    enqueueCreatorEnrichment: enqueueCreatorEnrichmentImpl,
    executeCreatorMetricsRefresh: executeCreatorMetricsRefreshImpl,
    refreshCreatorMetricsBatchByUnifiedIds: refreshCreatorMetricsBatchByUnifiedIdsImpl,
  };
}

export function createCreatorEnrichmentOrchestrator(
  adapters: CreatorEnrichmentOrchestratorAdapters = createDefaultOrchestratorAdapters()
): CreatorEnrichmentOrchestrator {
  return new CreatorEnrichmentOrchestrator(adapters);
}

let singleton: CreatorEnrichmentOrchestrator | null = null;

/** Shared orchestrator instance wired to existing enrichment implementations. */
export function getCreatorEnrichmentOrchestrator(): CreatorEnrichmentOrchestrator {
  if (!singleton) {
    singleton = createCreatorEnrichmentOrchestrator();
  }
  return singleton;
}

/** Test helper — reset singleton between tests. */
export function resetCreatorEnrichmentOrchestratorForTests(): void {
  singleton = null;
}
