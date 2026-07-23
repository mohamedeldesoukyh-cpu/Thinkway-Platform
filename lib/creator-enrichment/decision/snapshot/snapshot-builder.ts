import type { CreatorEnrichmentDecisionContext } from "@/lib/creator-enrichment/decision/decision-context";

import {
  freezeSnapshot,
  getDefaultSnapshotProvider,
  type CreatorIntelligenceSnapshotProvider,
} from "./snapshot-provider";
import type { CreatorIntelligenceSnapshot } from "./snapshot-types";

/**
 * Builds an immutable {@link CreatorIntelligenceSnapshot} for a decision request.
 *
 * Merges request-scoped identifiers from context with provider intelligence.
 * Phase 2.2: provider reads existing platform data; context supplies creatorId when known.
 */
export async function buildCreatorIntelligenceSnapshot(
  context: CreatorEnrichmentDecisionContext,
  provider: CreatorIntelligenceSnapshotProvider = getDefaultSnapshotProvider()
): Promise<CreatorIntelligenceSnapshot> {
  const provided = await provider.provide(context);

  return freezeSnapshot({
    ...provided,
    creatorId: context.creatorId ?? provided.creatorId,
    influencerId: context.creatorId ?? provided.influencerId,
    platformAccountId: context.platformAccountId ?? provided.platformAccountId,
    metadata: {
      ...provided.metadata,
      requestId: context.requestId,
      operation: context.operation,
      feature: context.feature,
      trigger: context.trigger,
    },
  });
}
