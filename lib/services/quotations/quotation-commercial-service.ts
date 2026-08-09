import type { SupabaseClient } from "@supabase/supabase-js";

import { syncQuotationChangeToShortlist } from "@/lib/commercial-sync/engine";
import { resolveRateToEgp } from "@/lib/commercial/fx-server";
import { normalizeCommercialLine, computeQuotationTotals } from "@/lib/commercial/quotation-engine";
import { applyQuotationMasterSyncIfLinked } from "@/lib/services/commercial/linked-commercial-gate";
import type { MasterCommercialValues } from "@/lib/services/commercial/types";
import type { CommercialInputMode, Database } from "@/types/database";

import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";

import {
  fetchQuotationItemEgpTotals,
  syncCollapsePackageOptionNumbers,
  updateQuotationHeaderRecord,
} from "./repositories/quotation-repository";
import { rollupDeliverableCommercials } from "@/lib/quotations/quotation-deliverable-rollup";
import {
  deliverablesPatchForLineMasterSave,
  shouldPreferDeliverableRollup,
  stripDeliverableCommercialAmounts,
} from "@/lib/quotations/quotation-line-commercial-ssot";

export async function recomputeQuotationTotals(
  supabase: SupabaseClient<Database>,
  quotationId: string
) {
  const { data } = await fetchQuotationItemEgpTotals(supabase, quotationId);

  const totals = computeQuotationTotals(
    (data ?? []).map((r) => ({
      cost_egp: Number((r as { cost_egp: number }).cost_egp ?? 0),
      revenue_egp: Number((r as { revenue_egp: number }).revenue_egp ?? 0),
      gp_value_egp: Number((r as { gp_value_egp: number }).gp_value_egp ?? 0),
      af_value_egp: Number((r as { af_value_egp: number }).af_value_egp ?? 0),
    }))
  );

  await updateQuotationHeaderRecord(supabase, quotationId, {
    total_cost_egp: totals.totalCostEgp,
    total_revenue_egp: totals.totalRevenueEgp,
    total_gp_value_egp: totals.totalGpValueEgp,
    total_gp_pct: totals.totalGpPct,
    total_af_egp: totals.totalAfValueEgp,
    total_agency_margin_egp: totals.totalAgencyMarginEgp,
  });

  return totals;
}

