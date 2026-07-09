export type DiscoverySourceMode =
  | "platform_database_only"
  | "apify_live_only"
  | "hybrid";

export type SearchPriorityMode = "database_first" | "apify_first";

export type AutomaticEnrichmentMode =
  | "never"
  | "shortlisted"
  | "before_proposal"
  | "always";

export type DataFreshnessDays = 7 | 30 | 90 | null;

export type DiscoveryDnaPolicy = {
  generateAfterImport: boolean;
  updateAfterEnrichment: boolean;
  calculateCompleteness: boolean;
};

export type DiscoveryCostProtection = {
  maxRequestsPerDay: number;
  maxCreditsPerDay: number;
  confirmBeforeExceed: boolean;
};

export type DiscoveryControlSettings = {
  discoverySource: DiscoverySourceMode;
  searchPriority: SearchPriorityMode;
  coverageThreshold: number;
  automaticEnrichment: AutomaticEnrichmentMode;
  dnaPolicy: DiscoveryDnaPolicy;
  dataFreshnessDays: DataFreshnessDays;
  costProtection: DiscoveryCostProtection;
};

export type DiscoveryApifyDailyUsage = {
  usageDate: string;
  requestCount: number;
  creditsUsed: number;
};

export const DISCOVERY_CONTROL_SETTINGS_ID = "default" as const;
