import type { SupabaseClient } from "@supabase/supabase-js";

import { REL } from "@/lib/supabase/relation-hints";

export type VendorDependencySummary = {
  assignments: number;
  campaigns: number;
  deliverables: number;
  invoices: number;
  billing_lines: number;
  payments: number;
  collections: number;
  approvals: number;
  audit_records: number;
  can_permanently_delete: boolean;
  can_archive: boolean;
  linked_assignments: VendorLinkedAssignment[];
};

export type VendorLinkedAssignment = {
  id: string;
  campaign_id: string;
  campaign_document_number: string;
  campaign_name: string;
  line_document_number: string | null;
  agreed_fee: number;
  currency: string;
  vendor_payment_status: string | null;
  billing_status: string | null;
};

export async function getVendorDependencies(
  supabase: SupabaseClient,
  influencerId: string
): Promise<VendorDependencySummary> {
  const { data: assignments, error: assignError } = await supabase
    .from("campaign_influencers")
    .select(
      `
      id, agreed_fee, currency, vendor_payment_status, campaign_line_id, campaign_header_id,
      campaign:${REL.campaignInfluencers.campaignHeader}(id, document_number, name),
      line:${REL.campaignInfluencers.campaignLine}(document_number, billing_status)
    `
    )
    .eq("influencer_id", influencerId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (assignError) {
    throw new Error(assignError.message);
  }

  const rows = assignments ?? [];
  const campaignIds = [
    ...new Set(
      rows
        .map((r) => {
          const raw = (r as { campaign: { id: string } | { id: string }[] | null })
            .campaign;
          const c = Array.isArray(raw) ? raw[0] : raw;
          return c?.id;
        })
        .filter(Boolean) as string[]
    ),
  ];

  const [
    deliverableCount,
    approvalCount,
    auditCount,
    invoiceCount,
    billingCount,
    paymentCount,
  ] = await Promise.all([
    supabase
      .from("deliverables")
      .select("id", { count: "exact", head: true })
      .eq("influencer_id", influencerId)
      .then((r) => {
        if (r.error) throw new Error(r.error.message);
        return r.count ?? 0;
      }),
    supabase
      .from("approvals")
      .select("id", { count: "exact", head: true })
      .eq("entity_type", "campaign_influencer")
      .in(
        "entity_id",
        rows.length > 0 ? rows.map((r) => (r as { id: string }).id) : ["00000000-0000-0000-0000-000000000000"]
      )
      .then((r) => {
        if (r.error) throw new Error(r.error.message);
        return rows.length > 0 ? r.count ?? 0 : 0;
      }),
    supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("entity_type", "influencers")
      .eq("entity_id", influencerId)
      .then((r) => {
        if (r.error) throw new Error(r.error.message);
        return r.count ?? 0;
      }),
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
    rows.length > 0
      ? supabase
          .from("campaign_lines")
          .select("id", { count: "exact", head: true })
          .in(
            "id",
            rows
              .map((r) => (r as { campaign_line_id: string | null }).campaign_line_id)
              .filter(Boolean) as string[]
          )
          .neq("billing_status", "draft")
          .then((r) => {
            if (r.error) throw new Error(r.error.message);
            return r.count ?? 0;
          })
      : Promise.resolve(0),
    supabase
      .from("campaign_influencers")
      .select("id", { count: "exact", head: true })
      .eq("influencer_id", influencerId)
      .in("vendor_payment_status", ["paid", "pending"])
      .then((r) => {
        if (r.error) throw new Error(r.error.message);
        return r.count ?? 0;
      }),
  ]);

  let collectionsCount = 0;
  if (campaignIds.length > 0) {
    const { data: invoiceRows } = await supabase
      .from("invoices")
      .select("id")
      .in("campaign_header_id", campaignIds);
    const invoiceIds = (invoiceRows ?? []).map((i) => (i as { id: string }).id);
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

  const linked_assignments: VendorLinkedAssignment[] = rows.map((row) => {
    const r = row as {
      id: string;
      agreed_fee: number;
      currency: string;
      vendor_payment_status: string | null;
      campaign: { id: string; document_number: string; name: string } | { id: string; document_number: string; name: string }[] | null;
      line: { document_number: string; billing_status: string } | { document_number: string; billing_status: string }[] | null;
    };
    const campaign = Array.isArray(r.campaign) ? r.campaign[0] : r.campaign;
    const line = Array.isArray(r.line) ? r.line[0] : r.line;
    return {
      id: r.id,
      campaign_id: campaign?.id ?? "",
      campaign_document_number: campaign?.document_number ?? "",
      campaign_name: campaign?.name ?? "Unknown",
      line_document_number: line?.document_number ?? null,
      agreed_fee: Number(r.agreed_fee),
      currency: r.currency,
      vendor_payment_status: r.vendor_payment_status,
      billing_status: line?.billing_status ?? null,
    };
  });

  const hasActivity =
    rows.length > 0 ||
    deliverableCount > 0 ||
    invoiceCount > 0 ||
    billingCount > 0 ||
    paymentCount > 0 ||
    collectionsCount > 0 ||
    approvalCount > 0;

  return {
    assignments: rows.length,
    campaigns: campaignIds.length,
    deliverables: deliverableCount,
    invoices: invoiceCount,
    billing_lines: billingCount,
    payments: paymentCount,
    collections: collectionsCount,
    approvals: approvalCount,
    audit_records: auditCount,
    can_permanently_delete: !hasActivity,
    can_archive: rows.length === 0,
    linked_assignments,
  };
}
