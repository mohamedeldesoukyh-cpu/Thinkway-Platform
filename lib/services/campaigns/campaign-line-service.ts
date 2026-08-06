import type { SupabaseClient } from "@supabase/supabase-js";

import { syncCampaignInfluencerForLine } from "@/lib/campaigns/campaign-influencer-sync";
import { hasActiveFinanceOverride } from "@/lib/campaigns/finance-override";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import { resolveLineCommercialInput } from "@/lib/assignments/resolve-line-commercial-input";
import { syncAssignmentDeliverablesForLine } from "@/lib/assignments/sync-assignment-deliverables-for-line";
import { packagePlatformsToCommercialRows } from "@/lib/assignments/sync-package-deliverables";
import {
  buildVendorCostVatPayload,
  defaultCostVatPercentForVendor,
} from "@/lib/vat/line-payload";
import {
  resolveCampaignBillingVatRate,
  resolveVatRateForCountry,
} from "@/lib/vat/queries";
import { lineAssignmentPayloadSchema } from "@/lib/campaigns/schemas";
import {
  buildLineTitle,
  deriveLinePlatformField,
  LINE_ASSIGNMENT_META_KEY,
  parseLineAssignment,
  type LineInfluencerAssignment,
  type LinePlatformSelection,
} from "@/lib/campaigns/line-assignment";

import { applyCampaignMasterSyncIfLinked } from "@/lib/services/commercial/linked-commercial-gate";
import type { MasterCommercialValues } from "@/lib/services/commercial/types";

import {
  emptyToNull,
  resolveAssignmentCommercialBilling,
  resolveAssignmentMultiCurrencyCost,
  resolveLineVatInput,
} from "./campaign-commercial";
import {
  deleteCampaignInfluencer,
  deleteCampaignLine,
  fetchCampaignHeaderContext,
  fetchCampaignLineById,
  fetchInvoiceRegenerationStatus,
  insertCampaignLine,
  unlockCampaignLineFinanceFields,
  updateCampaignLine as updateCampaignLineRow,
} from "./repositories/campaign-repository";
import {
  deleteLegacyDeliverablesForAssignment,
  fetchInfluencerForLine,
  fetchInfluencerPlatformAccounts,
  insertLegacyDeliverablesForPlatforms,
} from "./repositories/assignment-repository";

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
  supabase: SupabaseClient,
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
  // Legacy `deliverables` still FKs campaigns_legacy on some DBs. Assignment SSOT is
  // assignment_deliverables (synced separately). Never fail line create on legacy write.
  try {
    await deleteLegacyDeliverablesForAssignment(supabase, {
      assignmentId: input.assignmentId,
      campaignId: input.campaignId,
      influencerId: input.influencerId,
    });

    await insertLegacyDeliverablesForPlatforms(supabase, userId, {
      campaignId: input.campaignId,
      influencerId: input.influencerId,
      assignmentId: input.assignmentId,
      platforms: input.platforms,
      dueDate: input.dueDate,
    });
  } catch {
    // Soft-fail all legacy writes (enum mismatches like ig_story_set / tiktok_story,
    // FK to campaigns_legacy, etc.). Assignment SSOT is assignment_deliverables.
    return;
  }
}

export type CampaignLineMutationInput = {
  campaign_id: string;
  influencer_id: string;
  assignment_json: string;
  commercial_json?: string;
  pricing_mode: "package" | "per_deliverable";
  name?: string;
  platform?: string;
  po_amount: number;
  revenue: number;
  cost: number;
  revenue_before_vat?: number;
  cost_before_vat?: number;
  usage_rights_amount: number;
  usage_rights_cost: number;
  agency_fee_percent: number;
  revenue_vat_percent: number;
  cost_vat_percent: number;
  revenue_vat_exempt?: boolean;
  cost_vat_exempt?: boolean;
  cost_received?: number;
  cost_received_currency?: string;
  fx_rate?: number;
  fx_from_currency?: string;
  fx_to_currency?: string;
  currency_code?: string;
  start_date: string | null;
  end_date: string | null;
  assignment_status: string;
  title_user_edited?: boolean;
  /** Full Description (quotation service description). */
  description?: string | null;
  /** Release 2.0 provenance — optional. */
  source_quotation_id?: string | null;
  source_quotation_item_id?: string | null;
};

