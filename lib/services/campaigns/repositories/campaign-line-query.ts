import type { SupabaseClient } from "@supabase/supabase-js";
import { parseLineAssignment } from "@/lib/campaigns/line-assignment";

export async function fetchCampaignLineById(
  supabase: SupabaseClient,
  lineId: string,
  campaignId: string
) {
  const result = await supabase
    .from("campaign_lines")
    .select(
      "start_date, end_date, revenue_locked, cost_locked, revenue, cost, revenue_before_vat, cost_before_vat, vat_locked, document_number, finance_override_until, vendor_io_id, vendor_assignment_locked, metadata, operational_status, invoice_id, source_quotation_item_id, agency_fee_percent, agency_fee_amount, usage_rights_amount, usage_rights_cost, currency_code, fx_rate, revenue_vat_percent, cost_vat_percent, revenue_vat_exempt, cost_vat_exempt"
    )
    .eq("id", lineId)
    .neq("status", "cancelled")
    .eq("campaign_header_id", campaignId)
    .maybeSingle();

  if (result.error || !result.data) return result;
  const metadataId = parseLineAssignment(result.data.metadata)?.influencer_id;
  if (metadataId) return {...result, data: {...result.data, influencer_id: metadataId}};
  const link = await supabase.from("campaign_influencers")
    .select("influencer_id")
    .eq("campaign_line_id", lineId)
    .eq("campaign_header_id", campaignId)
    .not("influencer_id", "is", null)
    .limit(1).maybeSingle();
  if (link.error) return {...result, data: null, error: link.error};
  return {...result, data: {...result.data, influencer_id: link.data?.influencer_id ?? null}};
}