export async function updateQuotationItemCommercials(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: {
    item_id: string;
    quotation_id: string;
    mode: CommercialInputMode;
    cost: number | null;
    cost_currency: string;
    gp_pct?: number | null;
    revenue?: number | null;
    gp_value?: number | null;
    af_pct?: number | null;
    deliverables?: QuotationDeliverable[];
    option_number?: number | null;
    service_description?: string | null;
    platform?: string | null;
    handle?: string | null;
    followers?: number | null;
    engagement_rate?: number | null;
  },
  options?: {
    skipTotalsRecompute?: boolean;
    confirmCommercialSync?: boolean;
    idempotencyKey?: string;
    expectedConcurrencyToken?: string;
  }
) {
  const { data: quotationMeta } = await supabase
    .from("quotations")
    .select("issue_date")
    .eq("id", input.quotation_id)
    .maybeSingle();
  const issueDate =
    (quotationMeta as { issue_date?: string | null } | null)?.issue_date ?? null;
  const rate = await resolveRateToEgp(supabase, input.cost_currency, issueDate);
  const rolled = input.deliverables?.length
    ? rollupDeliverableCommercials(input.deliverables, {
        lineCurrency: input.cost_currency,
        fxRateToEgp: rate,
      })
    : null;
  const useRolled = shouldPreferDeliverableRollup({
    rolled,
    masterRevenue: input.revenue,
  });

  const line = normalizeCommercialLine({
    mode: useRolled ? "cost_revenue" : input.mode,
    cost: useRolled ? rolled!.cost : input.cost,
    costCurrency: input.cost_currency,
    gpPct: useRolled ? null : input.gp_pct,
    revenue: useRolled ? rolled!.revenue : input.revenue,
    gpValue: useRolled ? null : input.gp_value,
    afPct: input.af_pct,
    fxRateToEgp: rate,
  });

  const masterChanges: MasterCommercialValues = {
    creator_cost: line.cost,
    client_revenue: line.revenue,
    cost_currency: line.cost_currency,
    exchange_rate: line.fx_rate_to_egp,
    agency_fee_percent: line.af_pct,
    commercial_input_mode: line.commercial_input_mode,
    gp_pct_input: line.gp_pct,
    gp_value_input: line.gp_value,
  };

  const gate = await applyQuotationMasterSyncIfLinked(supabase, {
    actorId: userId,
    quotationItemId: input.item_id,
    changes: masterChanges,
    options: {
      confirmCommercialSync: options?.confirmCommercialSync,
      idempotencyKey: options?.idempotencyKey,
      expectedConcurrencyToken: options?.expectedConcurrencyToken,
    },
  });

  if (!gate.ok) {
    return {
      ok: false as const,
      message: gate.message,
      code: gate.code,
      commercialSync: gate.commercialSync,
      financeLock: gate.financeLock,
    };
  }

  const patch: Record<string, unknown> = gate.synced
    ? {}
    : {
        commercial_input_mode: line.commercial_input_mode,
        cost: line.cost,
        cost_currency: line.cost_currency,
        revenue: line.revenue,
        gp_pct: line.gp_pct,
        gp_value: line.gp_value,
        af_pct: line.af_pct,
        af_value: line.af_value,
        fx_rate_to_egp: line.fx_rate_to_egp,
        cost_egp: line.cost_egp,
        revenue_egp: line.revenue_egp,
        gp_value_egp: line.gp_value_egp,
        af_value_egp: line.af_value_egp,
      };

  // Cost Detail path: persist deliverables + rolled Master in one UPDATE.
  // Line-Master path (Commercial Workspace / bulk): strip deliverable commercial
  // amounts in the same UPDATE so remount cannot rebuild from stale Cost Detail.
  if (input.deliverables !== undefined) {
    patch.deliverables = useRolled
      ? input.deliverables
      : stripDeliverableCommercialAmounts(input.deliverables);
  } else {
    const { data: existingRow, error: existingError } = await supabase
      .from("quotation_items")
      .select("deliverables")
      .eq("id", input.item_id)
      .maybeSingle();
    if (existingError) return { ok: false as const, message: existingError.message };
    const cleared = deliverablesPatchForLineMasterSave(
      (existingRow?.deliverables as unknown as QuotationDeliverable[] | null) ?? []
    );
    if (cleared) patch.deliverables = cleared;
  }

  if (input.option_number !== undefined) {
    patch.option_number =
      input.option_number == null
        ? null
        : Math.max(1, Math.floor(input.option_number));
  }
  if (input.service_description !== undefined) {
    patch.service_description = input.service_description?.trim() || null;
  }
  if (input.platform !== undefined) patch.platform = input.platform;
  if (input.handle !== undefined) patch.handle = input.handle;
  if (input.followers !== undefined) patch.followers = input.followers;
  if (input.engagement_rate !== undefined) patch.engagement_rate = input.engagement_rate;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from("quotation_items")
      .update(patch as never)
      .eq("id", input.item_id);
    if (error) return { ok: false as const, message: error.message };
  }

  // Sync service already recalculates when linked; still recompute unless deferred.
  const totals = options?.skipTotalsRecompute
    ? null
    : await recomputeQuotationTotals(supabase, input.quotation_id);

  await syncQuotationChangeToShortlist(supabase, {
    quotationId: input.quotation_id,
    actorId: userId,
    quotationItemId: input.item_id,
    event:
      input.deliverables ||
      input.service_description !== undefined ||
      input.platform !== undefined
        ? "deliverables"
        : "commercial",
  });

  return {
    ok: true as const,
    totals,
    fx_rate_to_egp: line.fx_rate_to_egp,
    commercialSynced: gate.synced,
  };
}