export async function createCampaignLine(
  supabase: SupabaseClient,
  userId: string,
  parsed: CampaignLineMutationInput
): Promise<{ ok: true; message: string; clientId?: string; lineId: string } | { ok: false; message: string }> {
  const assignmentResult = parseAssignmentJson(parsed.assignment_json);
  if (parsed.pricing_mode !== "per_deliverable" && !assignmentResult.ok) {
    return { ok: false, message: assignmentResult.message };
  }

  const { data: header } = await fetchCampaignHeaderContext(supabase, parsed.campaign_id);

  const { data: influencer, error: influencerError } = await fetchInfluencerForLine(
    supabase,
    parsed.influencer_id
  );

  if (influencerError || !influencer) {
    return { ok: false, message: "Influencer not found." };
  }

  const { data: platformAccounts } = await fetchInfluencerPlatformAccounts(
    supabase,
    influencer.id
  );

  const commercialResolved = resolveLineCommercialInput({
    pricing_mode: parsed.pricing_mode,
    assignment_json: parsed.assignment_json,
    commercial_json: parsed.commercial_json,
    platformAccounts: platformAccounts ?? [],
    parseAssignmentJson,
  });

  if (!commercialResolved.ok) {
    return { ok: false, message: commercialResolved.message };
  }

  const commercial = commercialResolved.value;
  const currency =
    parsed.currency_code || header?.currency_code || DEFAULT_PLATFORM_CURRENCY;
  const costFx = resolveAssignmentMultiCurrencyCost({
    ...parsed,
    currency_code: currency,
    cost: commercial.cost_before_vat || parsed.cost,
    cost_before_vat: commercial.cost_before_vat || parsed.cost_before_vat,
  });
  const commercialBilling = resolveAssignmentCommercialBilling(
    commercial,
    parsed.usage_rights_amount,
    parsed.usage_rights_cost,
    parsed.agency_fee_percent
  );
  const lineInput = {
    ...parsed,
    revenue: commercial.revenue_before_vat || parsed.revenue,
    ...costFx,
    revenue_before_vat: commercial.revenue_before_vat || parsed.revenue_before_vat,
    usage_rights_amount: commercialBilling.usage_rights_amount,
    usage_rights_cost: commercialBilling.usage_rights_cost,
    agency_fee_percent: commercialBilling.agency_fee_percent,
  };

  const { vatRate: clientVatRate } = await resolveCampaignBillingVatRate(
    supabase,
    parsed.campaign_id
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
    parsed.name?.trim() || buildLineTitle(influencer.display_name, platforms);
  const platformField =
    emptyToNull(parsed.platform) ?? deriveLinePlatformField(platforms);
  const deliverableCount = commercial.deliverable_count;

  const assignmentMeta: LineInfluencerAssignment = {
    influencer_id: influencer.id,
    influencer_name: influencer.display_name,
    influencer_document_number: influencer.document_number,
    platforms,
    title_user_edited: parsed.title_user_edited ?? false,
    pricing_mode: commercial.pricing_mode,
    commercial_rows:
      commercial.commercial_rows.length > 0 ? commercial.commercial_rows : undefined,
  };

  const { data: line, error: lineError } = await insertCampaignLine(supabase, {
    campaign_header_id: parsed.campaign_id,
    name: lineTitle,
    description: emptyToNull(parsed.description ?? undefined),
    status: "draft",
    assignment_status: parsed.assignment_status,
    platform: platformField,
    po_amount: parsed.po_amount,
    pricing_mode: commercial.pricing_mode,
    ...vatPayload,
    cost_received: costFx.cost_received,
    cost_received_currency: costFx.cost_received_currency,
    currency_code: currency,
    base_currency: DEFAULT_PLATFORM_CURRENCY,
    fx_rate: costFx.fx_rate,
    fx_from_currency: costFx.fx_from_currency,
    fx_to_currency: costFx.fx_to_currency,
    fx_snapshot_at: costFx.fx_snapshot_at,
    start_date: parsed.start_date,
    end_date: parsed.end_date,
    metadata: { [LINE_ASSIGNMENT_META_KEY]: assignmentMeta },
    source_quotation_id: parsed.source_quotation_id ?? null,
    source_quotation_item_id: parsed.source_quotation_item_id ?? null,
    created_by: userId,
  });

  if (lineError || !line) {
    return { ok: false, message: lineError?.message ?? "Failed to create line." };
  }

  const vendorVatPayload = buildVendorCostVatPayload({
    cost_before_vat: vatPayload.cost_before_vat,
    cost_vat_percent: vatPayload.cost_vat_percent,
    cost_vat_exempt: vatPayload.cost_vat_exempt,
  });

  const vendorSync = await syncCampaignInfluencerForLine(supabase, {
    campaignId: parsed.campaign_id,
    lineId: line.id,
    influencerId: influencer.id,
    payload: {
      status: "confirmed",
      ...vendorVatPayload,
      currency,
      deliverable_count: deliverableCount,
      invited_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      created_by: userId,
    },
  });

  if (vendorSync.error || !vendorSync.id) {
    await deleteCampaignLine(supabase, line.id);
    return {
      ok: false,
      message: vendorSync.error ?? "Failed to link vendor assignment.",
    };
  }

  const vendorAssignmentId = vendorSync.id;

  try {
    await syncLineDeliverables(supabase, userId, {
      campaignId: parsed.campaign_id,
      lineId: line.id,
      influencerId: influencer.id,
      assignmentId: vendorAssignmentId,
      platforms,
      dueDate: parsed.end_date ?? parsed.start_date,
    });

    await syncAssignmentDeliverablesForLine(supabase, {
      campaignHeaderId: parsed.campaign_id,
      campaignLineId: line.id,
      commercial,
      revenueBeforeVat: vatPayload.revenue_before_vat,
      costBeforeVat: vatPayload.cost_before_vat,
      usageRightsAmount: commercialBilling.usage_rights_amount,
      usageRightsCost: commercialBilling.usage_rights_cost,
      agencyFeePercent: commercialBilling.agency_fee_percent,
      dueDate: parsed.end_date ?? parsed.start_date ?? null,
      revenueVatPercent: vatPayload.revenue_vat_percent,
      revenueVatExempt: vatPayload.revenue_vat_exempt,
      costVatPercent: vatPayload.cost_vat_percent,
      costVatExempt: vatPayload.cost_vat_exempt,
    });
  } catch (e) {
    await deleteCampaignInfluencer(supabase, vendorAssignmentId);
    await deleteCampaignLine(supabase, line.id);
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Failed to create deliverables.",
    };
  }

  return {
    ok: true,
    message: `Influencer assignment ${line.document_number} created.`,
    clientId: header?.client_id as string | undefined,
    lineId: line.id,
  };
}

