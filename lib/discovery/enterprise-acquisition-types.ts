import type { DiscoveryJobPayload, DiscoveryPlatform } from "@/lib/discovery/types";
import type { IntelligenceSufficiencyEvaluation } from "@/lib/discovery/intelligence-sufficiency";

/** BullMQ payload for enterprise dataset acquisition (Apify → import → DNA). */
export type EnterpriseAcquisitionJobData = {
  jobId: string;
  searchId: string;
  /** Client search session — acquisition aborts when session ends. */
  searchSessionId?: string | null;
  platform: DiscoveryPlatform;
  jobPayload: DiscoveryJobPayload;
  countryCode?: string | null;
  categoryTags?: string[];
  intelligence?: Pick<
    IntelligenceSufficiencyEvaluation,
    "acquisitionHints" | "intelligenceGaps" | "sufficiencyScore" | "sufficiencyLevel"
  >;
};
