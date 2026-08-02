export type { EvidenceCoverage, EvidenceBasedOn } from "@/lib/enterprise-creator-intelligence/shared/types";

export {
  audienceEvidenceCoverage,
  buildEvidenceCoverage,
  categoryBrandEvidenceCoverage,
  clampConfidenceToEvidence,
  clampPercent,
  commercialEvidenceCoverage,
  historicalEvidenceCoverage,
  investmentEvidenceCoverage,
  performanceEvidenceCoverage,
} from "@/lib/enterprise-creator-intelligence/shared/evidence-coverage";

export {
  createEciFactsCache,
  type EciCacheKind,
  type EciFactsCache,
  type EciFactsCacheStats,
} from "@/lib/enterprise-creator-intelligence/shared/facts-cache";
