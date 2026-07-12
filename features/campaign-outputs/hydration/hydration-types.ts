/**
 * Smart Hydration — types.
 *
 * Every business object (Quotation, Shortlist, Discovery selection, Brief,
 * existing Campaign, Manual wizard) can become a Campaign Object. A source is
 * first normalized into a `CampaignSeed`; hydration then fills a Campaign Object
 * from the seed WITHOUT overwriting anything already validated, and reports
 * exactly what is still missing. The Campaign Object remains the SSOT; nothing
 * here duplicates campaign data — it maps existing data into the SSOT shape.
 */

export type HydrationSourceKind =
  | "campaign_brief"
  | "creator_shortlist"
  | "quotation"
  | "discovery_selection"
  | "existing_campaign"
  | "crm_campaign"
  | "manual_wizard";

/** One creator as a source knows it — mapped into the slate on hydration. */
export type SeedCreator = {
  creatorId: string;
  displayName: string;
  tier?: string;
  platform?: string;
  followers?: number;
  engagementRate?: number;
  categories?: string[];
  country?: string;
  brandFit?: number;
  aiScore?: number;
};

/** Source-agnostic normalized campaign inputs. Only fields the source knows are set. */
export type CampaignSeed = {
  source: HydrationSourceKind;
  campaignName?: string;
  client?: string;
  brand?: string;
  budget?: { amount: number; currency: string };
  market?: string[];
  platforms?: string[];
  deliverables?: string[];
  objective?: string;
  audience?: string;
  durationWeeks?: number;
  kpis?: string[];
  categories?: string[];
  creators: SeedCreator[];
};

/** A campaign-input requirement and whether the Campaign Object satisfies it. */
export type HydrationField =
  | "client"
  | "brand"
  | "objective"
  | "audience"
  | "market"
  | "platforms"
  | "budget"
  | "durationWeeks"
  | "creators"
  | "deliverables"
  | "kpis";

export type MissingInformation = {
  known: HydrationField[];
  missing: HydrationField[];
  /** Human labels for the missing fields, e.g. "Campaign objective". */
  missingLabels: string[];
};

export type HydrationResult = {
  campaignObject: import("@/features/campaign-intelligence").CampaignObject;
  /** What the hydration filled vs left untouched (already validated). */
  hydratedFields: HydrationField[];
  preservedFields: HydrationField[];
  missing: MissingInformation;
};
