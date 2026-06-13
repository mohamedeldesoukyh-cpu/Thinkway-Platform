export type InfluencerSpendFact = {
  influencer_id: string;
  influencer_name: string;
  document_number: string;
  client_id: string;
  period_month: string | null;
  spending: number;
  revenue: number;
  ur_rev: number;
  agency_fees: number;
  gp: number;
  gp_after_vr: number;
  currency_code: string;
};
