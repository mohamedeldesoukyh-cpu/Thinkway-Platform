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
      agency_or_direct,
      vr_rate_id,
      currency_code,
      group:groups(id, name),
      client:clients(id, name, legal_name),
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

  const row = data as {
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
    agency_or_direct: row.agency_or_direct,
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

export async function getBrandsForCampaignForm() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("brands")
    .select(
      `
      id,
      name,
      client_id,
      group_id,
      currency_code,
      agency_or_direct,
      category:md_categories(id, name),
      subcategory:md_subcategories(id, name),
      vr_rate:md_vr_rates(id, name, rate_percent),
      group:groups(id, name),
      client:clients(id, name, legal_name)
    `
    )
    .eq("status", "active")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
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
  let query = supabase
    .from("clients")
    .select("id, name, legal_name, group_id, document_number")
    .order("name");

  if (groupId) {
    query = query.eq("group_id", groupId);
  }

  const { data, error } = await query;
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
