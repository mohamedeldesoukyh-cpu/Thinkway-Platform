"use server";

import { revalidatePath } from "next/cache";

import { METADATA_PLATFORM_KEY } from "@/features/campaigns/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { createCampaignSchema } from "./schemas";

export type CreateCampaignFormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  campaignId?: string;
};

function emptyToNull(value: string | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  return value.trim();
}

export async function createCampaignAction(
  _prevState: CreateCampaignFormState,
  formData: FormData
): Promise<CreateCampaignFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = createCampaignSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return { ok: false, message: authError.message };
  }

  if (!user) {
    return { ok: false, message: "You must be signed in to create campaigns." };
  }

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select(
      "id, client_id, group_id, category_id, subcategory_id, agency_or_direct, vr_rate_id, currency_code"
    )
    .eq("id", parsed.data.brand_id)
    .maybeSingle();

  if (brandError || !brand) {
    return { ok: false, message: brandError?.message ?? "Brand not found." };
  }

  const platform = emptyToNull(parsed.data.platform);
  const metadata = platform ? { [METADATA_PLATFORM_KEY]: platform } : {};

  const { data: header, error: headerError } = await supabase
    .from("campaign_headers")
    .insert({
      name: parsed.data.name,
      brand_id: brand.id,
      client_id: brand.client_id,
      group_id: brand.group_id,
      status: parsed.data.status,
      currency_code: parsed.data.currency_code || brand.currency_code,
      category_id: brand.category_id,
      subcategory_id: brand.subcategory_id,
      agency_or_direct: brand.agency_or_direct,
      vr_rate_id: brand.vr_rate_id,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      account_manager_id: emptyToNull(parsed.data.account_manager_id),
      metadata,
      created_by: user.id,
    })
    .select("id, document_number")
    .single();

  if (headerError) {
    return { ok: false, message: headerError.message };
  }

  const lineName =
    parsed.data.line_name?.trim() || `${parsed.data.name} — Line A`;
  const revenue = parsed.data.revenue ?? parsed.data.po_amount;
  const cost = parsed.data.cost ?? 0;

  const { error: lineError } = await supabase.from("campaign_lines").insert({
    campaign_header_id: header.id,
    name: lineName,
    status: parsed.data.status,
    platform,
    po_amount: parsed.data.po_amount,
    revenue,
    cost,
    currency_code: parsed.data.currency_code || brand.currency_code,
    base_currency: "USD",
    fx_rate: parsed.data.fx_rate,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    metadata,
    created_by: user.id,
  });

  if (lineError) {
    await supabase.from("campaign_headers").delete().eq("id", header.id);
    return { ok: false, message: lineError.message };
  }

  revalidatePath("/campaigns");
  revalidatePath(`/clients/${brand.client_id}`);

  return {
    ok: true,
    message: `Campaign ${header.document_number} created with line A.`,
    campaignId: header.id,
  };
}
