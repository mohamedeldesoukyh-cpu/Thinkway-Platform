import type { SupabaseClient } from "@supabase/supabase-js";

export type VatRateRow = {
  id: string;
  country_code: string;
  vat_name: string;
  vat_rate: number;
  is_default: boolean;
  effective_from: string;
  effective_to: string | null;
};

function normalizeCountryCode(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim().toUpperCase().slice(0, 2);
}

export async function resolveVatRateForCountry(
  supabase: SupabaseClient,
  countryCode: string | null | undefined,
  asOf = new Date()
): Promise<number> {
  const code = normalizeCountryCode(countryCode);
  if (!code) return 0;

  const asOfDate = asOf.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("md_vat_rates")
    .select("vat_rate, is_default, effective_from")
    .eq("country_code", code)
    .lte("effective_from", asOfDate)
    .or(`effective_to.is.null,effective_to.gte.${asOfDate}`)
    .order("is_default", { ascending: false })
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Number(data?.vat_rate ?? 0);
}

export async function resolveClientBillingVatRate(
  supabase: SupabaseClient,
  clientId: string,
  asOf = new Date()
): Promise<{ countryCode: string | null; vatRate: number }> {
  const { data: client, error } = await supabase
    .from("clients")
    .select("country")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const countryCode = normalizeCountryCode(client?.country ?? null);
  const vatRate = await resolveVatRateForCountry(supabase, countryCode, asOf);

  return { countryCode, vatRate };
}

export async function resolveCampaignBillingVatRate(
  supabase: SupabaseClient,
  campaignId: string,
  asOf = new Date()
): Promise<{ countryCode: string | null; vatRate: number; clientId: string | null }> {
  const { data: header, error } = await supabase
    .from("campaign_headers")
    .select("client_id")
    .eq("id", campaignId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!header?.client_id) {
    return { countryCode: null, vatRate: 0, clientId: null };
  }

  return resolveClientBillingVatRate(supabase, header.client_id, asOf).then(
    (result) => ({
      ...result,
      clientId: header.client_id,
    })
  );
}

export function resolveVendorDefaultVatPercent(input: {
  vatRegistered: boolean;
  defaultVatPercent: number;
  countryCode?: string | null;
  countryVatRate?: number;
}): number {
  if (!input.vatRegistered) return 0;
  if (input.defaultVatPercent > 0) return input.defaultVatPercent;
  return input.countryVatRate ?? 0;
}

export async function listVatRates(
  supabase: SupabaseClient
): Promise<VatRateRow[]> {
  const { data, error } = await supabase
    .from("md_vat_rates")
    .select(
      "id, country_code, vat_name, vat_rate, is_default, effective_from, effective_to"
    )
    .order("country_code")
    .order("effective_from", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    country_code: row.country_code,
    vat_name: row.vat_name,
    vat_rate: Number(row.vat_rate),
    is_default: row.is_default,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
  }));
}
