/**
 * Supabase-backed CommercialSyncPorts (Phase 2).
 * Compensating rollback on partial failure (PostgREST has no multi-table txn).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveRateToEgp } from "@/lib/commercial/fx-server";
import {
  computeQuotationTotals,
  normalizeCommercialLine,
} from "@/lib/commercial/quotation-engine";
import {
  fetchQuotationItemEgpTotals,
  updateQuotationHeaderRecord,
} from "@/lib/services/quotations/repositories/quotation-repository";
import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import { deliverablesPatchForLineMasterSave } from "@/lib/quotations/quotation-line-commercial-ssot";
import type { CommercialInputMode, Database } from "@/types/database";

import { isCampaignFinanceLocked } from "@/lib/finance/campaign-finance-lock";

import { createSupabaseAuditWriter } from "./commercial-audit";
import { buildRegistryEntry } from "./commercial-line-identity";
import {
  fromCampaignRow,
  fromQuotationRow,
  toCampaignColumns,
  toQuotationColumns,
} from "./field-registry";
import type {
  ApplyMasterChangeResult,
  CommercialLineId,
  CommercialLineRegistryEntry,
  CommercialSyncPorts,
  MasterCommercialValues,
} from "./types";

type Supabase = SupabaseClient<Database>;

const idempotentResults = new Map<
  string,
  Extract<ApplyMasterChangeResult, { ok: true }>
>();
const idempotentInFlight = new Set<string>();
const concurrencyTokens = new Map<string, string>();

export function createSupabaseCommercialSyncPorts(
  supabase: Supabase
): CommercialSyncPorts {
  const writeAudit = createSupabaseAuditWriter(supabase);

  const snapQuotes = new Map<string, MasterCommercialValues>();
  const snapAssignments = new Map<string, MasterCommercialValues>();
  let capturing = false;
  let restoring = false;

  const resolveFromItem = async (
    quotationItemId: string
  ): Promise<CommercialLineRegistryEntry | null> => {
    const { data: item } = await supabase
      .from("quotation_items")
      .select("id, quotation_id")
      .eq("id", quotationItemId)
      .maybeSingle();
    if (!item?.id) return null;

    const { data: lines } = await supabase
      .from("campaign_lines")
      .select("id, campaign_header_id, source_quotation_item_id")
      .eq("source_quotation_item_id", quotationItemId);

    return buildRegistryEntry({
      quotationId: (item as { quotation_id: string }).quotation_id,
      quotationItemId: item.id,
      assignments: (lines ?? []).map((l) => ({
        id: l.id as string,
        source_quotation_item_id: (l as { source_quotation_item_id?: string })
          .source_quotation_item_id,
        campaign_header_id: (l as { campaign_header_id?: string })
          .campaign_header_id,
      })),
    });
  };

  const loadQuotationMaster = async (quotationItemId: string) => {
    const { data } = await supabase
      .from("quotation_items")
      .select(
        "cost, revenue, cost_currency, fx_rate_to_egp, af_pct, commercial_input_mode, gp_pct, gp_value"
      )
      .eq("id", quotationItemId)
      .maybeSingle();
    if (!data) return null;
    return fromQuotationRow(data as Record<string, unknown>);
  };

  const loadAssignmentMaster = async (assignmentId: string) => {
    const { data } = await supabase
      .from("campaign_lines")
      .select(
        "cost, revenue, cost_before_vat, revenue_before_vat, currency_code, fx_rate, agency_fee_percent, pricing_mode, markup_margin, profit, usage_rights_amount, usage_rights_cost, revenue_vat_percent, cost_vat_percent, revenue_vat_exempt, cost_vat_exempt"
      )
      .eq("id", assignmentId)
      .maybeSingle();
    if (!data) return null;
    return fromCampaignRow(data as Record<string, unknown>);
  };

  const writeQuotationMaster = async (
    quotationItemId: string,
    values: MasterCommercialValues
  ) => {
    if (capturing && !restoring && !snapQuotes.has(quotationItemId)) {
      const current = await loadQuotationMaster(quotationItemId);
      if (current) snapQuotes.set(quotationItemId, current);
    }

    const columns = toQuotationColumns(values);
    const { data: existing } = await supabase
      .from("quotation_items")
      .select(
        "commercial_input_mode, cost, cost_currency, revenue, gp_pct, gp_value, af_pct, deliverables"
      )
      .eq("id", quotationItemId)
      .maybeSingle();
    if (!existing) throw new Error(`Unknown quotation item ${quotationItemId}`);

    const mode = String(
      columns.commercial_input_mode ??
        (existing as { commercial_input_mode: string }).commercial_input_mode ??
        "cost_revenue"
    ) as CommercialInputMode;
    const costCurrency = String(
      columns.cost_currency ??
        (existing as { cost_currency: string }).cost_currency ??
        "EGP"
    );
    const rate =
      typeof columns.fx_rate_to_egp === "number"
        ? columns.fx_rate_to_egp
        : await resolveRateToEgp(supabase, costCurrency);

    const normalized = normalizeCommercialLine({
      mode,
      cost:
        (columns.cost as number | null | undefined) ??
        (existing as { cost: number }).cost,
      costCurrency,
      gpPct:
        (columns.gp_pct as number | null | undefined) ??
        (existing as { gp_pct: number | null }).gp_pct,
      revenue:
        (columns.revenue as number | null | undefined) ??
        (existing as { revenue: number }).revenue,
      gpValue:
        (columns.gp_value as number | null | undefined) ??
        (existing as { gp_value: number | null }).gp_value,
      afPct:
        (columns.af_pct as number | null | undefined) ??
        (existing as { af_pct: number | null }).af_pct,
      fxRateToEgp: rate,
    });

    const patch: Record<string, unknown> = {
      commercial_input_mode: normalized.commercial_input_mode,
      cost: normalized.cost,
      cost_currency: normalized.cost_currency,
      revenue: normalized.revenue,
      gp_pct: normalized.gp_pct,
      gp_value: normalized.gp_value,
      af_pct: normalized.af_pct,
      af_value: normalized.af_value,
      fx_rate_to_egp: normalized.fx_rate_to_egp,
      cost_egp: normalized.cost_egp,
      revenue_egp: normalized.revenue_egp,
      gp_value_egp: normalized.gp_value_egp,
      af_value_egp: normalized.af_value_egp,
    };
    const cleared = deliverablesPatchForLineMasterSave(
      (existing.deliverables as unknown as QuotationDeliverable[] | null) ?? []
    );
    if (cleared) patch.deliverables = cleared;

    const { error } = await supabase
      .from("quotation_items")
      .update(patch as never)
      .eq("id", quotationItemId);
    if (error) throw new Error(error.message);
  };

  const writeAssignmentMaster = async (
    assignmentId: string,
    values: MasterCommercialValues
  ) => {
    if (capturing && !restoring && !snapAssignments.has(assignmentId)) {
      const current = await loadAssignmentMaster(assignmentId);
      if (current) snapAssignments.set(assignmentId, current);
    }

    const columns = toCampaignColumns(values);
    if (Object.keys(columns).length === 0) return;

    const cost = numberOrUndef(columns.cost_before_vat ?? columns.cost);
    const revenue = numberOrUndef(columns.revenue_before_vat ?? columns.revenue);
    if (cost != null && revenue != null) {
      columns.profit = Math.round((revenue - cost) * 100) / 100;
      columns.profit_margin =
        revenue > 0
          ? Math.round(((revenue - cost) / revenue) * 10000) / 100
          : 0;
    }

    const { error } = await supabase
      .from("campaign_lines")
      .update(columns as never)
      .eq("id", assignmentId);
    if (error) throw new Error(error.message);
  };

  return {
    resolveByCommercialLineId: resolveFromItem,
    resolveByQuotationItemId: resolveFromItem,
    resolveByAssignmentId: async (assignmentId) => {
      const { data: line } = await supabase
        .from("campaign_lines")
        .select("source_quotation_item_id")
        .eq("id", assignmentId)
        .maybeSingle();
      const cml = (line as { source_quotation_item_id?: string | null } | null)
        ?.source_quotation_item_id;
      if (!cml) return null;
      return resolveFromItem(cml);
    },
    loadQuotationMaster,
    loadAssignmentMaster,
    writeQuotationMaster,
    writeAssignmentMaster,
    recalculateQuotationDerived: async (quotationId) => {
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
    },
    recalculateCampaignDerived: async () => {
      // Profit/margin updated on assignment write; header KPIs refresh on load.
    },
    isFinanceLocked: async (campaignHeaderId) =>
      isCampaignFinanceLocked(supabase, campaignHeaderId),
    writeAudit,
    runInTransaction: async (work) => {
      snapQuotes.clear();
      snapAssignments.clear();
      capturing = true;
      restoring = false;
      try {
        return await work();
      } catch (error) {
        restoring = true;
        for (const [id, values] of snapQuotes) {
          await writeQuotationMaster(id, values);
        }
        for (const [id, values] of snapAssignments) {
          await writeAssignmentMaster(id, values);
        }
        throw error;
      } finally {
        capturing = false;
        restoring = false;
        snapQuotes.clear();
        snapAssignments.clear();
      }
    },
    loadConcurrencyToken: async (commercialLineId: CommercialLineId) => {
      if (concurrencyTokens.has(commercialLineId)) {
        return concurrencyTokens.get(commercialLineId) ?? null;
      }
      const { data } = await supabase
        .from("quotation_items")
        .select(
          "id, cost, revenue, af_pct, cost_currency, fx_rate_to_egp, gp_pct, gp_value"
        )
        .eq("id", commercialLineId)
        .maybeSingle();
      return data ? JSON.stringify(data) : null;
    },
    storeConcurrencyToken: async (commercialLineId, token) => {
      concurrencyTokens.set(commercialLineId, token);
    },
    getIdempotentResult: async (key) => idempotentResults.get(key) ?? null,
    putIdempotentResult: async (key, result) => {
      idempotentResults.set(key, result);
    },
    tryBeginIdempotent: async (key) => {
      if (idempotentInFlight.has(key)) return false;
      idempotentInFlight.add(key);
      return true;
    },
    endIdempotent: async (key) => {
      idempotentInFlight.delete(key);
    },
  };
}

function numberOrUndef(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