export type UpdateCampaignLineInput = CampaignLineMutationInput & {
  line_id: string;
  confirm_commercial_sync?: boolean;
  commercial_sync_idempotency_key?: string;
};

export async function updateCampaignLine(
  supabase: SupabaseClient,
  userId: string,
  parsed: UpdateCampaignLineInput
): Promise<
  | { ok: true; message: string; clientId?: string; reviseVendorIo: boolean }
  | {
      ok: false;
      message: string;
      code?: string;
      commercialSync?: {
        quotationSerial?: string | null;
        campaignDocumentNumber?: string | null;
        concurrencyToken?: string | null;
        confirmationTitle?: string;
        confirmationDescription?: string;
      };
    }
> {
  const { data: existingLine, error: lineError } = await fetchCampaignLineById(
    supabase,
    parsed.line_id,
    parsed.campaign_id
  );

  if (lineError || !existingLine) {
    return { ok: false, message: lineError?.message ?? "Line not found." };
  }

  const existingLineMeta = existingLine as {
    revenue_locked?: boolean | null;
    cost_locked?: boolean | null;
    revenue?: number | null;
    cost?: number | null;
    revenue_before_vat?: number | null;
    cost_before_vat?: number | null;
    vat_locked?: boolean | null;
    document_number?: string | null;
    finance_override_until?: string | null;
    vendor_io_id?: string | null;
    vendor_assignment_locked?: boolean | null;
    metadata?: Record<string, unknown> | null;
    operational_status?: string | null;
    invoice_id?: string | null;
    source_quotation_item_id?: string | null;
    agency_fee_percent?: number | null;
    currency_code?: string | null;
    fx_rate?: number | null;
    usage_rights_amount?: number | null;
    usage_rights_cost?: number | null;
    revenue_vat_percent?: number | null;
    cost_vat_percent?: number | null;
    revenue_vat_exempt?: boolean | null;
    cost_vat_exempt?: boolean | null;
  };

  const financeOverrideActive = hasActiveFinanceOverride(
    existingLineMeta.finance_override_until
  );

  const revenueBeforeVat = parsed.revenue_before_vat ?? parsed.revenue;
  const costBeforeVat = parsed.cost_before_vat ?? parsed.cost;

  {
    const masterChanges: MasterCommercialValues = {
      creator_cost: costBeforeVat,
      client_revenue: revenueBeforeVat,
      cost_currency: parsed.currency_code ?? existingLineMeta.currency_code ?? "EGP",
      agency_fee_percent: parsed.agency_fee_percent,
      usage_rights_amount: parsed.usage_rights_amount,
      usage_rights_cost: parsed.usage_rights_cost,
      revenue_vat_percent: parsed.revenue_vat_percent,
      cost_vat_percent: parsed.cost_vat_percent,
      revenue_vat_exempt: parsed.revenue_vat_exempt ?? false,
      cost_vat_exempt: parsed.cost_vat_exempt ?? true,
    };
    if (parsed.fx_rate != null) masterChanges.exchange_rate = parsed.fx_rate;

    const mastersChanged =
      Number(existingLineMeta.cost_before_vat ?? existingLineMeta.cost) !==
        Number(costBeforeVat) ||
      Number(existingLineMeta.revenue_before_vat ?? existingLineMeta.revenue) !==
        Number(revenueBeforeVat) ||
      Number(existingLineMeta.agency_fee_percent ?? 0) !==
        Number(parsed.agency_fee_percent) ||
      Number(existingLineMeta.usage_rights_amount ?? 0) !==
        Number(parsed.usage_rights_amount) ||
      Number(existingLineMeta.usage_rights_cost ?? 0) !==
        Number(parsed.usage_rights_cost) ||
      (parsed.currency_code != null &&
        parsed.currency_code !== existingLineMeta.currency_code) ||
      (parsed.fx_rate != null &&
        Number(parsed.fx_rate) !== Number(existingLineMeta.fx_rate ?? 0));

    if (mastersChanged) {
      // Finance lock + Commercial SSOT sync (when Origin linked) — platform gateway.
      const gate = await applyCampaignMasterSyncIfLinked(supabase, {
        actorId: userId,
        assignmentId: parsed.line_id,
        changes: masterChanges,
        options: {
          confirmCommercialSync: parsed.confirm_commercial_sync,
          idempotencyKey: parsed.commercial_sync_idempotency_key,
        },
      });
      if (!gate.ok) {
        return {
          ok: false,
          message: gate.message,
          code: gate.code,
          commercialSync: gate.commercialSync,
        };
      }
    }
  }

  if (
    existingLineMeta.revenue_locked &&
    !financeOverrideActive &&
    revenueBeforeVat !== Number(existingLineMeta.revenue_before_vat ?? existingLineMeta.revenue)
  ) {
    return {
      ok: false,
      message: `Revenue is locked on ${existingLineMeta.document_number}. Request a finance override.`,
    };
  }

  if (
    existingLineMeta.cost_locked &&
    !financeOverrideActive &&
    costBeforeVat !== Number(existingLineMeta.cost_before_vat ?? existingLineMeta.cost)
  ) {
    return {
      ok: false,
      message: `Cost is locked on ${existingLineMeta.document_number}. Request a finance override.`,
    };
  }

  const assignmentResult = parseAssignmentJson(parsed.assignment_json);
  if (parsed.pricing_mode !== "per_deliverable" && !assignmentResult.ok) {
    return { ok: false, message: assignmentResult.message };
  }

  const { data: influencer } = await fetchInfluencerForLine(supabase, parsed.influencer_id);

  if (!influencer) {
    return { ok: false, message: "Influencer not found." };
  }

  const { data: platformAccounts } = await fetchInfluencerPlatformAccounts(
    supabase,
    influencer.id
  );

  let commercialResolved = resolveLineCommercialInput({
    pricing_mode: parsed.pricing_mode,
    assignment_json: parsed.assignment_json,
    commercial_json: parsed.commercial_json,
    platformAccounts: platformAccounts ?? [],
    parseAssignmentJson,
  });

  if (!commercialResolved.ok && parsed.pricing_mode === "per_deliverable") {
    const assignment = parseLineAssignment(existingLineMeta.metadata);
    if (assignment?.platforms?.length) {
      const synthesizedRows = packagePlatformsToCommercialRows(assignment.platforms, {
        totalRevenueBeforeVat: revenueBeforeVat,
        totalCostBeforeVat: costBeforeVat,
        dueDate: parsed.end_date ?? parsed.start_date ?? null,
      });
      if (synthesizedRows.length > 0) {
        commercialResolved = resolveLineCommercialInput({
          pricing_mode: "per_deliverable",
          assignment_json: parsed.assignment_json,
          commercial_json: JSON.stringify(synthesizedRows),
          platformAccounts: platformAccounts ?? [],
          parseAssignmentJson,
        });
      }
    }
  }

  if (!commercialResolved.ok) {
    return { ok: false, message: commercialResolved.message };
  }

  const commercial = commercialResolved.value;

  const { data: header } = await fetchCampaignHeaderContext(supabase, parsed.campaign_id);

  const currency =
    parsed.currency_code || header?.currency_code || DEFAULT_PLATFORM_CURRENCY;
  const costFx = resolveAssignmentMultiCurrencyCost({
    ...parsed,
    currency_code: currency,
    cost: commercial.cost_before_vat || parsed.cost,
    cost_before_vat: commercial.cost_before_vat || parsed.cost_before_vat,
  });
  const commercialBilling = resolveAssignmentCommercialBilling(
    commercial,
    parsed.usage_rights_amount,
    parsed.usage_rights_cost,
    parsed.agency_fee_percent
  );
  const lineInput = {
    ...parsed,
    revenue: commercial.revenue_before_vat || parsed.revenue,
    ...costFx,
    revenue_before_vat: commercial.revenue_before_vat || parsed.revenue_before_vat,
    usage_rights_amount: commercialBilling.usage_rights_amount,
    usage_rights_cost: commercialBilling.usage_rights_cost,
    agency_fee_percent: commercialBilling.agency_fee_percent,
  };

  const { vatRate: clientVatRate } = await resolveCampaignBillingVatRate(
    supabase,
    parsed.campaign_id
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
    parsed.name?.trim() || buildLineTitle(influencer.display_name, platforms);
  const platformField =
    emptyToNull(parsed.platform) ?? deriveLinePlatformField(platforms);
  const deliverableCount = commercial.deliverable_count;

  const assignmentMeta: LineInfluencerAssignment = {
    influencer_id: influencer.id,
    influencer_name: influencer.display_name,
    influencer_document_number: influencer.document_number,
    platforms,
    title_user_edited: parsed.title_user_edited ?? false,
    pricing_mode: commercial.pricing_mode,
    commercial_rows:
      commercial.commercial_rows.length > 0 ? commercial.commercial_rows : undefined,
  };

  const { error } = await updateCampaignLineRow(supabase, parsed.line_id, parsed.campaign_id, {
    name: lineTitle,
    assignment_status: parsed.assignment_status,
    platform: platformField,
    po_amount: parsed.po_amount,
    pricing_mode: commercial.pricing_mode,
    ...vatPayload,
    cost_received: costFx.cost_received,
    cost_received_currency: costFx.cost_received_currency,
    currency_code: currency,
    fx_rate: costFx.fx_rate,
    fx_from_currency: costFx.fx_from_currency,
    fx_to_currency: costFx.fx_to_currency,
    fx_snapshot_at: costFx.fx_snapshot_at,
    start_date: parsed.start_date,
    end_date: parsed.end_date,
    metadata: {
      ...((existingLineMeta.metadata as Record<string, unknown>) ?? {}),
      [LINE_ASSIGNMENT_META_KEY]: assignmentMeta,
    },
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const canSyncAssignment =
    !existingLineMeta.vendor_assignment_locked || financeOverrideActive;

  if (canSyncAssignment) {
    const vendorVatPayload = buildVendorCostVatPayload({
      cost_before_vat: vatPayload.cost_before_vat,
      cost_vat_percent: vatPayload.cost_vat_percent,
      cost_vat_exempt: vatPayload.cost_vat_exempt,
    });

    const vendorSync = await syncCampaignInfluencerForLine(supabase, {
      campaignId: parsed.campaign_id,
      lineId: parsed.line_id,
      influencerId: influencer.id,
      payload: {
        status: "confirmed",
        ...vendorVatPayload,
        currency,
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

    const assignmentId = vendorSync.id;

    await syncLineDeliverables(supabase, userId, {
      campaignId: parsed.campaign_id,
      lineId: parsed.line_id,
      influencerId: influencer.id,
      assignmentId,
      platforms,
      dueDate: parsed.end_date ?? parsed.start_date,
    });

    await syncAssignmentDeliverablesForLine(supabase, {
      campaignHeaderId: parsed.campaign_id,
      campaignLineId: parsed.line_id,
      commercial,
      revenueBeforeVat: vatPayload.revenue_before_vat,
      costBeforeVat: vatPayload.cost_before_vat,
      usageRightsAmount: commercialBilling.usage_rights_amount,
      usageRightsCost: commercialBilling.usage_rights_cost,
      agencyFeePercent: commercialBilling.agency_fee_percent,
      dueDate: parsed.end_date ?? parsed.start_date ?? null,
      revenueVatPercent: vatPayload.revenue_vat_percent,
      revenueVatExempt: vatPayload.revenue_vat_exempt,
      costVatPercent: vatPayload.cost_vat_percent,
      costVatExempt: vatPayload.cost_vat_exempt,
    });
  }

  const commercialChanged =
    revenueBeforeVat !== Number(existingLineMeta.revenue_before_vat ?? existingLineMeta.revenue) ||
    costBeforeVat !== Number(existingLineMeta.cost_before_vat ?? existingLineMeta.cost);

  const { findVendorIoAmountDriftForCampaign } = await import(
    "@/lib/io/vendor-io-amount-drift"
  );
  const amountDrift =
    Boolean(existingLineMeta.vendor_io_id) &&
    (
      await findVendorIoAmountDriftForCampaign(supabase, parsed.campaign_id, [
        parsed.line_id,
      ])
    ).length > 0;

  let vendorIoRevisionAllowed = !existingLineMeta.invoice_id || financeOverrideActive;
  if (!vendorIoRevisionAllowed && existingLineMeta.invoice_id) {
    const { data: linkedInvoice } = await fetchInvoiceRegenerationStatus(
      supabase,
      existingLineMeta.invoice_id
    );
    vendorIoRevisionAllowed =
      (linkedInvoice as { regeneration_status: string | null } | null)
        ?.regeneration_status === "pending_regeneration";
  }

  // Enterprise Document Lifecycle: issued documents become Revision Required
  // with a reason code. Never silently mutate or auto-create a new version.
  const shouldMarkRevisionRequired = Boolean(
    existingLineMeta.vendor_io_id &&
      vendorIoRevisionAllowed &&
      (amountDrift || (financeOverrideActive && commercialChanged))
  );

  let markedRevisionRequired = false;
  if (shouldMarkRevisionRequired) {
    const { applyBusinessChangeImpact } = await import("@/lib/change-impact/apply");
    const costChanged =
      Number(existingLineMeta.cost_before_vat ?? existingLineMeta.cost) !==
      Number(costBeforeVat);
    const reasonCode = costChanged
      ? ("creator_price_changed" as const)
      : ("commercial_correction" as const);
    const reasonDetail = costChanged
      ? "Creator price changed after document issuance."
      : "Commercial correction after invoice un-generate.";

    const impactResult = await applyBusinessChangeImpact(supabase, {
      eventType: costChanged
        ? "creator_price_updated"
        : "manual_mark_revision_required",
      reasonCode,
      reasonDetail,
      campaignHeaderId: parsed.campaign_id,
      entityType: "campaign_line",
      entityId: parsed.line_id,
      actorId: userId,
      vendorIoIds: existingLineMeta.vendor_io_id
        ? [existingLineMeta.vendor_io_id]
        : undefined,
      campaignLineIds: [parsed.line_id],
      estimatedImpact: {
        amountDelta:
          Number(costBeforeVat) -
          Number(existingLineMeta.cost_before_vat ?? existingLineMeta.cost ?? 0),
        currencyCode: currency,
        note: reasonDetail,
      },
      payload: {
        line_id: parsed.line_id,
        vendor_io_id: existingLineMeta.vendor_io_id,
        amount_drift: amountDrift,
      },
    });

    if (!impactResult.ok) {
      return {
        ok: false,
        message:
          impactResult.error ??
          "Failed to assess business change impact after commercial update.",
      };
    }

    markedRevisionRequired =
      impactResult.assessment.lifecycleReactions.length > 0;
    if (markedRevisionRequired) {
      await unlockCampaignLineFinanceFields(supabase, parsed.line_id);
    }
  }

  return {
    ok: true,
    message: markedRevisionRequired
      ? "Assignment updated. Vendor IO marked Revision Required — regenerate to create the next version."
      : "Influencer assignment updated.",
    clientId: header?.client_id as string | undefined,
    reviseVendorIo: markedRevisionRequired,
  };
}
