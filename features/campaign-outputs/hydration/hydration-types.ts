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
  /** Client revenue from quotation / commercial line when known. */
  quotedRevenue?: number;
  quotedCurrency?: string;
  platform?: string;
  handle?: string;
  avatarUrl?: string;
  profileUrl?: string;
  /** Individual quotation ad types (e.g. ["1× IG Reel", "1× Mirrored TT"]). */
  serviceTypes?: string[];
  /** Summary label when multiple types exist (joined for display elsewhere). */
  serviceLabel?: string;
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
  group?: string;
  /** When `agency`, `agencyName` (or `client`) is shown on client-facing outputs. */
  agencyOrDirect?: "agency" | "direct" | "hybrid";
  agencyName?: string;
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
