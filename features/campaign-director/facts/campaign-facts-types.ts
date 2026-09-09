/** Structured campaign facts — SSOT subset; see CampaignIntelligenceProfile for the full object. */

/**
 * Where a fact came from.
 * - `brief`    — explicitly stated in the source brief
 * - `inferred` — derived by the pipeline from brief content (assistive, not stated)
 * - `default`  — a documented system default, not tied to this brief
 * - `operator` — typed or picked by a human in Intake
 */
export type CampaignFactsSource = "brief" | "inferred" | "default" | "operator";

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
  | "campaignEndDate"
  | "geography"
  | "audience"
  | "platforms"
  | "kpis"
  | "deliverables"
  | "constraints"
  | "risks"
  | "creatorCategories"
  | "keyMessage"
  | "callToAction"
  | "campaignFunnel"
  | "toneOfVoice"
  | "contentFormats";

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
   * May fall mid-week; the Publishing Calendar includes that partial week.
   */
  requestedStartDate?: string;
  /**
   * ISO calendar date (YYYY-MM-DD) — Saturday that opens Publishing Calendar Week 1
   * (Saturday of the week containing {@link requestedStartDate} / {@link campaignStartDate}).
   */
  scheduledStartDate?: string;
  /**
   * ISO calendar date (YYYY-MM-DD) for the inclusive Campaign End Date.
   * When set, this is the absolute publishing window end (not merely derived from duration).
   */
  campaignEndDate?: string;
  geography?: string[];
  audience?: string;
  platforms?: string[];
  kpis?: string[];
  deliverables?: string[];
  constraints?: string[];
  risks?: string[];
  /**
   * Canonical creator categories resolved by the intelligence pipeline.
   * Campaign intent, NOT a Discovery filter — Discovery reads validatedIntelligence.
   */
  creatorCategories?: string[];
  /** Single-sentence brand message stated in the brief. */
  keyMessage?: string;
  /** Explicit call to action stated in the brief. */
  callToAction?: string;
  /** Campaign funnel stages, e.g. ["Awareness","Interest","Trial"]. Not KPIs. */
  campaignFunnel?: string[];
  /** Tone descriptors stated in the brief. */
  toneOfVoice?: string[];
  /** Content formats/styles stated in the brief. */
  contentFormats?: string[];
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
