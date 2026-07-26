/** Structured campaign facts — SSOT subset; see CampaignIntelligenceProfile for the full object. */

export type CampaignFactsSource = "brief" | "inferred" | "default";

export type CampaignFactsField =
  | "clientName"
  | "brandName"
  | "industry"
  | "campaignType"
  | "product"
  | "objective"
  | "budget"
  | "durationWeeks"
  | "campaignStartDate"
  | "geography"
  | "audience"
  | "platforms"
  | "kpis"
  | "deliverables"
  | "constraints"
  | "risks";

export type CampaignFacts = {
  clientName?: string;
  brandName?: string;
  industry?: string;
  campaignType?: string;
  product?: string;
  objective?: string;
  budget?: { amount: number; currency: string };
  durationWeeks?: number;
  /**
   * ISO calendar date (YYYY-MM-DD) for the user-requested first day of the campaign.
   * Alias of {@link requestedStartDate}; kept for backward compatibility.
   */
  campaignStartDate?: string;
  /**
   * ISO calendar date (YYYY-MM-DD) the user asked to start on.
   * May fall mid-week; the Publishing Calendar still anchors Week 1 to Monday.
   */
  requestedStartDate?: string;
  /**
   * ISO calendar date (YYYY-MM-DD) — Monday of Media Plan Week 1
   * (Monday on or after {@link requestedStartDate} / {@link campaignStartDate}).
   */
  scheduledStartDate?: string;
  geography?: string[];
  audience?: string;
  platforms?: string[];
  kpis?: string[];
  deliverables?: string[];
  constraints?: string[];
  risks?: string[];
  /** Non-authoritative excerpt for context only — never use for factual claims. */
  rawBriefExcerpt?: string;
  extractedAt: string;
  confidence: Partial<Record<CampaignFactsField, number>>;
  sources: Partial<Record<CampaignFactsField, CampaignFactsSource>>;
};

export type CampaignFactsExtractInput = {
  rawMessage: string;
  brandName?: string;
  clientName?: string;
};
