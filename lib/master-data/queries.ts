import type { PostgrestError } from "@supabase/supabase-js";

import {
  CLIENT_TAXONOMY_COLUMN_NAMES,
  getMissingClientColumnFromSchemaError,
  isMissingClientColumnSchemaError,
} from "@/lib/clients/classification-audit-columns";
import {
  fetchClientsForSelectWithOptionalVrRate,
  fetchVrRatesByIds,
  vrRatePercentFromMap,
} from "@/lib/clients/vr-rate-lookup";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MasterDataOptions = {
  categories: { id: string; code: string; name: string }[];
  subcategories: {
    id: string;
    category_id: string;
    code: string;
    name: string;
  }[];
  currencies: { code: string; name: string; symbol: string | null }[];
  countries: { code: string; name: string }[];
  teams: { id: string; code: string; name: string }[];
  reportTypes: { id: string; code: string; name: string }[];
  paymentTerms: { id: string; code: string; name: string; days_due: number | null }[];
  vrRates: { id: string; code: string; name: string; rate_percent: number }[];
};

export type BrandHierarchySnapshot = {
  brand_id: string;
  brand_name: string;
  group_id: string;
  group_name: string;
  client_id: string;
  client_name: string;
  client_legal_name: string | null;
  category_id: string | null;
  category_name: string | null;
  subcategory_id: string | null;
  subcategory_name: string | null;
  agency_or_direct: string | null;
  vr_rate_id: string | null;
  vr_rate_percent: number | null;
  currency_code: string;
};

export async function getMasterDataOptions(): Promise<MasterDataOptions> {
  const supabase = await createSupabaseServerClient();

  const [
    categories,
    subcategories,
    currencies,
    countries,
    teams,
    reportTypes,
    paymentTerms,
    vrRates,
  ] = await Promise.all([
    supabase.from("md_categories").select("id, code, name").eq("is_active", true).order("sort_order"),
    supabase.from("md_subcategories").select("id, category_id, code, name").eq("is_active", true).order("sort_order"),
    supabase.from("md_currencies").select("code, name, symbol").eq("is_active", true).order("code"),
    supabase.from("md_countries").select("code, name").eq("is_active", true).order("name"),
    supabase.from("md_teams").select("id, code, name").eq("is_active", true).order("name"),
    supabase.from("md_report_types").select("id, code, name").eq("is_active", true).order("name"),
    supabase.from("md_payment_terms").select("id, code, name, days_due").eq("is_active", true).order("days_due"),
    supabase.from("md_vr_rates").select("id, code, name, rate_percent").eq("is_active", true).order("rate_percent"),
  ]);

  const firstError =
    categories.error ??
    subcategories.error ??
    currencies.error ??
    countries.error ??
    teams.error ??
    reportTypes.error ??
    paymentTerms.error ??
    vrRates.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  return {
    categories: categories.data ?? [],
    subcategories: subcategories.data ?? [],
    currencies: currencies.data ?? [],
    countries: countries.data ?? [],
    teams: teams.data ?? [],
    reportTypes: reportTypes.data ?? [],
    paymentTerms: paymentTerms.data ?? [],
    vrRates: vrRates.data ?? [],
  };
}

export async function getBrandHierarchySnapshot(
  brandId: string
): Promise<BrandHierarchySnapshot | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("brands")
    .select(
      `
      id,
      name,
      group_id,
      client_id,
      category_id,
      subcategory_id,
      vr_rate_id,
      currency_code,
      group:groups(id, name),
      client:clients(id, name, legal_name, agency_or_direct),
      category:md_categories(id, name),
      subcategory:md_subcategories(id, name),
      vr_rate:md_vr_rates(id, rate_percent)
    `
    )
    .eq("id", brandId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as {
    id: string;
    name: string;
    group_id: string;
    client_id: string;
    category_id: string | null;
    subcategory_id: string | null;
    agency_or_direct: string | null;
    vr_rate_id: string | null;
    currency_code: string;
    group: { id: string; name: string } | null;
    client: { id: string; name: string; legal_name: string | null } | null;
    category: { id: string; name: string } | null;
    subcategory: { id: string; name: string } | null;
    vr_rate: { id: string; rate_percent: number } | null;
  };

  return {
    brand_id: row.id,
    brand_name: row.name,
    group_id: row.group_id,
    group_name: row.group?.name ?? "",
    client_id: row.client_id,
    client_name: row.client?.name ?? "",
    client_legal_name: row.client?.legal_name ?? null,
    category_id: row.category_id,
    category_name: row.category?.name ?? null,
    subcategory_id: row.subcategory_id,
    subcategory_name: row.subcategory?.name ?? null,
    agency_or_direct: (row.client as { agency_or_direct: string | null } | null)?.agency_or_direct ?? null,
    vr_rate_id: row.vr_rate_id,
    vr_rate_percent: row.vr_rate?.rate_percent ?? null,
    currency_code: row.currency_code,
  };
}

