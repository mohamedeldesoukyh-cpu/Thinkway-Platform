import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveOperationalPo } from "@/lib/finance/po/operational-budget";
import { resolveLinePoBillableBase } from "@/lib/finance/po/billable-base";
import {
  ensureBillableDeliverablesForLine,
  markDeliverablesReadyToInvoice,
} from "@/lib/billing/sync-deliverable-billing";
import {
  approveOperationalRows,
  markOperationalRowsReadyToInvoice,
  resolveBulkBillingTargets,
} from "@/lib/billing/sync-operational-row-billing";
import { lineBillingPatch, type BillingMutationResult } from "./billing-helpers";
import { insertFinancialApprovalChain } from "./repositories/billing-repository";
import type { z } from "zod";
import type {
  approveLineForBillingSchema,
  bulkOperationalBillingSchema,
  closeBillingLineSchema,
  moveLineToBillingSchema,
} from "@/lib/domains/billing/schemas";

export async function approveLineForBilling(supabase: SupabaseClient, userId: string, input: z.infer<typeof approveLineForBillingSchema>): Promise<BillingMutationResult> {const { data: line, error: fetchError } = await supabase
    .from("campaign_lines")
    .select("billing_status, document_number")
    .eq("id", input.line_id)
    .eq("campaign_header_id", input.campaign_id)
    .maybeSingle();

  if (fetchError || !line) {
    return { ok: false, message: fetchError?.message ?? "Line not found." };
  }

  if (line.billing_status !== "draft") {
    return { ok: false, message: "Only draft lines can be approved for billing." };
  }

  const { error } = await supabase
    .from("campaign_lines")
    .update({ billing_status: "approved" })
    .eq("id", input.line_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  const approvalError = await insertFinancialApprovalChain(supabase, userId, {
    entity_type: "campaign_line",
    entity_id: input.line_id,
    title: `Billing approval — ${line.document_number}`,
    description: "Campaign Manager approval for billing readiness",
    stages: ["campaign_manager"],
  });

  return {
    ok: true,
    message: approvalError
      ? "Line approved for billing. Approval workflow could not be recorded — apply billing migrations if needed."
      : "Line approved for billing.",
  };

}

export async function moveLineToBilling(supabase: SupabaseClient, userId: string, input: z.infer<typeof moveLineToBillingSchema>): Promise<BillingMutationResult> {const [{ data: line, error: fetchError }, { data: header, error: headerError }] =
    await Promise.all([
      supabase
        .from("campaign_lines")
        .select(
          "id, billing_status, document_number, po_amount, cost, revenue_before_vat, revenue, revenue_vat_percent, revenue_vat_amount, revenue_after_vat, revenue_vat_exempt, cost_before_vat, cost_vat_percent, cost_vat_amount, cost_after_vat, cost_vat_exempt, platform, campaign_header_id"
        )
        .eq("id", input.line_id)
        .eq("campaign_header_id", input.campaign_id)
        .maybeSingle(),
      supabase
        .from("campaign_headers")
        .select(
          "po_amount_campaign_currency, po_consumed_amount, po_remaining_amount, po_remaining_percent, po_status, po_expiry_date, po_override_approved"
        )
        .eq("id", input.campaign_id)
        .maybeSingle(),
    ]);

  if (fetchError || !line) {
    return { ok: false, message: fetchError?.message ?? "Line not found." };
  }

  if (headerError || !header) {
    return { ok: false, message: headerError?.message ?? "Campaign not found." };
  }

  if (!["approved", "draft"].includes(line.billing_status)) {
    return {
      ok: false,
      message: "Line must be approved before moving to billing.",
    };
  }

  const { data: siblingLines } = await supabase
    .from("campaign_lines")
    .select(
      "po_amount, revenue_before_vat, revenue, usage_rights_amount, agency_fee_percent, agency_fee_amount"
    )
    .eq("campaign_header_id", input.campaign_id);

  const legacyBudget = (siblingLines ?? []).reduce(
    (sum, row) => sum + Number(row.po_amount ?? 0),
    0
  );
  const legacyConsumed = (siblingLines ?? []).reduce(
    (sum, row) => sum + resolveLinePoBillableBase(row),
    0
  );

  const operationalPo = resolveOperationalPo({
    po_amount_campaign_currency: header.po_amount_campaign_currency,
    po_consumed_amount: legacyConsumed,
    po_remaining_amount: null,
    po_remaining_percent: null,
    po_status: header.po_status,
    po_expiry_date: header.po_expiry_date,
    legacy_budget: legacyBudget,
    legacy_consumed: legacyConsumed,
  });

  if (
    operationalPo.po_exceeded &&
    !header.po_override_approved
  ) {
    return {
      ok: false,
      message:
        "Campaign PO exceeded. Finance override required before moving lines to billing.",
    };
  }

  if (
    !operationalPo.uses_governance &&
    Number(line.cost) > Number(line.po_amount) &&
    Number(line.po_amount) > 0
  ) {
    return {
      ok: false,
      message: "PO over-consumption detected. Finance review required before billing.",
    };
  }

  const { error } = await supabase
    .from("campaign_lines")
    .update({
      billing_status: "moved_to_billing",
      billing_moved_at: new Date().toISOString(),
    })
    .eq("id", input.line_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  const deliverableCheck = await ensureBillableDeliverablesForLine(supabase, {
    id: line.id,
    campaign_header_id: line.campaign_header_id,
    document_number: line.document_number,
    name: line.document_number,
    platform: line.platform,
    revenue: Number(line.revenue),
    revenue_before_vat: Number(line.revenue_before_vat ?? line.revenue),
    revenue_vat_percent: Number(line.revenue_vat_percent ?? 0),
    revenue_vat_amount: Number(line.revenue_vat_amount ?? 0),
    revenue_after_vat: Number(line.revenue_after_vat ?? line.revenue),
    revenue_vat_exempt: line.revenue_vat_exempt ?? false,
    cost: Number(line.cost),
    cost_before_vat: Number(line.cost_before_vat ?? line.cost),
    cost_vat_percent: Number(line.cost_vat_percent ?? 0),
    cost_vat_amount: Number(line.cost_vat_amount ?? 0),
    cost_after_vat: Number(line.cost_after_vat ?? line.cost),
    cost_vat_exempt: line.cost_vat_exempt ?? false,
    billing_status: "moved_to_billing",
  });
  if (!deliverableCheck.ok) {
    await supabase
      .from("campaign_lines")
      .update({ billing_status: line.billing_status })
      .eq("id", input.line_id);
    return { ok: false, message: deliverableCheck.message ?? "Deliverables required." };
  }
  await markDeliverablesReadyToInvoice(supabase, input.line_id);

  return { ok: true, message: "Line moved to billing queue." };

}

export async function bulkApproveOperationalBilling(supabase: SupabaseClient, userId: string, input: z.infer<typeof bulkOperationalBillingSchema>): Promise<BillingMutationResult> {const targets = resolveBulkBillingTargets(input);if (
    targets.lineIds.length === 0 &&
    targets.deliverableIds.length === 0 &&
    targets.postIds.length === 0
  ) {
    return { ok: false, message: "Select at least one row to approve." };
  }

  let approved = 0;
  let skipped = 0;

  if (targets.hasGranularSelection) {
    const { updated, error } = await approveOperationalRows(
      supabase,
      input.campaign_id,
      targets
    );
    if (error) {
      return { ok: false, message: error };
    }
    approved += updated;
  }

  for (const lineId of targets.lineIds) {
    const result = await approveLineForBilling(supabase, userId, { line_id: lineId, campaign_id: input.campaign_id });
    if (result.ok) approved += 1;
    else skipped += 1;
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[bulk-billing] approve", {
      approved,
      skipped,
      granular: targets.hasGranularSelection,
      lineIds: targets.lineIds,
      deliverableIds: targets.deliverableIds,
      postIds: targets.postIds,
    });
  }

  return {
    ok: approved > 0,
    message:
      approved > 0
        ? `Approved ${approved} row${approved === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped)` : ""}.`
        : "No rows were approved.",
  };

}

export async function bulkMoveOperationalBilling(supabase: SupabaseClient, userId: string, input: z.infer<typeof bulkOperationalBillingSchema>): Promise<BillingMutationResult> {const targets = resolveBulkBillingTargets(input);if (
    targets.lineIds.length === 0 &&
    targets.deliverableIds.length === 0 &&
    targets.postIds.length === 0
  ) {
    return { ok: false, message: "Select at least one row to move." };
  }

  let moved = 0;
  let skipped = 0;

  if (targets.hasGranularSelection) {
    const { updated, error } = await markOperationalRowsReadyToInvoice(
      supabase,
      input.campaign_id,
      targets
    );
    if (error) {
      return { ok: false, message: error };
    }
    moved += updated;
  }

  for (const lineId of targets.lineIds) {
    const result = await moveLineToBilling(supabase, userId, { line_id: lineId, campaign_id: input.campaign_id });
    if (result.ok) moved += 1;
    else skipped += 1;
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[bulk-billing] move to billing", {
      moved,
      skipped,
      granular: targets.hasGranularSelection,
      lineIds: targets.lineIds,
      deliverableIds: targets.deliverableIds,
      postIds: targets.postIds,
    });
  }

  return {
    ok: moved > 0,
    message:
      moved > 0
        ? `Moved ${moved} row${moved === 1 ? "" : "s"} to billing${skipped ? ` (${skipped} skipped)` : ""}.`
        : "No rows were moved to billing.",
  };

}

export async function closeBillingLine(supabase: SupabaseClient, userId: string, input: z.infer<typeof closeBillingLineSchema>): Promise<BillingMutationResult> {const { error } = await supabase
    .from("campaign_lines")
    .update(lineBillingPatch("closed"))
    .eq("id", input.line_id)
    .eq("campaign_header_id", input.campaign_id)
    .in("billing_status", ["paid", "partially_paid"]);

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, message: "Billing line closed." };

}


import { REL } from "@/lib/supabase/relation-hints";
import type { PoStatus } from "@/lib/finance/po/status";
import {
  assignmentDeliverableBillingSelect,
  queryAssignmentDeliverables,
  resolveDeliverableVatExempt,
} from "@/lib/billing/assignment-deliverable-queries";
import {
  deliverableDisplayLabel,
  rollupAssignmentBilling,
  type DeliverableBillingRow,
} from "@/lib/billing/deliverable-billing";
import { queryCampaignLinesWithDisplayOrder } from "@/lib/campaigns/line-ordering";
import { parseLineAssignment, platformLabel } from "@/lib/campaigns/line-assignment";
import { devLog } from "@/lib/platform/logger";
import {
  loadCampaignInvoiceLineRollups,
  reconcileCampaignRollupWithInvoiceLines,
} from "@/lib/billing/invoice-operational-aggregation";
import { loadCampaignOperationalBilling } from "@/lib/billing/operational-billing-query";
import {
  formatMarginPercent,
  type AssignmentBillingGroup,
  type BillingLineRow,
  type CampaignLineBillingStatus,
  type CampaignOperationalBillingDetail,
} from "@/lib/domains/billing/types";

type LineQueryRow = {
  id: string;
  document_number: string;
  name: string;
  campaign_header_id: string;
  billing_status: CampaignLineBillingStatus;
  revenue: number;
  revenue_before_vat?: number;
  usage_rights_amount?: number;
  agency_fee_percent?: number;
  agency_fee_amount?: number | null;
  cost: number;
  profit: number;
  revenue_vat_amount?: number;
  cost_vat_amount?: number;
  po_amount: number;
  po_consumed: number;
  remaining_po: number;
  revenue_locked: boolean;
  cost_locked: boolean;
  vendor_assignment_locked: boolean;
  currency_code: string;
  invoice_id: string | null;
  header: {
    id: string;
    name: string;
    document_number: string;
    po_amount_campaign_currency?: number | null;
    po_consumed_amount?: number | null;
    po_remaining_amount?: number | null;
    po_remaining_percent?: number | null;
    po_status?: PoStatus | null;
    po_expiry_date?: string | null;
    client: { name: string } | null;
    brand: { name: string } | null;
  } | null;
  invoice: { document_number: string } | null;
};

function aggregateOperationalPoKpis(
  rawLines: {
    campaign_header_id: string;
    po_amount: number;
  revenue_before_vat?: number;
  revenue: number;
  usage_rights_amount?: number;
  agency_fee_percent?: number;
  agency_fee_amount?: number | null;
  header: LineQueryRow["header"];
  }[]
) {
  const headerMap = new Map<
    string,
    {
      po_amount_campaign_currency: number | null;
      po_consumed_amount: number | null;
      po_remaining_amount: number | null;
      po_remaining_percent: number | null;
      po_status: PoStatus | null;
      po_expiry_date: string | null;
      legacy_budget: number;
      legacy_consumed: number;
    }
  >();

  for (const row of rawLines) {
    const headerId = row.campaign_header_id;
    let entry = headerMap.get(headerId);
    if (!entry) {
      entry = {
        po_amount_campaign_currency:
          row.header?.po_amount_campaign_currency ?? null,
        po_consumed_amount: row.header?.po_consumed_amount ?? null,
        po_remaining_amount: row.header?.po_remaining_amount ?? null,
        po_remaining_percent: row.header?.po_remaining_percent ?? null,
        po_status: row.header?.po_status ?? null,
        po_expiry_date: row.header?.po_expiry_date ?? null,
        legacy_budget: 0,
        legacy_consumed: 0,
      };
      headerMap.set(headerId, entry);
    }
    entry.legacy_budget += row.po_amount;
    entry.legacy_consumed += resolveLinePoBillableBase(row);
  }

  let po_total = 0;
  let po_consumed = 0;
  let po_remaining = 0;
  let po_over_consumed_count = 0;

  for (const entry of headerMap.values()) {
    const operational = resolveOperationalPo({
      po_amount_campaign_currency: entry.po_amount_campaign_currency,
      po_consumed_amount: entry.legacy_consumed,
      po_remaining_amount: null,
      po_remaining_percent: null,
      po_status: entry.po_status,
      po_expiry_date: entry.po_expiry_date,
      legacy_budget: entry.legacy_budget,
      legacy_consumed: entry.legacy_consumed,
    });
    po_total += operational.po_amount;
    po_consumed += operational.po_consumed;
    po_remaining += operational.po_remaining;
    if (operational.po_exceeded) {
      po_over_consumed_count += 1;
    }
  }

  return { po_total, po_consumed, po_remaining, po_over_consumed_count };
}


export async function getCampaignBillingLines(supabase: SupabaseClient, campaignId: string): Promise<BillingLineRow[]> {
    const { data, error } = await supabase
    .from("campaign_lines")
    .select(
      `
        id, document_number, name, campaign_header_id, billing_status, metadata,
        revenue, revenue_before_vat, usage_rights_amount, agency_fee_percent, agency_fee_amount,
        cost, profit, po_amount, po_consumed, remaining_po,
        revenue_locked, cost_locked, vendor_assignment_locked,
        currency_code, invoice_id,
        header:${REL.campaignLines.campaignHeader}(id, name, document_number,
          client:clients(name),
          brand:brands(name)
        ),
        invoice:invoices(document_number)
      `
    )
    .eq("campaign_header_id", campaignId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (process.env.NODE_ENV === "development") {
      devLog("[analytics-fallback] getCampaignBillingLines query failed", error.message);
    }
    return [];
  }

  return ((data ?? []) as unknown as LineQueryRow[]).map((row) => {
    const revenue = Number(row.revenue);
    const cost = Number(row.cost);
    const gp = Number(row.profit);
    const poAmount = Number(row.po_amount);
    const poConsumed = resolveLinePoBillableBase(row);
    return {
      id: row.id,
      document_number: row.document_number,
      name: row.name,
      campaign_header_id: row.campaign_header_id,
      campaign_name: row.header?.name ?? "",
      campaign_document_number: row.header?.document_number ?? "",
      client_name: row.header?.client?.name ?? "",
      brand_name: row.header?.brand?.name ?? null,
      billing_status: row.billing_status,
      revenue,
      cost,
      gp,
      margin_percent: formatMarginPercent(revenue, gp),
      po_amount: poAmount,
      po_consumed: poConsumed,
      remaining_po: Number(row.remaining_po),
      po_over_consumed: poConsumed > poAmount && poAmount > 0,
      revenue_locked: row.revenue_locked,
      cost_locked: row.cost_locked,
      vendor_assignment_locked: row.vendor_assignment_locked,
      currency_code: row.currency_code,
      invoice_id: row.invoice_id,
      invoice_document_number: row.invoice?.document_number ?? null,
    } satisfies BillingLineRow;
  });
}

export async function getCampaignBillingGroups(supabase: SupabaseClient, campaignId: string): Promise<AssignmentBillingGroup[]> {
    type CampaignLineBillingQueryRow = {
    id: string;
    document_number: string;
    name: string;
    billing_status: CampaignLineBillingStatus;
    currency_code: string;
    pricing_mode: string | null;
    revenue: number;
    revenue_before_vat?: number;
    usage_rights_amount?: number;
    agency_fee_percent?: number;
    agency_fee_amount?: number | null;
    po_amount: number;
    po_consumed: number;
    revenue_locked: boolean;
    cost_locked: boolean;
    vendor_assignment_locked: boolean;
    invoice_id: string | null;
    metadata: Record<string, unknown> | null;
    invoice: { document_number: string } | null;
  };

  const lineSelectWithSort =
    "id, document_number, name, billing_status, currency_code, pricing_mode, revenue, revenue_before_vat, usage_rights_amount, agency_fee_percent, agency_fee_amount, cost, po_amount, po_consumed, remaining_po, revenue_locked, cost_locked, vendor_assignment_locked, invoice_id, metadata, sort_order, invoice:invoices(document_number)";

  const lineSelectFallback =
    "id, document_number, name, billing_status, currency_code, pricing_mode, revenue, revenue_before_vat, usage_rights_amount, agency_fee_percent, agency_fee_amount, cost, po_amount, po_consumed, remaining_po, revenue_locked, cost_locked, vendor_assignment_locked, invoice_id, metadata, invoice:invoices(document_number)";

  const { data: lines, error: linesError } =
    await queryCampaignLinesWithDisplayOrder<CampaignLineBillingQueryRow>(
      async (orderColumn, includeSortOrderColumn) => {
        const result = await supabase
          .from("campaign_lines")
          .select(includeSortOrderColumn ? lineSelectWithSort : lineSelectFallback)
          .eq("campaign_header_id", campaignId)
          .order(orderColumn, { ascending: true });
        return {
          data: (result.data ?? null) as CampaignLineBillingQueryRow[] | null,
          error: result.error,
        };
      }
    );

  if (linesError) throw new Error(linesError);

  const lineIds = lines.map((l) => l.id);
  if (lineIds.length === 0) return [];

  const {
    data: deliverableRows,
    error: deliverableError,
    includesVatExempt,
  } = await queryAssignmentDeliverables<
    Omit<DeliverableBillingRow, "label"> & { revenue_vat_exempt?: boolean | null }
  >(async (select) => {
    const result = await supabase
      .from("assignment_deliverables")
      .select(select)
      .in("campaign_line_id", lineIds)
      .order("sort_order");
    return {
      data: (result.data ?? null) as Array<
        Omit<DeliverableBillingRow, "label"> & { revenue_vat_exempt?: boolean | null }
      > | null,
      error: result.error,
    };
  });

  if (deliverableError) throw new Error(deliverableError);

  const deliverablesByLine = new Map<string, DeliverableBillingRow[]>();
  for (const row of deliverableRows ?? []) {
    const typed = row as unknown as Omit<DeliverableBillingRow, "label">;
    const mapped: DeliverableBillingRow = {
      ...typed,
      billable_amount: Number(typed.billable_amount),
      invoiced_amount: Number(typed.invoiced_amount),
      collected_amount: Number(typed.collected_amount),
      disputed_amount: Number(typed.disputed_amount),
      remaining_amount: Number(typed.remaining_amount),
      revenue_before_vat: Number(typed.revenue_before_vat),
      revenue_vat_percent: Number(typed.revenue_vat_percent ?? 0),
      revenue_vat_exempt: resolveDeliverableVatExempt(typed, includesVatExempt),
      label: deliverableDisplayLabel(typed),
    };
    const list = deliverablesByLine.get(typed.campaign_line_id) ?? [];
    list.push(mapped);
    deliverablesByLine.set(typed.campaign_line_id, list);
  }

  return lines.map((line) => {
    const row = line;

    const assignment = parseLineAssignment(row.metadata);
    const deliverables = deliverablesByLine.get(row.id) ?? [];
    const rollups = rollupAssignmentBilling(deliverables);
    const poAmount = Number(row.po_amount);
    const poConsumed = resolveLinePoBillableBase(row);

    return {
      line_id: row.id,
      document_number: row.document_number,
      name: row.name,
      influencer_name: assignment?.influencer_name ?? null,
      platform_summary: assignment
        ? assignment.platforms.map((p) => platformLabel(p.platform)).join(", ")
        : null,
      billing_status: row.billing_status,
      currency_code: row.currency_code,
      pricing_mode: row.pricing_mode ?? assignment?.pricing_mode ?? "package",
      deliverables,
      ...rollups,
      revenue_locked: row.revenue_locked,
      cost_locked: row.cost_locked,
      vendor_assignment_locked: row.vendor_assignment_locked,
      invoice_id: row.invoice_id,
      invoice_document_number: row.invoice?.document_number ?? null,
      po_over_consumed: poConsumed > poAmount && poAmount > 0,
      po_amount: poAmount,
      po_consumed: poConsumed,
    } satisfies AssignmentBillingGroup;
  });
}

export async function getCampaignOperationalBillingDetail(supabase: SupabaseClient, campaignId: string): Promise<CampaignOperationalBillingDetail | null> {
    const { data: header, error: headerError } = await supabase
    .from("campaign_headers")
    .select("id, currency_code, client_id")
    .eq("id", campaignId)
    .maybeSingle();

  if (headerError || !header) return null;

  const { traceOperationalTreeStage, logCampaignWorkspaceLoadError } =
    await import("@/lib/billing/operational-billing-trace");

  let groups: Awaited<ReturnType<typeof loadCampaignOperationalBilling>>["groups"];
  let operational_rows: Awaited<
    ReturnType<typeof loadCampaignOperationalBilling>
  >["operational_rows"];
  let error: string | undefined;

  try {
    try {
      const { prepareCampaignCommercialForInvoice } = await import(
        "@/lib/billing/repair-invoice-create-pipeline"
      );
      await prepareCampaignCommercialForInvoice(supabase, campaignId);
    } catch {
      // Commercial sync is best-effort before operational billing read.
    }

    const loaded = await loadCampaignOperationalBilling(supabase, campaignId);
    groups = loaded.groups;
    operational_rows = loaded.operational_rows;
    error = loaded.error;
    traceOperationalTreeStage(
      "getCampaignOperationalBillingDetail:loaded",
      operational_rows
    );
  } catch (loadError) {
    logCampaignWorkspaceLoadError("getCampaignOperationalBillingDetail", loadError, {
      campaignId,
    });
    throw loadError;
  }

  if (error) {
    throw new Error(error);
  }

  const { isInvoiceAppendable } = await import("@/lib/billing/campaign-billing-queue");
  const { computeCampaignFinancialRollup } = await import(
    "@/lib/billing/operational-financial-sync"
  );
  const { resolveClientBillingVatRate } = await import("@/lib/vat/queries");
  const { vatRate: default_vat_percent } = await resolveClientBillingVatRate(
    supabase,
    header.client_id
  );

  const legacyRevenue = groups.reduce((sum, group) => sum + group.total_value, 0);
  const legacyInvoiced = groups.reduce((sum, group) => sum + group.invoiced_value, 0);
  const baseRollup = computeCampaignFinancialRollup({
    operational_rows,
    legacy_line_revenue: legacyRevenue,
    legacy_invoiced: legacyInvoiced,
  });

  const lineRollups = await loadCampaignInvoiceLineRollups(supabase, [campaignId]);
  const lineInvoiced = lineRollups.get(campaignId)?.invoiced_subtotal ?? 0;
  const reconciled = reconcileCampaignRollupWithInvoiceLines({
    ...baseRollup,
    invoice_line_invoiced: lineInvoiced,
  });
  const rollup = { ...baseRollup, ...reconciled };

  const { data: invoiceRows } = await supabase
    .from("invoices")
    .select(
      "id, document_number, status, regeneration_status, is_operational_locked, total, subtotal, tax_amount, currency, client_id, campaign_header_id"
    )
    .eq("campaign_header_id", campaignId)
    .not("status", "eq", "void");

  const appendable_invoices = (invoiceRows ?? [])
    .map((inv) => {
      const row = inv as unknown as {
        id: string;
        document_number: string;
        status: string;
        regeneration_status: string | null;
        is_operational_locked?: boolean | null;
        total: number;
        subtotal: number;
        tax_amount: number;
        currency: string;
        client_id: string;
        campaign_header_id: string | null;
      };
      const appendable = isInvoiceAppendable({
        status: row.status,
        regeneration_status: row.regeneration_status,
        is_operational_locked: row.is_operational_locked,
        currency: row.currency,
        client_id: row.client_id,
        campaign_header_id: row.campaign_header_id,
        target_currency: header.currency_code,
        target_client_id: header.client_id,
        target_campaign_id: campaignId,
      });
      if (!appendable) return null;
      return {
        id: row.id,
        document_number: row.document_number,
        status: row.status,
        regeneration_status: row.regeneration_status ?? "active",
        total: Number(row.total),
        subtotal: Number(row.subtotal ?? 0),
        tax_amount: Number(row.tax_amount ?? 0),
        currency: row.currency,
        client_id: row.client_id,
        campaign_header_id: row.campaign_header_id,
        is_locked: Boolean(row.is_operational_locked),
      };
    })
    .filter(Boolean) as CampaignOperationalBillingDetail["appendable_invoices"];

  if (process.env.NODE_ENV === "development") {
    console.debug("[billing-drilldown] loaded campaign detail", {
      campaignId,
      assignments: operational_rows.length,
      appendableInvoices: appendable_invoices.length,
      rollup,
    });
  }

  traceOperationalTreeStage(
    "getCampaignOperationalBillingDetail:return",
    operational_rows
  );

  return {
    campaign_header_id: campaignId,
    currency_code: header.currency_code,
    default_vat_percent,
    groups,
    operational_rows,
    rollup,
    appendable_invoices,
  };
}

