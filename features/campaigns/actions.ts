"use server";

import { revalidatePath } from "next/cache";

import {
  METADATA_PLATFORM_KEY,
} from "@/features/campaigns/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CampaignStatus } from "@/types/database";

import {
  assignCampaignVendorSchema,
  createCampaignLineSchema,
  createCampaignSchema,
  createDeliverableSchema,
  updateCampaignHeaderSchema,
  updateCampaignLineSchema,
  updateCampaignVendorSchema,
  updateDeliverableStatusSchema,
} from "./schemas";

export type FormActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  campaignId?: string;
};

export type CreateCampaignFormState = FormActionState;

function emptyToNull(value: string | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  return value.trim();
}

function revalidateCampaign(campaignId: string, clientId?: string) {
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
  if (clientId) {
    revalidatePath(`/clients/${clientId}`);
  }
}

async function requireAuthUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null, error: error?.message ?? "Unauthorized" };
  }
  return { supabase, user, error: null };
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

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
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

  revalidateCampaign(header.id, brand.client_id);

  return {
    ok: true,
    message: `Campaign ${header.document_number} created with line A.`,
    campaignId: header.id,
  };
}

export async function updateCampaignHeaderAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updateCampaignHeaderSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const platform = emptyToNull(parsed.data.platform);
  const { data: existing } = await supabase
    .from("campaign_headers")
    .select("metadata, client_id")
    .eq("id", parsed.data.campaign_id)
    .maybeSingle();

  const metadata = {
    ...((existing?.metadata as Record<string, unknown>) ?? {}),
    ...(platform ? { [METADATA_PLATFORM_KEY]: platform } : {}),
  };

  const { error } = await supabase
    .from("campaign_headers")
    .update({
      name: parsed.data.name,
      description: emptyToNull(parsed.data.description),
      brief: emptyToNull(parsed.data.brief),
      status: parsed.data.status,
      currency_code: parsed.data.currency_code,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      account_manager_id: emptyToNull(parsed.data.account_manager_id),
      team_id: emptyToNull(parsed.data.team_id),
      metadata,
    })
    .eq("id", parsed.data.campaign_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateCampaign(parsed.data.campaign_id, existing?.client_id);
  return { ok: true, message: "Campaign updated." };
}

export async function createCampaignLineAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = createCampaignLineSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { data: header } = await supabase
    .from("campaign_headers")
    .select("client_id, currency_code")
    .eq("id", parsed.data.campaign_id)
    .maybeSingle();

  const { error } = await supabase.from("campaign_lines").insert({
    campaign_header_id: parsed.data.campaign_id,
    name: parsed.data.name,
    status: parsed.data.status as CampaignStatus,
    platform: emptyToNull(parsed.data.platform),
    po_amount: parsed.data.po_amount,
    revenue: parsed.data.revenue,
    cost: parsed.data.cost,
    currency_code: parsed.data.currency_code || header?.currency_code || "USD",
    base_currency: "USD",
    fx_rate: 1,
    created_by: user.id,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateCampaign(parsed.data.campaign_id, header?.client_id);
  return { ok: true, message: "Campaign line added." };
}

export async function updateCampaignLineAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updateCampaignLineSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const { data: header } = await supabase
    .from("campaign_headers")
    .select("client_id")
    .eq("id", parsed.data.campaign_id)
    .maybeSingle();

  const { error } = await supabase
    .from("campaign_lines")
    .update({
      name: parsed.data.name,
      status: parsed.data.status as CampaignStatus,
      platform: emptyToNull(parsed.data.platform),
      po_amount: parsed.data.po_amount,
      revenue: parsed.data.revenue,
      cost: parsed.data.cost,
      currency_code: parsed.data.currency_code,
    })
    .eq("id", parsed.data.line_id)
    .eq("campaign_header_id", parsed.data.campaign_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateCampaign(parsed.data.campaign_id, header?.client_id);
  return { ok: true, message: "Campaign line updated." };
}

export async function assignCampaignVendorAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = assignCampaignVendorSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const lineId = emptyToNull(parsed.data.campaign_line_id);

  const { error } = await supabase.from("campaign_influencers").insert({
    campaign_id: parsed.data.campaign_id,
    campaign_header_id: parsed.data.campaign_id,
    campaign_line_id: lineId,
    influencer_id: parsed.data.influencer_id,
    status: parsed.data.status,
    agreed_fee: parsed.data.agreed_fee,
    currency: parsed.data.currency,
    deliverable_count: parsed.data.deliverable_count,
    invited_at: new Date().toISOString(),
    created_by: user.id,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateCampaign(parsed.data.campaign_id);
  return { ok: true, message: "Vendor assigned to campaign." };
}

export async function updateCampaignVendorAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updateCampaignVendorSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Please fix the errors below." };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const lineId = emptyToNull(parsed.data.campaign_line_id);

  const { error } = await supabase
    .from("campaign_influencers")
    .update({
      campaign_line_id: lineId,
      status: parsed.data.status,
      agreed_fee: parsed.data.agreed_fee,
      currency: parsed.data.currency,
      deliverable_count: parsed.data.deliverable_count,
      confirmed_at:
        parsed.data.status === "confirmed" ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.assignment_id)
    .eq("campaign_header_id", parsed.data.campaign_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateCampaign(parsed.data.campaign_id);
  return { ok: true, message: "Vendor assignment updated." };
}

export async function createDeliverableAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = createDeliverableSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const docNumber = `DEL-${Date.now()}`;

  const { error } = await supabase.from("deliverables").insert({
    document_number: docNumber,
    campaign_id: parsed.data.campaign_id,
    influencer_id: parsed.data.influencer_id,
    campaign_influencer_id: emptyToNull(parsed.data.campaign_influencer_id),
    deliverable_type: parsed.data.deliverable_type,
    title: parsed.data.title,
    platform: emptyToNull(parsed.data.platform),
    due_date: parsed.data.due_date,
    created_by: user.id,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateCampaign(parsed.data.campaign_id);
  return { ok: true, message: "Deliverable created." };
}

export async function updateDeliverableStatusAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updateDeliverableStatusSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const timestamps: Record<string, string | null> = {};
  if (parsed.data.status === "submitted") {
    timestamps.submitted_at = new Date().toISOString();
  }
  if (parsed.data.status === "approved") {
    timestamps.approved_at = new Date().toISOString();
  }
  if (parsed.data.status === "published") {
    timestamps.published_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("deliverables")
    .update({ status: parsed.data.status, ...timestamps })
    .eq("id", parsed.data.deliverable_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateCampaign(parsed.data.campaign_id);
  return { ok: true, message: "Deliverable status updated." };
}

export type InfluencerSearchState = {
  results: Awaited<
    ReturnType<
      typeof import("./queries").searchInfluencersForCampaign
    >
  >;
  error?: string;
};

export async function searchInfluencersAction(
  _prev: InfluencerSearchState,
  formData: FormData
): Promise<InfluencerSearchState> {
  const search = String(formData.get("search") ?? "");
  const platform = String(formData.get("platform") ?? "");

  try {
    const { searchInfluencersForCampaign } = await import("./queries");
    const results = await searchInfluencersForCampaign({
      search,
      platform: platform || undefined,
    });
    return { results };
  } catch (e) {
    return {
      results: [],
      error: e instanceof Error ? e.message : "Search failed.",
    };
  }
}