export async function getBrandsForSelect(clientId?: string) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("brands")
    .select("id, name, client_id, group_id, currency_code")
    .eq("status", "active")
    .order("name");

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

const BRAND_CAMPAIGN_FORM_CLIENT_CORE =
  "id, name, legal_name, agency_or_direct";

const BRAND_CAMPAIGN_FORM_CLIENT_WITH_TAXONOMY = `${BRAND_CAMPAIGN_FORM_CLIENT_CORE}, client_category, client_subcategory`;

function buildBrandCampaignFormSelect(clientFields: string): string {
  return `
      id,
      name,
      client_id,
      group_id,
      currency_code,
      category:md_categories(id, name),
      subcategory:md_subcategories(id, name),
      vr_rate:md_vr_rates(id, name, rate_percent),
      group:groups(id, name),
      client:clients(${clientFields})
    `;
}

type BrandCampaignFormClient = {
  id: string;
  name: string;
  legal_name: string | null;
  agency_or_direct: string | null;
  client_category?: string | null;
  client_subcategory?: string | null;
};

function normalizeBrandCampaignFormClient(
  client: BrandCampaignFormClient | null,
  strippedTaxonomy: boolean
): BrandCampaignFormClient | null {
  if (!client) {
    return null;
  }

  if (strippedTaxonomy) {
    return {
      id: client.id,
      name: client.name,
      legal_name: client.legal_name,
      agency_or_direct: client.agency_or_direct,
      client_category: null,
      client_subcategory: null,
    };
  }

  return {
    ...client,
    client_category: client.client_category ?? null,
    client_subcategory: client.client_subcategory ?? null,
  };
}

async function queryBrandsForCampaignForm(
  clientFields: string
): Promise<{
  data: Record<string, unknown>[] | null;
  error: PostgrestError | null;
}> {
  const supabase = await createSupabaseServerClient();
  return supabase
    .from("brands")
    .select(buildBrandCampaignFormSelect(clientFields))
    .eq("status", "active")
    .order("name");
}

export async function getBrandsForCampaignForm() {
  let clientFields = BRAND_CAMPAIGN_FORM_CLIENT_WITH_TAXONOMY;
  let strippedTaxonomy = false;

  let result = await queryBrandsForCampaignForm(clientFields);

  if (result.error && isMissingClientColumnSchemaError(result.error)) {
    const missingColumn = getMissingClientColumnFromSchemaError(result.error);
    if (
      missingColumn &&
      (CLIENT_TAXONOMY_COLUMN_NAMES as readonly string[]).includes(missingColumn)
    ) {
      console.warn(
        `[brands] ${missingColumn} column missing while loading campaign form brands; retrying without client taxonomy:`,
        result.error.message
      );
      clientFields = BRAND_CAMPAIGN_FORM_CLIENT_CORE;
      strippedTaxonomy = true;
      result = await queryBrandsForCampaignForm(clientFields);
    }
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data ?? []).map((row) => {
    const brand = row as Record<string, unknown> & {
      client: BrandCampaignFormClient | null;
    };
    return {
      ...brand,
      client: normalizeBrandCampaignFormClient(brand.client, strippedTaxonomy),
    };
  });
}

export async function getGroupsForSelect() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, document_number")
    .eq("status", "active")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function getClientsForSelect(groupId?: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await fetchClientsForSelectWithOptionalVrRate(
    supabase,
    groupId
  );
  if (error) {
    throw new Error(error.message);
  }

  const vrRateMap = await fetchVrRatesByIds(
    supabase,
    (data ?? []).map((row) => row.vr_rate_id)
  );

  return (data ?? []).map((row) => {
    const client = row as typeof row & {
      vr_rate_id: string | null;
    };
    return {
      id: client.id as string,
      name: client.name as string,
      legal_name: client.legal_name as string | null,
      group_id: client.group_id as string | null,
      document_number: client.document_number as string,
      status: client.status as string,
      vr_rate_id: client.vr_rate_id,
      vr_rate_percent: vrRatePercentFromMap(vrRateMap, client.vr_rate_id),
    };
  });
}

export async function getUnlinkedClientsForSelect() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, legal_name, document_number")
    .is("group_id", null)
    .neq("status", "archived")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function getAgenciesForSelect() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agencies")
    .select("id, name, document_number")
    .eq("status", "active")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}
