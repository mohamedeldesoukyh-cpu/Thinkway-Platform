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

export async function fetchCampaignApprovals(
  supabase: SupabaseClient,
  campaignId: string,
  scope: {
    vendorIds: string[];
    deliverableIds: string[];
  }
) {
  const select = `
        id, document_number, entity_type, title, status, due_at, decided_at,
        assignee:profiles!approvals_assigned_to_fkey(full_name, email)
      `;

  const requests = [
    supabase
      .from("approvals")
      .select(select)
      .eq("entity_type", "campaign")
      .eq("entity_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(30),
  ];

  if (scope.deliverableIds.length > 0) {
    requests.push(
      supabase
        .from("approvals")
        .select(select)
        .eq("entity_type", "deliverable")
        .in("entity_id", scope.deliverableIds)
        .order("created_at", { ascending: false })
        .limit(30)
    );
  }

  if (scope.vendorIds.length > 0) {
    requests.push(
      supabase
        .from("approvals")
        .select(select)
        .eq("entity_type", "campaign_influencer")
        .in("entity_id", scope.vendorIds)
        .order("created_at", { ascending: false })
        .limit(30)
    );
  }

  const results = await Promise.all(requests);
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const merged = results.flatMap((result) => result.data ?? []);
  merged.sort((a, b) => {
    const aCreated = (a as { created_at?: string }).created_at ?? "";
    const bCreated = (b as { created_at?: string }).created_at ?? "";
    return bCreated.localeCompare(aCreated);
  });

  return { data: merged.slice(0, 30), error: null };
}

export async function fetchCampaignAuditLogs(
  supabase: SupabaseClient,
  campaignId: string,
  scope: {
    lineIds: string[];
    vendorIds: string[];
    deliverableIds: string[];
  }
) {
  const select = "id, action, entity_type, entity_id, created_at, actor_id, new_data";

  const requests = [
    supabase
      .from("audit_logs")
      .select(select)
      .eq("entity_type", "campaign_headers")
      .eq("entity_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(50),
  ];

  if (scope.lineIds.length > 0) {
    requests.push(
      supabase
        .from("audit_logs")
        .select(select)
        .eq("entity_type", "campaign_lines")
        .in("entity_id", scope.lineIds)
        .order("created_at", { ascending: false })
        .limit(50)
    );
  }

  if (scope.vendorIds.length > 0) {
    requests.push(
      supabase
        .from("audit_logs")
        .select(select)
        .eq("entity_type", "campaign_influencers")
        .in("entity_id", scope.vendorIds)
        .order("created_at", { ascending: false })
        .limit(50)
    );
  }

  if (scope.deliverableIds.length > 0) {
    requests.push(
      supabase
        .from("audit_logs")
        .select(select)
        .eq("entity_type", "deliverables")
        .in("entity_id", scope.deliverableIds)
        .order("created_at", { ascending: false })
        .limit(50)
    );
  }

  const results = await Promise.all(requests);
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const merged = results.flatMap((result) => result.data ?? []);
  merged.sort((a, b) => {
    const aCreated = (a as { created_at: string }).created_at;
    const bCreated = (b as { created_at: string }).created_at;
    return bCreated.localeCompare(aCreated);
  });

  return { data: merged.slice(0, 50), error: null };
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
