/** Shared quotation seed and import DTOs (features ↔ services). */

import type { CommercialInputMode } from "@/types/database";

export type QuotationDeliverableTypeLine = {
  type: string;
  /** Deliverable count for this post type (separate from pricing `quantity`). */
  quantity: number;
};

/** Commercial frozen snapshot of planned posting timing (distinct from operational live_date). */
export type QuotationTentativeScheduleSource = "campaign_plan" | "manual";

export type QuotationTentativeScheduleFields = {
  /** ISO date when a calendar anchor exists. */
  tentative_posting_date?: string | null;
  /** Planning label e.g. "Week 2 · Tuesday". */
  tentative_posting_label?: string | null;
  planned_week?: number | null;
  planned_day?: string | null;
  schedule_source?: QuotationTentativeScheduleSource | null;
};

export type QuotationDeliverable = {
  platform: string;
  /** Primary type (legacy); use `type_lines` for per-type units. */
  type: string;
  /** Selected post types (legacy multi-select). */
  types?: string[];
  /** Per-type scope lines — e.g. 1× IG Video + 2× IG Story on one price row. */
  type_lines?: QuotationDeliverableTypeLine[];
  /** Pricing units for cost calculation (+Cost detail); not deliverable counts. */
  quantity: number;
  /** Total client price for this post-type line (computed from cost details). */
  revenue?: number | null;
  /** When true, client price is intentionally zero (complimentary for the client). */
  free_for_client?: boolean | null;
  service_description?: string | null;
  commercial_input_mode?: CommercialInputMode;
  cost?: number | null;
  cost_currency?: string | null;
  gp_pct?: number | null;
  gp_value?: number | null;
  af_pct?: number | null;
} & QuotationTentativeScheduleFields;

export type QuotationMutationResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; message: string };

export type QuotationItemSeed = {
  influencer_id?: string | null;
  profile_id?: string | null;
  unified_id?: string | null;
  source_shortlist_item_id?: string | null;
  creator_name?: string | null;
  platform?: string | null;
  handle?: string | null;
  followers?: number | null;
  engagement_rate?: number | null;
  country_code?: string | null;
  deliverables?: QuotationDeliverable[];
  profile_image_url?: string | null;
  profile_url?: string | null;
  option_number?: number | null;
  service_description?: string | null;
  commercial_input_mode?: CommercialInputMode;
  cost?: number | null;
  cost_currency?: string | null;
  gp_pct?: number | null;
  revenue?: number | null;
  gp_value?: number | null;
  af_pct?: number | null;
  collapse_group_id?: string | null;
  collapse_label?: string | null;
};

export type ImportCreatorOption = {
  item_id: string;
  label: string;
  platform: string | null;
  followers: number | null;
};
