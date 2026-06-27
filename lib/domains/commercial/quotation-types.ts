/** Shared quotation seed and import DTOs (features ↔ services). */

import type { CommercialInputMode } from "@/types/database";

export type QuotationDeliverable = {
  platform: string;
  type: string;
  quantity: number;
};

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
  commercial_input_mode?: CommercialInputMode;
  cost?: number | null;
  cost_currency?: string | null;
  gp_pct?: number | null;
  revenue?: number | null;
  gp_value?: number | null;
  af_pct?: number | null;
};

export type ImportCreatorOption = {
  item_id: string;
  label: string;
  platform: string | null;
  followers: number | null;
};
