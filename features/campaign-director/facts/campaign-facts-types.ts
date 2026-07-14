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
  /** ISO calendar date (YYYY-MM-DD) for the first day of the campaign. */
  campaignStartDate?: string;
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
