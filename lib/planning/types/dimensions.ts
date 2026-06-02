/** Hierarchy dimensions supported on budget / forecast lines. */
export type PlanningDimensionKey =
  | "country"
  | "client"
  | "brand"
  | "campaign"
  | "team"
  | "sales_owner"
  | "business_unit";

export type PlanningRollupLevel =
  | "campaign"
  | "client"
  | "brand"
  | "country"
  | "team"
  | "business_unit"
  | "global";

export type PlanningDimension = {
  country_code: string | null;
  client_id: string | null;
  brand_id: string | null;
  campaign_header_id: string | null;
  team_id: string | null;
  sales_owner_id: string | null;
  business_unit_id: string | null;
};

export const EMPTY_PLANNING_DIMENSION: PlanningDimension = {
  country_code: null,
  client_id: null,
  brand_id: null,
  campaign_header_id: null,
  team_id: null,
  sales_owner_id: null,
  business_unit_id: null,
};
