import { hashStable, stableStringify } from "@/lib/client-cache/keys";
import type { CampaignObject, CampaignStrategyBasis } from "@/features/campaign-intelligence/types/campaign-object";
import type { StrategyContext } from "@/features/campaign-intelligence-profile/services/campaign-understanding/build-strategy-context";

import type { CampaignStrategyDocument } from "../types";

export type StrategyBasisStatus = "CURRENT" | "STALE" | "BLOCKED" | "LEGACY_UNKNOWN" | "MISSING";

const EPHEMERAL_KEYS = new Set(["confirmedAt", "createdAt", "updatedAt", "generatedAt"]);

function canonicalizeContextValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(canonicalizeContextValue)
      .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !EPHEMERAL_KEYS.has(key))
        .map(([key, item]) => [key, canonicalizeContextValue(item)])
    );
  }
  return value;
}

/**
 * Stable identity for the bounded, deterministic StrategyContext. It ignores
 * timestamps and object/array ordering so it can safely detect material drift.
 */
export function fingerprintStrategyContext(context: StrategyContext): string {
  return `strategy-context:v1:${hashStable(canonicalizeContextValue(context))}`;
}

function readinessStatus(strategy: CampaignStrategyDocument): CampaignStrategyBasis["readiness"]["status"] {
  if (strategy.status === "blocked" || strategy.readiness?.strategy.status === "blocked") return "blocked";
  if (strategy.readiness?.strategy.status === "warning") return "warning";
  return "ready";
}

/** Build the compact provenance written with the exact Strategy document. */
export function buildStrategyBasis(strategy: CampaignStrategyDocument): CampaignStrategyBasis | undefined {
  const context = strategy.strategyContext;
  const understanding = strategy.campaignUnderstandingRef ?? context?.campaignUnderstandingRef;
  if (!context || !understanding) return undefined;

  return {
    schemaVersion: 1,
    campaignUnderstanding: {
      schemaVersion: understanding.schemaVersion,
      confirmationStatus: understanding.confirmationStatus,
      ...(understanding.confirmedAt ? { confirmedAt: understanding.confirmedAt } : {}),
      confirmedFactIdsFingerprint: `confirmed-facts:v1:${hashStable([...understanding.confirmedFactIds].sort())}`,
    },
    strategyContext: {
      schemaVersion: 1,
      fingerprint: fingerprintStrategyContext(context),
    },
    readiness: { status: readinessStatus(strategy) },
    generatedAt: strategy.createdAt,
  };
}

/**
 * Read-only validity check for a persisted Strategy. Legacy objects are never
 * backfilled; a missing current confirmed context makes a prior basis stale.
 */
export function resolveStrategyBasisStatus(
  campaignObject: Pick<CampaignObject, "meta">,
  currentStrategyContext?: StrategyContext
): StrategyBasisStatus {
  const pipeline = campaignObject.meta.directorPipeline;
  if (!pipeline?.strategyDocumentId) return "MISSING";
  if (!pipeline.strategyBasis) return "LEGACY_UNKNOWN";
  if (pipeline.strategyBasis.readiness.status === "blocked") return "BLOCKED";
  if (!currentStrategyContext) return "STALE";

  const currentUnderstanding = currentStrategyContext.campaignUnderstandingRef;
  const currentFactIdsFingerprint = `confirmed-facts:v1:${hashStable([...currentUnderstanding.confirmedFactIds].sort())}`;
  const currentContextFingerprint = fingerprintStrategyContext(currentStrategyContext);

  return pipeline.strategyBasis.campaignUnderstanding.schemaVersion === currentUnderstanding.schemaVersion &&
    pipeline.strategyBasis.campaignUnderstanding.confirmationStatus === currentUnderstanding.confirmationStatus &&
    pipeline.strategyBasis.campaignUnderstanding.confirmedFactIdsFingerprint === currentFactIdsFingerprint &&
    pipeline.strategyBasis.strategyContext.fingerprint === currentContextFingerprint
    ? "CURRENT"
    : "STALE";
}
