import type { SupabaseClient } from "@supabase/supabase-js";

import { REL } from "@/lib/supabase/relation-hints";

export async function fetchCampaignHeaderWithRelations(
  supabase: SupabaseClient,
  campaignId: string
) {
  return supabase
    .from("campaign_headers")
    .select(
      `
      *,
      brand:brands(id, name, document_number),
      client:clients(
        id, name, document_number, legal_name, country,
        group:groups(id, name, document_number)
      ),
      group:groups(id, name, document_number),
      team:md_teams(id, name),
      account_manager:profiles!campaign_headers_account_manager_id_fkey(id, full_name, email)
    `
    )
    .eq("id", campaignId)
    .maybeSingle();
}

export async function fetchCampaignLines(supabase: SupabaseClient, campaignId: string) {
  return supabase
    .from("campaign_lines")
    .select("*")
    .eq("campaign_header_id", campaignId)
    .order("document_number");
}

export async function fetchCampaignInfluencers(
  supabase: SupabaseClient,
  campaignId: string
) {
  return supabase
    .from("campaign_influencers")
    .select(
      `
        id, campaign_line_id, campaign_header_id, influencer_id, status, agreed_fee, currency,
        deliverable_count, invited_at, confirmed_at, vendor_payment_status,
        influencer:influencers(id, document_number, display_name),
        line:${REL.campaignInfluencers.campaignLine}(document_number)
      `
    )
    .eq("campaign_header_id", campaignId);
}

export async function fetchCampaignDeliverables(
  supabase: SupabaseClient,
  campaignId: string
) {
  return supabase
    .from("deliverables")
    .select(
      `
        id, document_number, deliverable_type, title, status, platform,
        due_date, submitted_at, approved_at, published_at, content_url, metrics,
        influencer:influencers(display_name)
      `
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
}

export async function fetchCampaignInvoices(supabase: SupabaseClient, campaignId: string) {
  return supabase
    .from("invoices")
    .select("*")
    .or(`campaign_header_id.eq.${campaignId},campaign_id.eq.${campaignId}`)
    .order("issue_date", { ascending: false });
}

export async function fetchCampaignApprovals(supabase: SupabaseClient, campaignId: string) {
  return supabase
    .from("approvals")
    .select(
      `
        id, document_number, entity_type, title, status, due_at, decided_at,
        assignee:profiles!approvals_assigned_to_fkey(full_name, email)
      `
    )
    .or(
      `and(entity_type.eq.campaign,entity_id.eq.${campaignId}),entity_type.eq.deliverable,entity_type.eq.campaign_influencer`
    )
    .order("created_at", { ascending: false })
    .limit(30);
}

export async function fetchCampaignAuditLogs(supabase: SupabaseClient, campaignId: string) {
  return supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, created_at, actor_id, new_data")
    .or(
      [
        `and(entity_type.eq.campaign_headers,entity_id.eq.${campaignId})`,
        `entity_type.eq.campaign_lines`,
        `entity_type.eq.campaign_influencers`,
        `entity_type.eq.deliverables`,
      ].join(",")
    )
    .order("created_at", { ascending: false })
    .limit(50);
}

export async function fetchInfluencerPlatformAccounts(
  supabase: SupabaseClient,
  influencerIds: string[]
) {
  const { data: accounts } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "influencer_id, platform, handle, profile_url, follower_count, engagement_rate"
    )
    .in("influencer_id", influencerIds);
  return accounts ?? [];
}

export async function fetchPaymentsForInvoiceIds(
  supabase: SupabaseClient,
  invoiceIds: string[],
  invoiceDocMap: Map<string, string>
) {
  const { data: paymentRows } = await supabase
    .from("payments")
    .select("id, document_number, invoice_id, amount, currency, status, paid_at")
    .in("invoice_id", invoiceIds)
    .order("created_at", { ascending: false });

  return (paymentRows ?? []).map((p) => {
    const row = p as {
      id: string;
      document_number: string;
      invoice_id: string;
      amount: number;
      currency: string;
      status: string;
      paid_at: string | null;
    };
    return {
      id: row.id,
      document_number: row.document_number,
      invoice_document_number: invoiceDocMap.get(row.invoice_id) ?? "",
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      paid_at: row.paid_at,
    };
  });
}

export async function fetchProfileNamesByIds(
  supabase: SupabaseClient,
  actorIds: string[]
) {
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", actorIds);
  return new Map((profileRows ?? []).map((p) => [p.id, p]));
}
