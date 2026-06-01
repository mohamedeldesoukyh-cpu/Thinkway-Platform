import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMasterDataOptions } from "@/lib/master-data/queries";

import type {
  PoTrackerFilters,
  PoTrackerRow,
  PoTrackerSummary,
  PoTrackerWorkspaceData,
} from "./types";

type HeaderRow = {
  id: string;
  document_number: string;
  name: string;
  currency_code: string;
  start_date: string | null;
  end_date: string | null;
  account_manager_id: string | null;
  po_number: string | null;
  po_currency: string | null;
  po_exchange_rate: number | null;
  po_amount_original: number;
  po_amount_campaign_currency: number;
  po_consumed_amount: number;
  po_remaining_amount: number;
  po_remaining_percent: number | null;
  po_status: PoTrackerRow["po_status"];
  po_expiry_date: string | null;
  po_override_approved: boolean;
  fx_snapshot_at: string | null;
  brand: { id: string; name: string } | null;
  client: {
    id: string;
    name: string;
    country: string | null;
  } | null;
  group: { id: string; name: string } | null;
  account_manager: { id: string; full_name: string | null; email: string } | null;
};

function parseFilters(searchParams: Record<string, string | undefined>): PoTrackerFilters {
  return {
    group_id: searchParams.group_id,
    client_id: searchParams.client_id,
    brand_id: searchParams.brand_id,
    campaign_id: searchParams.campaign_id,
    country_code: searchParams.country_code,
    currency: searchParams.currency,
    po_status: searchParams.po_status as PoTrackerFilters["po_status"],
    over_consumed_only: searchParams.over_consumed === "1",
    expiring_soon: searchParams.expiring_soon === "1",
    account_manager_id: searchParams.account_manager_id,
    date_from: searchParams.date_from,
    date_to: searchParams.date_to,
  };
}

function isExpiringSoon(expiry: string | null): boolean {
  if (!expiry) return false;
  const expiryDate = new Date(`${expiry}T00:00:00`);
  const now = new Date();
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);
  return expiryDate >= now && expiryDate <= in30;
}

export async function getPoTrackerWorkspace(
  searchParams: Record<string, string | undefined> = {}
): Promise<PoTrackerWorkspaceData> {
  const supabase = await createSupabaseServerClient();
  const filters = parseFilters(searchParams);

  let query = supabase
    .from("campaign_headers")
    .select(
      `
      id, document_number, name, currency_code, start_date, end_date, account_manager_id,
      po_number, po_currency, po_exchange_rate,
      po_amount_original, po_amount_campaign_currency,
      po_consumed_amount, po_remaining_amount, po_remaining_percent,
      po_status, po_expiry_date, po_override_approved, fx_snapshot_at,
      brand:brands(id, name),
      client:clients(id, name, country),
      group:groups(id, name),
      account_manager:profiles!campaign_headers_account_manager_id_fkey(id, full_name, email)
    `
    )
    .order("document_number");

  if (filters.group_id) query = query.eq("group_id", filters.group_id);
  if (filters.client_id) query = query.eq("client_id", filters.client_id);
  if (filters.brand_id) query = query.eq("brand_id", filters.brand_id);
  if (filters.campaign_id) query = query.eq("id", filters.campaign_id);
  if (filters.currency) query = query.eq("po_currency", filters.currency);
  if (filters.po_status) query = query.eq("po_status", filters.po_status);
  if (filters.account_manager_id) {
    query = query.eq("account_manager_id", filters.account_manager_id);
  }
  if (filters.date_from) query = query.gte("start_date", filters.date_from);
  if (filters.date_to) query = query.lte("end_date", filters.date_to);

  const [{ data, error }, masterData, groupsRes, clientsRes, brandsRes, campaignsRes, managersRes] =
    await Promise.all([
      query,
      getMasterDataOptions(),
      supabase.from("groups").select("id, name").eq("status", "active").order("name"),
      supabase.from("clients").select("id, name, group_id").order("name"),
      supabase.from("brands").select("id, name, client_id").eq("status", "active").order("name"),
      supabase
        .from("campaign_headers")
        .select("id, name, brand_id")
        .order("document_number"),
      supabase.from("profiles").select("id, full_name, email").order("full_name"),
    ]);

  if (error) throw new Error(error.message);

  let rows: PoTrackerRow[] = ((data ?? []) as unknown as HeaderRow[]).map((row) => ({
    campaign_id: row.id,
    campaign_name: row.name,
    campaign_document_number: row.document_number,
    group_id: row.group?.id ?? "",
    group_name: row.group?.name ?? "—",
    client_id: row.client?.id ?? "",
    client_name: row.client?.name ?? "—",
    brand_id: row.brand?.id ?? "",
    brand_name: row.brand?.name ?? "—",
    country_code: row.client?.country ?? null,
    account_manager_id: row.account_manager_id,
    account_manager_name:
      row.account_manager?.full_name ?? row.account_manager?.email ?? null,
    campaign_currency: row.currency_code,
    po_number: row.po_number,
    po_currency: row.po_currency,
    po_exchange_rate: row.po_exchange_rate != null ? Number(row.po_exchange_rate) : null,
    po_amount_original: Number(row.po_amount_original ?? 0),
    po_amount_campaign_currency: Number(row.po_amount_campaign_currency ?? 0),
    po_consumed_amount: Number(row.po_consumed_amount ?? 0),
    po_remaining_amount: Number(row.po_remaining_amount ?? 0),
    po_remaining_percent:
      row.po_remaining_percent != null ? Number(row.po_remaining_percent) : null,
    po_status: row.po_status ?? "draft",
    po_expiry_date: row.po_expiry_date,
    po_override_approved: row.po_override_approved ?? false,
    fx_snapshot_at: row.fx_snapshot_at,
    is_over_consumed:
      Number(row.po_amount_campaign_currency ?? 0) > 0 &&
      Number(row.po_consumed_amount ?? 0) > Number(row.po_amount_campaign_currency ?? 0),
  }));

  if (filters.country_code) {
    rows = rows.filter(
      (row) =>
        row.country_code?.toUpperCase() === filters.country_code?.toUpperCase()
    );
  }

  if (filters.over_consumed_only) {
    rows = rows.filter((row) => row.is_over_consumed);
  }

  if (filters.expiring_soon) {
    rows = rows.filter((row) => isExpiringSoon(row.po_expiry_date));
  }

  const summary: PoTrackerSummary = {
    total_po_amount: rows.reduce((s, r) => s + r.po_amount_campaign_currency, 0),
    total_consumed: rows.reduce((s, r) => s + r.po_consumed_amount, 0),
    total_remaining: rows.reduce((s, r) => s + r.po_remaining_amount, 0),
    over_consumed_count: rows.filter((r) => r.is_over_consumed).length,
    near_limit_count: rows.filter((r) => r.po_status === "near_limit").length,
    expiring_soon_count: rows.filter((r) => isExpiringSoon(r.po_expiry_date)).length,
  };

  return {
    rows,
    summary,
    filter_options: {
      groups: groupsRes.data ?? [],
      clients: clientsRes.data ?? [],
      brands: brandsRes.data ?? [],
      campaigns: campaignsRes.data ?? [],
      currencies: masterData.currencies.map((c) => ({
        code: c.code,
        name: c.name,
      })),
      account_managers: managersRes.data ?? [],
    },
  };
}
