"use server";

import { revalidatePath } from "next/cache";

import {
  METADATA_PLATFORM_KEY,
} from "@/features/campaigns/constants";
import { syncCampaignInfluencerForLine } from "@/lib/campaigns/campaign-influencer-sync";
import { resolveLineCommercialInput } from "@/lib/assignments/resolve-line-commercial-input";
import { syncAssignmentCommercialRows } from "@/lib/assignments/sync-commercial-rows";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildLineVatPayload,
  buildVendorCostVatPayload,
  defaultCostVatPercentForVendor,
} from "@/lib/vat/line-payload";
import {
  resolveCampaignBillingVatRate,
  resolveVatRateForCountry,
} from "@/lib/vat/queries";
import type { AgencyOrDirect, CampaignStatus } from "@/types/database";

import {
  createCampaignLineSchema,
  createCampaignSchema,
  createDeliverableSchema,
  duplicateCampaignSchema,
  lineAssignmentPayloadSchema,
  updateCampaignHeaderSchema,
  updateCampaignLineSchema,
  updateDeliverableStatusSchema,
} from "./schemas";
import {
  buildLineTitle,
  countLineDeliverables,
  deriveLinePlatformField,
  LINE_ASSIGNMENT_META_KEY,
  type LineInfluencerAssignment,
  type LinePlatformSelection,
} from "./line-assignment";

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

function resolveAssignmentMultiCurrencyCost(parsed: {
  currency_code: string;
  cost?: number;
  cost_before_vat?: number;
  cost_received?: number;
  cost_received_currency?: string;
  fx_rate?: number;
  fx_from_currency?: string;
  fx_to_currency?: string;
}) {
  const campaignCurrency = parsed.currency_code;
  const costInLc = parsed.cost_before_vat ?? parsed.cost ?? 0;
  const costReceived = parsed.cost_received ?? costInLc;
  const costReceivedCurrency =
    parsed.cost_received_currency ?? parsed.fx_from_currency ?? campaignCurrency;
  const fxRate = parsed.fx_rate ?? 1;

  return {
    cost: costInLc,
    cost_before_vat: costInLc,
    cost_received: costReceived,
    cost_received_currency: costReceivedCurrency,
    fx_rate: fxRate,
    fx_from_currency: parsed.fx_from_currency ?? costReceivedCurrency,
    fx_to_currency: parsed.fx_to_currency ?? campaignCurrency,
    fx_snapshot_at: new Date().toISOString(),
  };
}

