import type { SupabaseClient } from "@supabase/supabase-js";

export type EntityDependencySummary = {
  campaigns: number;
  invoices: number;
  collections: number;
  approvals: number;
  audit_records: number;
  billing_lines: number;
  can_permanently_delete: boolean;
  linked_campaigns: LinkedCampaignSummary[];
};

export type LinkedCampaignSummary = {
  id: string;
  document_number: string;
  name: string;
  status: string;
  revenue: number;
  gp: number;
};

export type EntityType = "group" | "client" | "brand";

async function countExact(
  supabase: SupabaseClient,
  table: string,
  column: string,
  value: string
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

async function getCampaignIdsForEntity(
  supabase: SupabaseClient,
  entityType: EntityType,
  entityId: string
): Promise<string[]> {
  const column =
    entityType === "group"
      ? "group_id"
      : entityType === "client"
        ? "client_id"
        : "brand_id";

  const { data, error } = await supabase
    .from("campaign_headers")
    .select("id")
    .eq(column, entityId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((r) => (r as { id: string }).id);
}

export async function getEntityDependencies(
  supabase: SupabaseClient,
  entityType: EntityType,
  entityId: string
): Promise<EntityDependencySummary> {
  const campaignIds = await getCampaignIdsForEntity(
    supabase,
    entityType,
    entityId
  );

  const column =
    entityType === "group"
      ? "group_id"
      : entityType === "client"
        ? "client_id"
        : "brand_id";

  const [campaignCount, invoiceCount, approvalCount, auditCount, billingCount] =
    await Promise.all([
      countExact(supabase, "campaign_headers", column, entityId),
      campaignIds.length > 0
        ? supabase
            .from("invoices")
            .select("id", { count: "exact", head: true })
            .in("campaign_header_id", campaignIds)
            .then((r) => {
              if (r.error) throw new Error(r.error.message);
              return r.count ?? 0;
            })
        : Promise.resolve(0),
      campaignIds.length > 0
        ? supabase
            .from("approvals")
            .select("id", { count: "exact", head: true })
            .eq("entity_type", "campaign")
            .in("entity_id", campaignIds)
            .then((r) => {
              if (r.error) throw new Error(r.error.message);
              return r.count ?? 0;
            })
        : Promise.resolve(0),
      supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("entity_type", entityType === "client" ? "clients" : `${entityType}s`)
        .eq("entity_id", entityId)
        .then((r) => {
          if (r.error) throw new Error(r.error.message);
          return r.count ?? 0;
        }),
      campaignIds.length > 0
        ? supabase
            .from("campaign_lines")
            .select("id", { count: "exact", head: true })
            .in("campaign_header_id", campaignIds)
            .neq("billing_status", "draft")
            .then((r) => {
              if (r.error) throw new Error(r.error.message);
              return r.count ?? 0;
            })
        : Promise.resolve(0),
    ]);

  let collectionsCount = 0;
  if (campaignIds.length > 0) {
    const { data: invoiceRows } = await supabase
      .from("invoices")
      .select("id")
      .in("campaign_header_id", campaignIds);

    const invoiceIds = (invoiceRows ?? []).map((r) => (r as { id: string }).id);
    if (invoiceIds.length > 0) {
      collectionsCount = await supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .in("invoice_id", invoiceIds)
        .then((r) => {
          if (r.error) throw new Error(r.error.message);
          return r.count ?? 0;
        });
    }
  }

  const { data: linkedCampaigns } = await supabase
    .from("campaign_headers")
    .select(
      `
      id, document_number, name, status,
      lines:campaign_lines(revenue, profit)
    `
    )
    .eq(column, entityId)
    .order("created_at", { ascending: false })
    .limit(20);

  const linked_campaigns: LinkedCampaignSummary[] = (linkedCampaigns ?? []).map(
    (row) => {
      const c = row as {
        id: string;
        document_number: string;
        name: string;
        status: string;
        lines: { revenue: number; profit: number }[];
      };
      const revenue = c.lines.reduce((s, l) => s + Number(l.revenue), 0);
      const gp = c.lines.reduce((s, l) => s + Number(l.profit), 0);
      return {
        id: c.id,
        document_number: c.document_number,
        name: c.name,
        status: c.status,
        revenue,
        gp,
      };
    }
  );

  const hasActivity =
    campaignCount > 0 ||
    invoiceCount > 0 ||
    collectionsCount > 0 ||
    approvalCount > 0 ||
    billingCount > 0;

  return {
    campaigns: campaignCount,
    invoices: invoiceCount,
    collections: collectionsCount,
    approvals: approvalCount,
    audit_records: auditCount,
    billing_lines: billingCount,
    can_permanently_delete: !hasActivity,
    linked_campaigns,
  };
}
