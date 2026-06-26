import { getAuthContext, hasPermission } from "@/lib/auth/permissions";
import { buildClientSelectOptions } from "@/lib/clients/client-select-options";
import { getBrandsForSelect, getClientsForSelect, getMasterDataOptions } from "@/lib/master-data/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, QuotationStatus, CommercialInputMode } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

import { isCommercialSyncEnabled } from "@/lib/commercial-sync/rules";

import { QUOTATION_PERMISSIONS } from "./constants";
import {
  isQuotationExpired,
  validDaysRemaining,
} from "./quotation-validity";
import type {
  QuotationDeliverable,
  QuotationDetail,
  QuotationFormOptions,
  PromoteWizardOptions,
  QuotationItemRow,
  QuotationListRow,
  QuotationRevisionRow,
} from "./types";

type Supabase = SupabaseClient<Database>;

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function aggregateReach(items: QuotationItemRow[]): number {
  return items.reduce((sum, item) => sum + (item.followers ?? 0), 0);
}

function aggregateEngagementRate(items: QuotationItemRow[]): number | null {
  const withEr = items.filter((i) => i.engagement_rate != null);
  if (!withEr.length) return null;
  const total = withEr.reduce((sum, i) => sum + Number(i.engagement_rate), 0);
  return total / withEr.length;
}

export async function getQuotationFormOptions(): Promise<QuotationFormOptions> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const [clients, brands, campaignsResult] = await Promise.all([
    getClientsForSelect(),
    getBrandsForSelect(),
    supabase
      .from("campaign_headers")
      .select("id, name, document_number")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  if (campaignsResult.error) throw new Error(campaignsResult.error.message);

  return {
    clients: buildClientSelectOptions(clients).map((c) => ({
      id: c.value,
      name: c.label,
      legal_name: c.description ?? null,
    })),
    brands: brands.map((b) => ({
      id: b.id,
      name: b.name,
      client_id: b.client_id,
    })),
    campaigns: ((campaignsResult.data ?? []) as Array<{
      id: string;
      name: string;
      document_number: string | null;
    }>) ?? [],
  };
}

export async function getPromoteWizardOptions(): Promise<PromoteWizardOptions> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const [groups, clients, brands, masterData, ownersResult] = await Promise.all([
    supabase.from("groups").select("id, name").order("name").limit(200),
    getClientsForSelect(),
    getBrandsForSelect(),
    getMasterDataOptions(),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
  ]);

  if (groups.error) throw new Error(groups.error.message);
  if (ownersResult.error) throw new Error(ownersResult.error.message);

  return {
    groups: ((groups.data ?? []) as Array<{ id: string; name: string }>) ?? [],
    clients: (clients ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      legal_name: c.legal_name,
      document_number: c.document_number,
    })),
    brands: (brands ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      client_id: b.client_id,
    })),
    categories: masterData.categories,
    subcategories: masterData.subcategories,
    owners: ((ownersResult.data ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string;
    }>) ?? [],
  };
}