function resolveLineVatInput(
  parsed: {
    revenue: number;
    cost: number;
    revenue_before_vat?: number;
    cost_before_vat?: number;
    revenue_vat_percent: number;
    cost_vat_percent: number;
    revenue_vat_exempt?: boolean;
    cost_vat_exempt?: boolean;
  },
  defaults: {
    clientVatRate: number;
    vendorVatRate: number;
    vendorVatRegistered: boolean;
  }
) {
  const revenueBeforeVat = parsed.revenue_before_vat ?? parsed.revenue;
  const costBeforeVat = parsed.cost_before_vat ?? parsed.cost;
  const revenueExempt = parsed.revenue_vat_exempt ?? false;
  const costExempt = parsed.cost_vat_exempt ?? false;

  const revenueVatPercent = revenueExempt
    ? 0
    : parsed.revenue_vat_percent > 0
      ? parsed.revenue_vat_percent
      : defaults.clientVatRate;

  const costVatPercent = costExempt
    ? 0
    : parsed.cost_vat_percent > 0
      ? parsed.cost_vat_percent
      : defaults.vendorVatRegistered
        ? defaults.vendorVatRate
        : 0;

  return buildLineVatPayload({
    revenue_before_vat: revenueBeforeVat,
    revenue_vat_percent: revenueVatPercent,
    revenue_vat_exempt: revenueExempt,
    cost_before_vat: costBeforeVat,
    cost_vat_percent: costVatPercent,
    cost_vat_exempt: costExempt || !defaults.vendorVatRegistered,
  });
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
      "id, client_id, group_id, category_id, subcategory_id, vr_rate_id, currency_code, client:clients(agency_or_direct)"
    )
    .eq("id", parsed.data.brand_id)
    .maybeSingle();

  if (brandError || !brand) {
    return { ok: false, message: brandError?.message ?? "Brand not found." };
  }

  const brandRow = brand as unknown as {
    id: string;
    client_id: string;
    group_id: string;
    category_id: string | null;
    subcategory_id: string | null;
    vr_rate_id: string | null;
    currency_code: string;
    client: { agency_or_direct: AgencyOrDirect | null } | null;
  };

  const platform = emptyToNull(parsed.data.platform);
  const metadata = platform ? { [METADATA_PLATFORM_KEY]: platform } : {};

  const { data: header, error: headerError } = await supabase
    .from("campaign_headers")
    .insert({
      name: parsed.data.name,
      brand_id: brandRow.id,
      client_id: brandRow.client_id,
      group_id: brandRow.group_id,
      status: parsed.data.status,
      currency_code: parsed.data.currency_code || brandRow.currency_code,
      category_id: brandRow.category_id,
      subcategory_id: brandRow.subcategory_id,
      agency_or_direct: brandRow.client?.agency_or_direct ?? null,
      vr_rate_id: brandRow.vr_rate_id,
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
    currency_code: parsed.data.currency_code || brandRow.currency_code,
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

  revalidateCampaign(header.id, brandRow.client_id);

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

function parseAssignmentJson(raw: string):
  | { ok: true; platforms: LinePlatformSelection[] }
  | { ok: false; message: string } {
  try {
    const parsed = lineAssignmentPayloadSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return {
        ok: false,
        message: "Select at least one platform account and deliverable.",
      };
    }
    return {
      ok: true,
      platforms: parsed.data.platforms.map((p) => ({
        ...p,
        profile_url: p.profile_url ?? null,
        engagement_rate: p.engagement_rate ?? null,
        audience_country: p.audience_country ?? null,
      })),
    };
  } catch {
    return { ok: false, message: "Invalid platform selection." };
  }
}

async function syncLineDeliverables(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  input: {
    campaignId: string;
    lineId: string;
    influencerId: string;
    assignmentId: string | null;
    platforms: LinePlatformSelection[];
    dueDate: string | null;
  }
) {
  if (input.assignmentId) {
    await supabase
      .from("deliverables")
      .delete()
      .eq("campaign_influencer_id", input.assignmentId);
  } else {
    await supabase
      .from("deliverables")
      .delete()
      .eq("campaign_id", input.campaignId)
      .eq("influencer_id", input.influencerId);
  }

  let sort = 0;
  for (const platform of input.platforms) {
    for (const deliverableType of platform.deliverables) {
      sort += 1;
      await supabase.from("deliverables").insert({
        document_number: `DEL-${Date.now()}-${sort}`,
        campaign_id: input.campaignId,
        influencer_id: input.influencerId,
        campaign_influencer_id: input.assignmentId,
        deliverable_type: deliverableType,
        title: `${platform.handle} — ${deliverableType.replace(/_/g, " ")}`,
        platform: platform.platform,
        due_date: input.dueDate,
        status: "pending",
        created_by: userId,
      });
    }
  }
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

  const assignmentResult = parseAssignmentJson(parsed.data.assignment_json);
  if (
    parsed.data.pricing_mode !== "per_deliverable" &&
    !assignmentResult.ok
  ) {
    return { ok: false, message: assignmentResult.message };
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

  const { data: influencer, error: influencerError } = await supabase
    .from("influencers")
    .select(
      "id, document_number, display_name, vat_registered, default_vat_percent, country_code"
    )
    .eq("id", parsed.data.influencer_id)
    .maybeSingle();

  if (influencerError || !influencer) {
    return { ok: false, message: "Influencer not found." };
  }

  const { data: platformAccounts } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "id, platform, handle, profile_url, follower_count, engagement_rate, audience_country"
    )
    .eq("influencer_id", influencer.id);

  const commercialResolved = resolveLineCommercialInput({
    pricing_mode: parsed.data.pricing_mode,
    assignment_json: parsed.data.assignment_json,
    commercial_json: parsed.data.commercial_json,
    platformAccounts: platformAccounts ?? [],
    parseAssignmentJson,
  });

  if (!commercialResolved.ok) {
    return { ok: false, message: commercialResolved.message };
  }

  const commercial = commercialResolved.value;
  const currency =
    parsed.data.currency_code || header?.currency_code || "USD";
  const costFx = resolveAssignmentMultiCurrencyCost({
    ...parsed.data,
    currency_code: currency,
    cost: commercial.cost_before_vat || parsed.data.cost,
    cost_before_vat: commercial.cost_before_vat || parsed.data.cost_before_vat,
  });
  const lineInput = {
    ...parsed.data,
    revenue: commercial.revenue_before_vat || parsed.data.revenue,
    ...costFx,
    revenue_before_vat: commercial.revenue_before_vat || parsed.data.revenue_before_vat,
  };

  const { vatRate: clientVatRate } = await resolveCampaignBillingVatRate(
    supabase,
    parsed.data.campaign_id
  );
  const vendorCountryVatRate = await resolveVatRateForCountry(
    supabase,
    influencer.country_code
  );
  const vendorVatRate = defaultCostVatPercentForVendor({
    vat_registered: influencer.vat_registered ?? false,
    default_vat_percent: Number(influencer.default_vat_percent ?? 0),
    country_code: influencer.country_code,
    country_vat_rate: vendorCountryVatRate,
  });
  const vatPayload = resolveLineVatInput(lineInput, {
    clientVatRate,
    vendorVatRate,
    vendorVatRegistered: influencer.vat_registered ?? false,
  });

  const platforms = commercial.platforms;
  const lineTitle =
    parsed.data.name?.trim() ||
    buildLineTitle(influencer.display_name, platforms);
  const platformField =
    emptyToNull(parsed.data.platform) ??
    deriveLinePlatformField(platforms);
  const deliverableCount = commercial.deliverable_count;

  const assignmentMeta: LineInfluencerAssignment = {
    influencer_id: influencer.id,
    influencer_name: influencer.display_name,
    influencer_document_number: influencer.document_number,
    platforms,
    title_user_edited: parsed.data.title_user_edited ?? false,
    pricing_mode: commercial.pricing_mode,
    commercial_rows:
      commercial.commercial_rows.length > 0 ? commercial.commercial_rows : undefined,
  };

  const { data: line, error: lineError } = await supabase
    .from("campaign_lines")
    .insert({
      campaign_header_id: parsed.data.campaign_id,
      name: lineTitle,
      status: "draft",
      assignment_status: parsed.data.assignment_status,
      platform: platformField,
      po_amount: parsed.data.po_amount,
      pricing_mode: commercial.pricing_mode,
      ...vatPayload,
      cost_received: costFx.cost_received,
      cost_received_currency: costFx.cost_received_currency,
      currency_code: currency,
      base_currency: "USD",
      fx_rate: costFx.fx_rate,
      fx_from_currency: costFx.fx_from_currency,
      fx_to_currency: costFx.fx_to_currency,
      fx_snapshot_at: costFx.fx_snapshot_at,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      metadata: { [LINE_ASSIGNMENT_META_KEY]: assignmentMeta },
      created_by: user.id,
    })
    .select("id, document_number")
    .single();

  if (lineError || !line) {
    return { ok: false, message: lineError?.message ?? "Failed to create line." };
  }

  const vendorVatPayload = buildVendorCostVatPayload({
    cost_before_vat: vatPayload.cost_before_vat,
    cost_vat_percent: vatPayload.cost_vat_percent,
    cost_vat_exempt: vatPayload.cost_vat_exempt,
  });

  const vendorSync = await syncCampaignInfluencerForLine(supabase, {
    campaignId: parsed.data.campaign_id,
    lineId: line.id,
    influencerId: influencer.id,
    payload: {
      status: "confirmed",
      ...vendorVatPayload,
      currency,
      deliverable_count: deliverableCount,
      invited_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      created_by: user.id,
    },
  });

  if (vendorSync.error || !vendorSync.id) {
    await supabase.from("campaign_lines").delete().eq("id", line.id);
    return {
      ok: false,
      message: vendorSync.error ?? "Failed to link vendor assignment.",
    };
  }

  const vendorAssignmentId = vendorSync.id;

  try {
    await syncLineDeliverables(supabase, user.id, {
      campaignId: parsed.data.campaign_id,
      lineId: line.id,
      influencerId: influencer.id,
      assignmentId: vendorAssignmentId,
      platforms,
      dueDate: parsed.data.end_date ?? parsed.data.start_date,
    });

    if (
      commercial.pricing_mode === "per_deliverable" &&
      commercial.commercial_rows.length > 0
    ) {
      await syncAssignmentCommercialRows(supabase, {
        campaignHeaderId: parsed.data.campaign_id,
        campaignLineId: line.id,
        rows: commercial.commercial_rows,
        revenueVatPercent: vatPayload.revenue_vat_percent,
        revenueVatExempt: vatPayload.revenue_vat_exempt,
        costVatPercent: vatPayload.cost_vat_percent,
        costVatExempt: vatPayload.cost_vat_exempt,
      });
    }
  } catch (e) {
    await supabase.from("campaign_influencers").delete().eq("id", vendorAssignmentId);
    await supabase.from("campaign_lines").delete().eq("id", line.id);
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Failed to create deliverables.",
    };
  }

  revalidateCampaign(parsed.data.campaign_id, header?.client_id);
  return {
    ok: true,
    message: `Influencer assignment ${line.document_number} created.`,
  };
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

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { data: existingLine, error: lineError } = await supabase
    .from("campaign_lines")
    .select(
      "revenue_locked, cost_locked, revenue, cost, revenue_before_vat, cost_before_vat, vat_locked, document_number"
    )
    .eq("id", parsed.data.line_id)
    .eq("campaign_header_id", parsed.data.campaign_id)
    .maybeSingle();

  if (lineError || !existingLine) {
    return { ok: false, message: lineError?.message ?? "Line not found." };
  }

  const revenueBeforeVat = parsed.data.revenue_before_vat ?? parsed.data.revenue;
  const costBeforeVat = parsed.data.cost_before_vat ?? parsed.data.cost;

  if (
    existingLine.revenue_locked &&
    revenueBeforeVat !== Number(existingLine.revenue_before_vat ?? existingLine.revenue)
  ) {
    return {
      ok: false,
      message: `Revenue is locked on ${existingLine.document_number}. Request a finance override.`,
    };
  }

  if (
    existingLine.cost_locked &&
    costBeforeVat !== Number(existingLine.cost_before_vat ?? existingLine.cost)
  ) {
    return {
      ok: false,
      message: `Cost is locked on ${existingLine.document_number}. Request a finance override.`,
    };
  }

  const assignmentResult = parseAssignmentJson(parsed.data.assignment_json);
  if (
    parsed.data.pricing_mode !== "per_deliverable" &&
    !assignmentResult.ok
  ) {
    return { ok: false, message: assignmentResult.message };
  }

  const { data: influencer } = await supabase
    .from("influencers")
    .select(
      "id, document_number, display_name, vat_registered, default_vat_percent, country_code"
    )
    .eq("id", parsed.data.influencer_id)
    .maybeSingle();

  if (!influencer) {
    return { ok: false, message: "Influencer not found." };
  }

  const { data: platformAccounts } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "id, platform, handle, profile_url, follower_count, engagement_rate, audience_country"
    )
    .eq("influencer_id", influencer.id);

  const commercialResolved = resolveLineCommercialInput({
    pricing_mode: parsed.data.pricing_mode,
    assignment_json: parsed.data.assignment_json,
    commercial_json: parsed.data.commercial_json,
    platformAccounts: platformAccounts ?? [],
    parseAssignmentJson,
  });

  if (!commercialResolved.ok) {
    return { ok: false, message: commercialResolved.message };
  }

  const commercial = commercialResolved.value;

  const { data: header } = await supabase
    .from("campaign_headers")
    .select("client_id, currency_code")
    .eq("id", parsed.data.campaign_id)
    .maybeSingle();

  const currency =
    parsed.data.currency_code || header?.currency_code || "USD";
  const costFx = resolveAssignmentMultiCurrencyCost({
    ...parsed.data,
    currency_code: currency,
    cost: commercial.cost_before_vat || parsed.data.cost,
    cost_before_vat: commercial.cost_before_vat || parsed.data.cost_before_vat,
  });
  const lineInput = {
    ...parsed.data,
    revenue: commercial.revenue_before_vat || parsed.data.revenue,
    ...costFx,
    revenue_before_vat: commercial.revenue_before_vat || parsed.data.revenue_before_vat,
  };

  const { vatRate: clientVatRate } = await resolveCampaignBillingVatRate(
    supabase,
    parsed.data.campaign_id
  );
  const vendorCountryVatRate = await resolveVatRateForCountry(
    supabase,
    influencer.country_code
  );
  const vendorVatRate = defaultCostVatPercentForVendor({
    vat_registered: influencer.vat_registered ?? false,
    default_vat_percent: Number(influencer.default_vat_percent ?? 0),
    country_code: influencer.country_code,
    country_vat_rate: vendorCountryVatRate,
  });
  const vatPayload = resolveLineVatInput(lineInput, {
    clientVatRate,
    vendorVatRate,
    vendorVatRegistered: influencer.vat_registered ?? false,
  });

  const platforms = commercial.platforms;
  const lineTitle =
    parsed.data.name?.trim() ||
    buildLineTitle(influencer.display_name, platforms);
  const platformField =
    emptyToNull(parsed.data.platform) ??
    deriveLinePlatformField(platforms);
  const deliverableCount = commercial.deliverable_count;

  const assignmentMeta: LineInfluencerAssignment = {
    influencer_id: influencer.id,
    influencer_name: influencer.display_name,
    influencer_document_number: influencer.document_number,
    platforms,
    title_user_edited: parsed.data.title_user_edited ?? false,
    pricing_mode: commercial.pricing_mode,
    commercial_rows:
      commercial.commercial_rows.length > 0 ? commercial.commercial_rows : undefined,
  };

  const { data: existingLineMeta } = await supabase
    .from("campaign_lines")
    .select("metadata, vendor_assignment_locked")
    .eq("id", parsed.data.line_id)
    .maybeSingle();

  const { error } = await supabase
    .from("campaign_lines")
    .update({
      name: lineTitle,
      assignment_status: parsed.data.assignment_status,
      platform: platformField,
      po_amount: parsed.data.po_amount,
      pricing_mode: commercial.pricing_mode,
      ...vatPayload,
      cost_received: costFx.cost_received,
      cost_received_currency: costFx.cost_received_currency,
      currency_code: currency,
      fx_rate: costFx.fx_rate,
      fx_from_currency: costFx.fx_from_currency,
      fx_to_currency: costFx.fx_to_currency,
      fx_snapshot_at: costFx.fx_snapshot_at,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      metadata: {
        ...((existingLineMeta?.metadata as Record<string, unknown>) ?? {}),
        [LINE_ASSIGNMENT_META_KEY]: assignmentMeta,
      },
    })
    .eq("id", parsed.data.line_id)
    .eq("campaign_header_id", parsed.data.campaign_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  let assignmentId: string | null = null;

  if (!existingLineMeta?.vendor_assignment_locked) {
    const vendorVatPayload = buildVendorCostVatPayload({
      cost_before_vat: vatPayload.cost_before_vat,
      cost_vat_percent: vatPayload.cost_vat_percent,
      cost_vat_exempt: vatPayload.cost_vat_exempt,
    });

    const vendorSync = await syncCampaignInfluencerForLine(supabase, {
      campaignId: parsed.data.campaign_id,
      lineId: parsed.data.line_id,
      influencerId: influencer.id,
      payload: {
        status: "confirmed",
        ...vendorVatPayload,
        currency: parsed.data.currency_code,
        deliverable_count: deliverableCount,
        confirmed_at: new Date().toISOString(),
      },
    });

    if (vendorSync.error || !vendorSync.id) {
      return {
        ok: false,
        message: vendorSync.error ?? "Failed to sync vendor assignment.",
      };
    }

    assignmentId = vendorSync.id;

    await syncLineDeliverables(supabase, user.id, {
      campaignId: parsed.data.campaign_id,
      lineId: parsed.data.line_id,
      influencerId: influencer.id,
      assignmentId,
      platforms,
      dueDate: parsed.data.end_date ?? parsed.data.start_date,
    });

    if (
      commercial.pricing_mode === "per_deliverable" &&
      commercial.commercial_rows.length > 0
    ) {
      await syncAssignmentCommercialRows(supabase, {
        campaignHeaderId: parsed.data.campaign_id,
        campaignLineId: parsed.data.line_id,
        rows: commercial.commercial_rows,
        revenueVatPercent: vatPayload.revenue_vat_percent,
        revenueVatExempt: vatPayload.revenue_vat_exempt,
        costVatPercent: vatPayload.cost_vat_percent,
        costVatExempt: vatPayload.cost_vat_exempt,
      });
    }
  }

  revalidateCampaign(parsed.data.campaign_id, header?.client_id);
  return { ok: true, message: "Influencer assignment updated." };
}

