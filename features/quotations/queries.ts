import { getAuthContext, hasPermission } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, QuotationStatus, CommercialInputMode } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

import { QUOTATION_PERMISSIONS } from "./constants";
import type {
  QuotationDeliverable,
  QuotationDetail,
  QuotationItemRow,
  QuotationListRow,
} from "./types";

type Supabase = SupabaseClient<Database>;

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getQuotationsList(): Promise<QuotationListRow[]> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const { data, error } = await supabase
    .from("quotations")
    .select(
      `id, serial_number, name, status, shortlist_id, is_archived,
       total_cost_egp, total_revenue_egp, total_gp_value_egp, total_gp_pct,
       created_at, updated_at,
       clients:client_id(name),
       brands:brand_id(name),
       campaign_headers:campaign_header_id(name),
       quotation_items(count)`
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const itemsAgg = row.quotation_items as Array<{ count: number }> | undefined;
    return {
      id: row.id as string,
      serial_number: (row.serial_number as string | null) ?? null,
      name: row.name as string,
      status: row.status as QuotationStatus,
      client_name: unwrap(row.clients as { name: string } | null)?.name ?? null,
      brand_name: unwrap(row.brands as { name: string } | null)?.name ?? null,
      campaign_name:
        unwrap(row.campaign_headers as { name: string } | null)?.name ?? null,
      shortlist_id: (row.shortlist_id as string | null) ?? null,
      total_cost_egp: Number(row.total_cost_egp ?? 0),
      total_revenue_egp: Number(row.total_revenue_egp ?? 0),
      total_gp_value_egp: Number(row.total_gp_value_egp ?? 0),
      total_gp_pct: Number(row.total_gp_pct ?? 0),
      item_count: itemsAgg?.[0]?.count ?? 0,
      is_archived: Boolean(row.is_archived),
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  });
}

function mapItem(raw: Record<string, unknown>): QuotationItemRow {
  return {
    id: raw.id as string,
    influencer_id: (raw.influencer_id as string | null) ?? null,
    profile_id: (raw.profile_id as string | null) ?? null,
    unified_id: (raw.unified_id as string | null) ?? null,
    source_shortlist_item_id: (raw.source_shortlist_item_id as string | null) ?? null,
    creator_name: (raw.creator_name as string | null) ?? null,
    platform: (raw.platform as string | null) ?? null,
    handle: (raw.handle as string | null) ?? null,
    followers: raw.followers != null ? Number(raw.followers) : null,
    engagement_rate: raw.engagement_rate != null ? Number(raw.engagement_rate) : null,
    country_code: (raw.country_code as string | null) ?? null,
    deliverables: Array.isArray(raw.deliverables)
      ? (raw.deliverables as QuotationDeliverable[])
      : [],
    commercial_input_mode: (raw.commercial_input_mode as CommercialInputMode) ?? "cost_gp_pct",
    cost: Number(raw.cost ?? 0),
    cost_currency: (raw.cost_currency as string) ?? "EGP",
    revenue: Number(raw.revenue ?? 0),
    gp_pct: Number(raw.gp_pct ?? 0),
    gp_value: Number(raw.gp_value ?? 0),
    fx_rate_to_egp: Number(raw.fx_rate_to_egp ?? 1),
    cost_egp: Number(raw.cost_egp ?? 0),
    revenue_egp: Number(raw.revenue_egp ?? 0),
    gp_value_egp: Number(raw.gp_value_egp ?? 0),
    sort_order: Number(raw.sort_order ?? 0),
  };
}

export async function getQuotationDetail(
  id: string
): Promise<QuotationDetail | null> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const ctx = await getAuthContext(supabase);
  const canManage =
    ctx.roleSlug === "admin" ||
    ctx.roleSlug === "super_admin" ||
    (await hasPermission(supabase, QUOTATION_PERMISSIONS.write));

  const { data, error } = await supabase
    .from("quotations")
    .select(
      `id, serial_number, name, status, shortlist_id, client_id, brand_id,
       campaign_header_id, owner_id, approved_by, approved_at, currency,
       total_cost_egp, total_revenue_egp, total_gp_value_egp, total_gp_pct,
       notes, terms, prepared_by_name, client_signature_name, client_visible,
       is_archived, created_at, updated_at,
       clients:client_id(name),
       brands:brand_id(name),
       campaign_headers:campaign_header_id(name),
       owner:owner_id(full_name),
       quotation_items(*)`
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as Record<string, unknown>;
  const items = ((row.quotation_items as Record<string, unknown>[]) ?? [])
    .map(mapItem)
    .sort((a, b) => a.sort_order - b.sort_order);

  return {
    id: row.id as string,
    serial_number: (row.serial_number as string | null) ?? null,
    name: row.name as string,
    status: row.status as QuotationStatus,
    shortlist_id: (row.shortlist_id as string | null) ?? null,
    client_id: (row.client_id as string | null) ?? null,
    client_name: unwrap(row.clients as { name: string } | null)?.name ?? null,
    brand_id: (row.brand_id as string | null) ?? null,
    brand_name: unwrap(row.brands as { name: string } | null)?.name ?? null,
    campaign_header_id: (row.campaign_header_id as string | null) ?? null,
    campaign_name:
      unwrap(row.campaign_headers as { name: string } | null)?.name ?? null,
    owner_id: (row.owner_id as string | null) ?? null,
    owner_name: unwrap(row.owner as { full_name: string } | null)?.full_name ?? null,
    approved_by: (row.approved_by as string | null) ?? null,
    approved_at: (row.approved_at as string | null) ?? null,
    currency: (row.currency as string) ?? "EGP",
    total_cost_egp: Number(row.total_cost_egp ?? 0),
    total_revenue_egp: Number(row.total_revenue_egp ?? 0),
    total_gp_value_egp: Number(row.total_gp_value_egp ?? 0),
    total_gp_pct: Number(row.total_gp_pct ?? 0),
    notes: (row.notes as string | null) ?? null,
    terms: (row.terms as string | null) ?? null,
    prepared_by_name: (row.prepared_by_name as string | null) ?? null,
    client_signature_name: (row.client_signature_name as string | null) ?? null,
    client_visible: Boolean(row.client_visible),
    is_archived: Boolean(row.is_archived),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    items,
    canManage,
  };
}
