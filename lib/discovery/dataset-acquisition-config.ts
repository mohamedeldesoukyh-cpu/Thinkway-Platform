import type { IntelligenceSufficiencyEvaluation } from "@/lib/discovery/intelligence-sufficiency";

const DEFAULT_BROADEN_MAX_CREATORS = 70;
const DEFAULT_STANDARD_MAX_CREATORS = 50;

/**
 * Max creators to import per dataset acquisition run.
 * Override via DATASET_ACQUISITION_MAX_CREATORS (default broaden cap: 25).
 */
export function resolveDatasetAcquisitionMaxCreators(
  intelligence?: IntelligenceSufficiencyEvaluation
): number {
  const envRaw = process.env.DATASET_ACQUISITION_MAX_CREATORS?.trim();
  if (envRaw) {
    const parsed = Number(envRaw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  if (intelligence?.acquisitionHints.broadenCreatorDiscovery) {
    return DEFAULT_BROADEN_MAX_CREATORS;
  }

  return DEFAULT_STANDARD_MAX_CREATORS;
}