export async function getQuotationsList(): Promise<QuotationListRow[]> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const { data, error } = await supabase
    .from("quotations")
    .select(
      `id, serial_number, name, status, shortlist_id, is_archived,
       total_cost_egp, total_revenue_egp, total_gp_value_egp, total_gp_pct,
       issue_date, validity_date, version,
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
      issue_date: (row.issue_date as string | null) ?? null,
      validity_date: (row.validity_date as string | null) ?? null,
      version: (row.version as string) ?? "v1.0",
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
    af_pct: Number(raw.af_pct ?? 0),
    af_value: Number(raw.af_value ?? 0),
    af_value_egp: Number(raw.af_value_egp ?? 0),
    sort_order: Number(raw.sort_order ?? 0),
  };
}

function mapRevision(raw: Record<string, unknown>): QuotationRevisionRow {
  return {
    id: raw.id as string,
    version: (raw.version as string) ?? "v1.0",
    updated_by_name: (raw.updated_by_name as string | null) ?? null,
    change_summary: (raw.change_summary as string | null) ?? null,
    created_at: raw.created_at as string,
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
       total_af_egp, total_agency_margin_egp,
       gp_target_pct, notes, terms, prepared_by_name, reviewed_by_name,
       client_signature_name, client_signed_at, client_visible, shared_with_client,
       issue_date, validity_date, version, department, change_summary,
       is_archived, created_at, updated_at,
       is_temporary_client, is_temporary_brand, temporary_client_name, temporary_brand_name,
       parent_quotation_id, version_number, revision_notes,
       clients:client_id(name, onboarding_status),
       brands:brand_id(name),
       campaign_headers:campaign_header_id(name, document_number),
       discovery_shortlists:shortlist_id(serial_number),
       owner:owner_id(full_name),
       quotation_items(*),
       quotation_revisions(id, version, updated_by_name, change_summary, created_at)`
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as Record<string, unknown>;
  const items = ((row.quotation_items as Record<string, unknown>[]) ?? [])
    .map(mapItem)
    .sort((a, b) => a.sort_order - b.sort_order);

  const revisions = ((row.quotation_revisions as Record<string, unknown>[]) ?? [])
    .map(mapRevision)
    .sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const validityDate = (row.validity_date as string | null) ?? null;
  const issueDate =
    (row.issue_date as string | null) ??
    (row.created_at as string).slice(0, 10);
  const status = row.status as QuotationStatus;
  const isTemporaryClient = Boolean(row.is_temporary_client);
  const isTemporaryBrand = Boolean(row.is_temporary_brand);
  const tempClientName = (row.temporary_client_name as string | null) ?? null;
  const tempBrandName = (row.temporary_brand_name as string | null) ?? null;
  const serialNumber = (row.serial_number as string | null) ?? null;
  const versionNumber = Number(row.version_number ?? 1);

  const baseSerial = serialNumber?.replace(/-V\d+$/, "") ?? "";
  let versionChain: import("./types").QuotationVersionSummary[] = [];
  if (baseSerial) {
    const { data: siblings } = await supabase
      .from("quotations")
      .select("id, serial_number, version_number, status")
      .ilike("serial_number", `${baseSerial}%`)
      .order("version_number", { ascending: true });
    versionChain = ((siblings ?? []) as Array<Record<string, unknown>>).map((s) => ({
      id: s.id as string,
      serial_number: (s.serial_number as string | null) ?? null,
      version_number: Number(s.version_number ?? 1),
      status: s.status as QuotationStatus,
    }));
  }

  return {
    id: row.id as string,
    serial_number: serialNumber,
    name: row.name as string,
    status,
    shortlist_id: (row.shortlist_id as string | null) ?? null,
    shortlist_serial:
      unwrap(row.discovery_shortlists as { serial_number: string | null } | null)
        ?.serial_number ?? null,
    client_id: (row.client_id as string | null) ?? null,
    client_name: isTemporaryClient
      ? tempClientName
      : unwrap(row.clients as { name: string } | null)?.name ?? null,
    client_onboarding_status: isTemporaryClient
      ? null
      : (unwrap(row.clients as { onboarding_status: string | null } | null)
          ?.onboarding_status as import("@/types/database").ClientOnboardingStatus | null) ??
        null,
    is_temporary_client: isTemporaryClient,
    is_temporary_brand: isTemporaryBrand,
    temporary_client_name: tempClientName,
    temporary_brand_name: tempBrandName,
    brand_id: (row.brand_id as string | null) ?? null,
    brand_name: isTemporaryBrand
      ? tempBrandName
      : unwrap(row.brands as { name: string } | null)?.name ?? null,
    campaign_header_id: (row.campaign_header_id as string | null) ?? null,
    campaign_name:
      unwrap(row.campaign_headers as { name: string } | null)?.name ?? null,
    campaign_document_number:
      unwrap(
        row.campaign_headers as { document_number: string | null } | null
      )?.document_number ?? null,
    parent_quotation_id: (row.parent_quotation_id as string | null) ?? null,
    version_number: versionNumber,
    revision_notes: (row.revision_notes as string | null) ?? null,
    sync_enabled: isCommercialSyncEnabled(status),
    version_chain: versionChain.length
      ? versionChain
      : [
          {
            id: row.id as string,
            serial_number: serialNumber,
            version_number: versionNumber,
            status,
          },
        ],
    owner_id: (row.owner_id as string | null) ?? null,
    owner_name: unwrap(row.owner as { full_name: string } | null)?.full_name ?? null,
    approved_by: (row.approved_by as string | null) ?? null,
    approved_at: (row.approved_at as string | null) ?? null,
    currency: (row.currency as string) ?? "EGP",
    total_cost_egp: Number(row.total_cost_egp ?? 0),
    total_revenue_egp: Number(row.total_revenue_egp ?? 0),
    total_gp_value_egp: Number(row.total_gp_value_egp ?? 0),
    total_gp_pct: Number(row.total_gp_pct ?? 0),
    total_af_egp: Number(row.total_af_egp ?? 0),
    total_agency_margin_egp: Number(row.total_agency_margin_egp ?? 0),
    gp_target_pct: Number(row.gp_target_pct ?? 25),
    notes: (row.notes as string | null) ?? null,
    terms: (row.terms as string | null) ?? null,
    prepared_by_name: (row.prepared_by_name as string | null) ?? null,
    reviewed_by_name: (row.reviewed_by_name as string | null) ?? null,
    client_signature_name: (row.client_signature_name as string | null) ?? null,
    client_signed_at: (row.client_signed_at as string | null) ?? null,
    issue_date: issueDate,
    validity_date: validityDate,
    version: (row.version as string) ?? "v1.0",
    department: (row.department as string | null) ?? null,
    change_summary: (row.change_summary as string | null) ?? null,
    shared_with_client: Boolean(row.shared_with_client ?? row.client_visible),
    client_visible: Boolean(row.client_visible),
    is_archived: Boolean(row.is_archived),
    is_expired: isQuotationExpired(validityDate),
    valid_days_remaining: validDaysRemaining(validityDate),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    items,
    revisions,
    canManage,
    estimated_reach: aggregateReach(items),
    estimated_engagement_rate: aggregateEngagementRate(items),
  };
}