export async function assignCampaignVendorAction(
  _prev: FormActionState,
  _formData: FormData
): Promise<FormActionState> {
  return {
    ok: false,
    message:
      "Manual vendor assignment is deprecated. Use Assign influencer on the Assignments tab.",
  };
}

export async function updateCampaignVendorAction(
  _prev: FormActionState,
  _formData: FormData
): Promise<FormActionState> {
  return {
    ok: false,
    message:
      "Manual vendor updates are deprecated. Edit the influencer assignment on the Assignments tab.",
  };
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
  _formData: FormData
): Promise<InfluencerSearchState> {
  return {
    results: [],
    error: "Use the Assign influencer workflow on the Assignments tab.",
  };
}

export async function duplicateCampaignAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = duplicateCampaignSchema.safeParse(
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

  const sourceId = parsed.data.source_campaign_id;

  type SourceHeader = {
    id: string;
    brand_id: string;
    client_id: string;
    group_id: string;
    description: string | null;
    brief: string | null;
    currency_code: string;
    category_id: string | null;
    subcategory_id: string | null;
    agency_or_direct: AgencyOrDirect | null;
    vr_rate_id: string | null;
    team_id: string | null;
    report_type_id: string | null;
    account_manager_id: string | null;
    objectives: string | null;
    metadata: Record<string, unknown>;
  };

  type SourceLine = {
    id: string;
    name: string;
    platform: string | null;
    po_amount: number;
    revenue: number;
    cost: number;
    currency_code: string;
    base_currency: string;
    fx_rate: number;
    metadata: Record<string, unknown>;
  };

  type SourceVendor = {
    campaign_line_id: string | null;
    influencer_id: string;
    agreed_fee: number;
    currency: string;
    deliverable_count: number;
  };

  type SourceDeliverable = {
    influencer_id: string;
    deliverable_type: string;
    title: string;
    platform: string | null;
  };

  const { data: source, error: sourceError } = await supabase
    .from("campaign_headers")
    .select("*")
    .eq("id", sourceId)
    .maybeSingle();

  if (sourceError || !source) {
    return { ok: false, message: sourceError?.message ?? "Source campaign not found." };
  }

  const src = source as unknown as SourceHeader;
  const metadata = {
    ...(src.metadata ?? {}),
    ...(parsed.data.budget_month
      ? { budget_month: parsed.data.budget_month }
      : {}),
    ...(parsed.data.po_number ? { po_number: parsed.data.po_number } : {}),
    duplicated_from: sourceId,
  };

  const { data: newHeader, error: headerError } = await supabase
    .from("campaign_headers")
    .insert({
      name: parsed.data.name,
      description: parsed.data.copy_notes ? src.description : null,
      brief: parsed.data.copy_notes ? src.brief : null,
      brand_id: src.brand_id,
      client_id: src.client_id,
      group_id: src.group_id,
      status: "draft",
      currency_code: src.currency_code,
      category_id: src.category_id,
      subcategory_id: src.subcategory_id,
      agency_or_direct: src.agency_or_direct,
      vr_rate_id: src.vr_rate_id,
      team_id: parsed.data.copy_workflow ? src.team_id : null,
      report_type_id: parsed.data.copy_workflow ? src.report_type_id : null,
      start_date: parsed.data.live_date ?? parsed.data.start_date,
      end_date: parsed.data.end_date,
      account_manager_id: parsed.data.copy_workflow ? src.account_manager_id : null,
      objectives: parsed.data.copy_notes ? src.objectives : null,
      metadata,
      created_by: user.id,
    })
    .select("id, document_number")
    .single();

  if (headerError || !newHeader) {
    return { ok: false, message: headerError?.message ?? "Failed to create campaign." };
  }

  const { data: sourceLines, error: linesError } = await supabase
    .from("campaign_lines")
    .select("*")
    .eq("campaign_header_id", sourceId)
    .order("document_number");

  if (linesError) {
    await supabase.from("campaign_headers").delete().eq("id", newHeader.id);
    return { ok: false, message: linesError.message };
  }

  const lineIdMap = new Map<string, string>();

  for (const line of (sourceLines ?? []) as SourceLine[]) {
    const { data: newLine, error: lineError } = await supabase
      .from("campaign_lines")
      .insert({
        campaign_header_id: newHeader.id,
        name: line.name,
        status: "draft",
        platform: line.platform,
        po_amount: parsed.data.copy_pricing ? line.po_amount : 0,
        revenue: parsed.data.copy_pricing ? line.revenue : 0,
        cost: parsed.data.copy_pricing ? line.cost : 0,
        currency_code: line.currency_code,
        base_currency: line.base_currency,
        fx_rate: line.fx_rate,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
        metadata: line.metadata,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (lineError || !newLine) {
      await supabase.from("campaign_headers").delete().eq("id", newHeader.id);
      return { ok: false, message: lineError?.message ?? "Failed to copy line." };
    }

    lineIdMap.set(line.id, newLine.id);
  }

  if (parsed.data.copy_influencers) {
    const { data: vendors } = await supabase
      .from("campaign_influencers")
      .select("*")
      .or(`campaign_header_id.eq.${sourceId},campaign_id.eq.${sourceId}`);

    for (const vendor of (vendors ?? []) as SourceVendor[]) {
      const oldLineId = vendor.campaign_line_id;
      const newLineId = oldLineId ? lineIdMap.get(oldLineId) ?? null : null;

      await supabase.from("campaign_influencers").upsert(
        {
          campaign_id: newHeader.id,
          campaign_header_id: newHeader.id,
          campaign_line_id: newLineId,
          influencer_id: vendor.influencer_id,
          status: "invited",
          agreed_fee: parsed.data.copy_pricing ? vendor.agreed_fee : 0,
          currency: vendor.currency,
          deliverable_count: parsed.data.copy_deliverables
            ? vendor.deliverable_count
            : 0,
          invited_at: new Date().toISOString(),
        },
        { onConflict: "campaign_header_id,campaign_line_id,influencer_id" }
      );
    }
  }

  if (parsed.data.copy_deliverables) {
    const { data: deliverables } = await supabase
      .from("deliverables")
      .select("*")
      .eq("campaign_id", sourceId);

    for (const del of (deliverables ?? []) as SourceDeliverable[]) {
      await supabase.from("deliverables").insert({
        document_number: `DEL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        campaign_id: newHeader.id,
        influencer_id: del.influencer_id,
        deliverable_type: del.deliverable_type,
        title: del.title,
        platform: del.platform,
        due_date: parsed.data.start_date,
        status: "pending",
        created_by: user.id,
      });
    }
  }

  revalidateCampaign(newHeader.id, src.client_id);

  return {
    ok: true,
    message: `Campaign duplicated as ${newHeader.document_number}.`,
    campaignId: newHeader.id,
  };
}