export async function removeQuotationItemWithSync(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: { item_id: string; quotation_id: string }
) {
  await syncQuotationChangeToShortlist(supabase, {
    quotationId: input.quotation_id,
    actorId: userId,
    quotationItemId: input.item_id,
    event: "remove",
  });

  const { error } = await supabase
    .from("quotation_items")
    .delete()
    .eq("id", input.item_id);
  if (error) return { ok: false as const, message: error.message };

  await syncCollapsePackageOptionNumbers(supabase, input.quotation_id);
  await recomputeQuotationTotals(supabase, input.quotation_id);
  return { ok: true as const };
}

async function ensureCreatorOnLinkedShortlist(
  supabase: SupabaseClient<Database>,
  shortlistId: string,
  item: Record<string, unknown>,
  userId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const unifiedId = (item.unified_id as string | null) ?? null;
  const influencerId = (item.influencer_id as string | null) ?? null;
  const profileId = (item.profile_id as string | null) ?? null;

  if (!unifiedId && !influencerId && !profileId) {
    return { ok: false, message: "This line has no linked creator profile." };
  }

  let existingQuery = supabase
    .from("discovery_shortlist_items")
    .select("id")
    .eq("shortlist_id", shortlistId);

  if (unifiedId) existingQuery = existingQuery.eq("unified_id", unifiedId);
  else if (influencerId) existingQuery = existingQuery.eq("influencer_id", influencerId);
  else if (profileId) existingQuery = existingQuery.eq("profile_id", profileId);

  const { data: existing } = await existingQuery.maybeSingle();
  if (existing?.id) return { ok: true };

  const { data: maxRow } = await supabase
    .from("discovery_shortlist_items")
    .select("sort_order")
    .eq("shortlist_id", shortlistId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = Number((maxRow as { sort_order?: number } | null)?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("discovery_shortlist_items").insert({
    shortlist_id: shortlistId,
    influencer_id: influencerId,
    profile_id: profileId,
    unified_id: unifiedId,
    added_by: userId,
    commercial_input_mode: item.commercial_input_mode,
    cost: item.cost,
    cost_currency: item.cost_currency,
    revenue: item.revenue,
    gp_pct: item.gp_pct,
    gp_value: item.gp_value,
    cost_egp: item.cost_egp,
    revenue_egp: item.revenue_egp,
    gp_value_egp: item.gp_value_egp,
    deliverables: item.deliverables,
    service_description: item.service_description,
    option_number: item.option_number,
    sort_order: sortOrder,
  } as never);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function returnQuotationItemToShortlist(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: { item_id: string; quotation_id: string }
) {
  const { data: quotation, error: quotationError } = await supabase
    .from("quotations")
    .select("shortlist_id")
    .eq("id", input.quotation_id)
    .maybeSingle();

  if (quotationError) return { ok: false as const, message: quotationError.message };
  const shortlistId = (quotation as { shortlist_id: string | null } | null)?.shortlist_id;
  if (!shortlistId) {
    return { ok: false as const, message: "This quotation is not linked to a shortlist." };
  }

  const { data: item, error: itemError } = await supabase
    .from("quotation_items")
    .select("*")
    .eq("id", input.item_id)
    .eq("quotation_id", input.quotation_id)
    .maybeSingle();

  if (itemError) return { ok: false as const, message: itemError.message };
  if (!item) return { ok: false as const, message: "Quotation line not found." };

  const ensured = await ensureCreatorOnLinkedShortlist(
    supabase,
    shortlistId,
    item as Record<string, unknown>,
    userId
  );
  if (!ensured.ok) return ensured;

  const { error: deleteError } = await supabase
    .from("quotation_items")
    .delete()
    .eq("id", input.item_id);
  if (deleteError) return { ok: false as const, message: deleteError.message };

  await recomputeQuotationTotals(supabase, input.quotation_id);
  return { ok: true as const, message: "Creator returned to shortlist." };
}
