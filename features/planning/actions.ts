"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { planningDb } from "@/lib/supabase/governance-client";
import { buildBudgetPeriodSeeds } from "@/lib/planning/budgets/period-builder";
import {
  canTransitionBudgetStatus,
  PLANNING_AUDIT_ACTIONS,
} from "@/lib/planning/approvals/approval-rules";
import { budgetVersionAllowsLineWrite } from "@/lib/planning/budgets/budget-status";
import { invalidatePlanningCache } from "@/lib/planning/queries/planning-cache";
import type { BudgetPeriodType, BudgetVersionStatus } from "@/lib/planning/types/budget";
import { devLog } from "@/lib/platform/logger";

const PLANNING_PATH = "/planning";

async function getSupabase() {
  return createSupabaseServerClient();
}

async function logPlanningAudit(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  input: {
    action: string;
    entityType: string;
    entityId: string;
    userId: string;
    payload?: Record<string, unknown>;
  }
) {
  const { error } = await planningDb(supabase).from("planning_audit_logs").insert({
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    actor_id: input.userId,
    metadata: input.payload ?? {},
  } as never);
  if (error && process.env.NODE_ENV === "development") {
    devLog("[budget-workspace] audit log skipped", error.message);
  }
}

function nextDocumentNumber(prefix: string, fiscalYear: number): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  return `${prefix}-${fiscalYear}-${stamp}`;
}

export type PlanningActionResult = { ok: true } | { ok: false; error: string };

export async function createBudgetVersionAction(input: {
  name: string;
  fiscalYear: number;
  currencyCode: string;
  periodType: BudgetPeriodType;
  notes?: string;
}): Promise<PlanningActionResult & { versionId?: string }> {
  const supabase = await getSupabase();
  const auth = await requirePermission(supabase, "planning.write");
  if ("error" in auth) return { ok: false, error: auth.error };

  const documentNumber = nextDocumentNumber("BUD", input.fiscalYear);
  const { data: version, error } = await planningDb(supabase)
    .from("budget_versions")
    .insert({
      document_number: documentNumber,
      name: input.name.trim(),
      fiscal_year: input.fiscalYear,
      currency_code: input.currencyCode,
      status: "draft",
      notes: input.notes?.trim() ?? null,
      created_by: auth.userId,
    } as never)
    .select("id")
    .single();

  if (error || !version) {
    return { ok: false, error: error?.message ?? "Failed to create budget version." };
  }

  const periods = buildBudgetPeriodSeeds(input.fiscalYear, input.periodType);
  const { error: periodError } = await planningDb(supabase)
    .from("budget_periods")
    .insert(
      periods.map((p) => ({
        budget_version_id: version.id,
        period_type: p.period_type,
        period_key: p.period_key,
        period_start: p.period_start,
        period_end: p.period_end,
        sort_order: p.sort_order,
      })) as never
    );

  if (periodError) {
    return { ok: false, error: periodError.message };
  }

  await logPlanningAudit(supabase, {
    action: PLANNING_AUDIT_ACTIONS.version_created,
    entityType: "budget_version",
    entityId: version.id,
    userId: auth.userId,
    payload: { fiscalYear: input.fiscalYear, periodType: input.periodType },
  });

  invalidatePlanningCache();
  revalidatePath(PLANNING_PATH);
  devLog("[budget-workspace] version created", version.id);
  return { ok: true, versionId: version.id };
}

export async function updateBudgetVersionAction(input: {
  id: string;
  name?: string;
  notes?: string;
}): Promise<PlanningActionResult> {
  const supabase = await getSupabase();
  const auth = await requirePermission(supabase, "planning.write");
  if ("error" in auth) return { ok: false, error: auth.error };

  const patch: Record<string, string | null> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.notes !== undefined) patch.notes = input.notes?.trim() ?? null;

  const { error } = await planningDb(supabase)
    .from("budget_versions")
    .update(patch as never)
    .eq("id", input.id)
    .eq("status", "draft");

  if (error) return { ok: false, error: error.message };

  invalidatePlanningCache();
  revalidatePath(PLANNING_PATH);
  return { ok: true };
}

export async function transitionBudgetVersionStatusAction(input: {
  id: string;
  from: BudgetVersionStatus;
  to: BudgetVersionStatus;
}): Promise<PlanningActionResult> {
  const supabase = await getSupabase();
  const permission =
    input.to === "submitted" || input.to === "approved" || input.to === "locked"
      ? "planning.approve"
      : "planning.write";
  const auth = await requirePermission(supabase, permission);
  if ("error" in auth) return { ok: false, error: auth.error };

  if (!canTransitionBudgetStatus(input.from, input.to)) {
    return { ok: false, error: `Cannot transition from ${input.from} to ${input.to}.` };
  }

  const now = new Date().toISOString();
  const patch: Record<string, string | null> = { status: input.to };
  if (input.to === "submitted") patch.submitted_at = now;
  if (input.to === "approved") patch.approved_at = now;
  if (input.to === "locked") patch.locked_at = now;
  if (input.to === "archived") patch.archived_at = now;

  const { error } = await planningDb(supabase)
    .from("budget_versions")
    .update(patch as never)
    .eq("id", input.id)
    .eq("status", input.from);

  if (error) return { ok: false, error: error.message };

  const auditKey =
    input.to === "submitted"
      ? PLANNING_AUDIT_ACTIONS.version_submitted
      : input.to === "approved"
        ? PLANNING_AUDIT_ACTIONS.version_approved
        : input.to === "locked"
          ? PLANNING_AUDIT_ACTIONS.version_locked
          : PLANNING_AUDIT_ACTIONS.version_archived;

  await logPlanningAudit(supabase, {
    action: auditKey,
    entityType: "budget_version",
    entityId: input.id,
    userId: auth.userId,
    payload: { from: input.from, to: input.to },
  });

  invalidatePlanningCache();
  revalidatePath(PLANNING_PATH);
  return { ok: true };
}

export async function duplicateBudgetVersionAction(
  sourceId: string
): Promise<PlanningActionResult & { versionId?: string }> {
  const supabase = await getSupabase();
  const auth = await requirePermission(supabase, "planning.write");
  if ("error" in auth) return { ok: false, error: auth.error };

  const { data: source, error: sourceError } = await planningDb(supabase)
    .from("budget_versions")
    .select(
      "id, name, fiscal_year, currency_code, version_number, scenario_id, notes"
    )
    .eq("id", sourceId)
    .maybeSingle();

  if (sourceError || !source) {
    return { ok: false, error: sourceError?.message ?? "Source version not found." };
  }

  const documentNumber = nextDocumentNumber("BUD", source.fiscal_year);
  const { data: copy, error: copyError } = await planningDb(supabase)
    .from("budget_versions")
    .insert({
      document_number: documentNumber,
      name: `${source.name} (copy)`,
      fiscal_year: source.fiscal_year,
      currency_code: source.currency_code,
      status: "draft",
      version_number: (source.version_number ?? 1) + 1,
      parent_version_id: source.id,
      scenario_id: source.scenario_id,
      notes: source.notes,
      created_by: auth.userId,
    } as never)
    .select("id")
    .single();

  if (copyError || !copy) {
    return { ok: false, error: copyError?.message ?? "Duplicate failed." };
  }

  const { data: periods } = await planningDb(supabase)
    .from("budget_periods")
    .select("period_type, period_key, period_start, period_end, sort_order")
    .eq("budget_version_id", sourceId);

  if (periods?.length) {
    await planningDb(supabase)
      .from("budget_periods")
      .insert(
        periods.map((p) => ({
          budget_version_id: copy.id,
          period_type: p.period_type,
          period_key: p.period_key,
          period_start: p.period_start,
          period_end: p.period_end,
          sort_order: p.sort_order,
        })) as never
      );
  }

  const { data: lines } = await planningDb(supabase)
    .from("budget_lines")
    .select(
      `
      budget_period_id, currency_code, country_code, client_id, brand_id,
      campaign_header_id, team_id, sales_owner_id, business_unit_id, line_label,
      revenue_budget, cost_budget, gp_budget, margin_budget, collections_budget,
      vendor_cost_budget, po_budget, sort_order
    `
    )
    .eq("budget_version_id", sourceId);

  if (lines?.length) {
    const periodMap = new Map<string, string>();
    const { data: newPeriods } = await planningDb(supabase)
      .from("budget_periods")
      .select("id, period_key")
      .eq("budget_version_id", copy.id);
    const oldPeriods = await planningDb(supabase)
      .from("budget_periods")
      .select("id, period_key")
      .eq("budget_version_id", sourceId);

    for (const old of oldPeriods.data ?? []) {
      const match = (newPeriods ?? []).find((n) => n.period_key === old.period_key);
      if (match) periodMap.set(old.id, match.id);
    }

    await planningDb(supabase)
      .from("budget_lines")
      .insert(
        lines.map((line) => ({
          budget_version_id: copy.id,
          budget_period_id: line.budget_period_id
            ? periodMap.get(line.budget_period_id) ?? null
            : null,
          currency_code: line.currency_code,
          country_code: line.country_code,
          client_id: line.client_id,
          brand_id: line.brand_id,
          campaign_header_id: line.campaign_header_id,
          team_id: line.team_id,
          sales_owner_id: line.sales_owner_id,
          business_unit_id: line.business_unit_id,
          line_label: line.line_label,
          revenue_budget: line.revenue_budget,
          cost_budget: line.cost_budget,
          gp_budget: line.gp_budget,
          margin_budget: line.margin_budget,
          collections_budget: line.collections_budget,
          vendor_cost_budget: line.vendor_cost_budget,
          po_budget: line.po_budget,
          sort_order: line.sort_order,
        })) as never
      );
  }

  invalidatePlanningCache();
  revalidatePath(PLANNING_PATH);
  return { ok: true, versionId: copy.id };
}

export async function createBudgetLineAction(input: {
  budgetVersionId: string;
  versionStatus: BudgetVersionStatus;
  currencyCode: string;
  countryCode?: string;
  clientId?: string;
  brandId?: string;
  campaignHeaderId?: string;
  teamId?: string;
  businessUnitId?: string;
  revenueBudget: number;
  costBudget: number;
  gpBudget: number;
  marginBudget: number;
  collectionsBudget: number;
  vendorCostBudget: number;
  poBudget: number;
  lineLabel?: string;
}): Promise<PlanningActionResult> {
  const supabase = await getSupabase();
  const auth = await requirePermission(supabase, "planning.write");
  if ("error" in auth) return { ok: false, error: auth.error };

  if (!budgetVersionAllowsLineWrite(input.versionStatus)) {
    return { ok: false, error: "This budget version is read-only." };
  }

  const { error } = await planningDb(supabase)
    .from("budget_lines")
    .insert({
      budget_version_id: input.budgetVersionId,
      currency_code: input.currencyCode,
      country_code: input.countryCode ?? null,
      client_id: input.clientId ?? null,
      brand_id: input.brandId ?? null,
      campaign_header_id: input.campaignHeaderId ?? null,
      team_id: input.teamId ?? null,
      business_unit_id: input.businessUnitId ?? null,
      line_label: input.lineLabel?.trim() ?? null,
      revenue_budget: input.revenueBudget,
      cost_budget: input.costBudget,
      gp_budget: input.gpBudget,
      margin_budget: input.marginBudget,
      collections_budget: input.collectionsBudget,
      vendor_cost_budget: input.vendorCostBudget,
      po_budget: input.poBudget,
    } as never);

  if (error) return { ok: false, error: error.message };

  await logPlanningAudit(supabase, {
    action: PLANNING_AUDIT_ACTIONS.line_updated,
    entityType: "budget_line",
    entityId: input.budgetVersionId,
    userId: auth.userId,
  });

  invalidatePlanningCache();
  revalidatePath(PLANNING_PATH);
  devLog("[budget-workspace] line created", input.budgetVersionId);
  return { ok: true };
}

export async function createForecastVersionAction(input: {
  name: string;
  fiscalYear: number;
  currencyCode: string;
  budgetVersionId?: string;
  notes?: string;
}): Promise<PlanningActionResult & { forecastId?: string }> {
  const supabase = await getSupabase();
  const auth = await requirePermission(supabase, "planning.forecast");
  if ("error" in auth) return { ok: false, error: auth.error };

  const documentNumber = nextDocumentNumber("FCST", input.fiscalYear);
  const { data, error } = await planningDb(supabase)
    .from("forecast_versions")
    .insert({
      document_number: documentNumber,
      name: input.name.trim(),
      fiscal_year: input.fiscalYear,
      currency_code: input.currencyCode,
      budget_version_id: input.budgetVersionId ?? null,
      notes: input.notes?.trim() ?? null,
      created_by: auth.userId,
    } as never)
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create forecast." };
  }

  await logPlanningAudit(supabase, {
    action: PLANNING_AUDIT_ACTIONS.forecast_updated,
    entityType: "forecast_version",
    entityId: data.id,
    userId: auth.userId,
  });

  invalidatePlanningCache();
  revalidatePath(PLANNING_PATH);
  devLog("[forecast-dashboard] forecast created", data.id);
  return { ok: true, forecastId: data.id };
}

export async function saveBudgetAllocationAction(input: {
  budgetLineId: string;
  allocationType: string;
  targetDimension: string;
  targetId?: string;
  allocatedAmount: number;
  allocationPercent?: number;
  currencyCode: string;
  notes?: string;
}): Promise<PlanningActionResult> {
  const supabase = await getSupabase();
  const auth = await requirePermission(supabase, "planning.write");
  if ("error" in auth) return { ok: false, error: auth.error };

  const { error } = await planningDb(supabase)
    .from("budget_allocations")
    .insert({
      budget_line_id: input.budgetLineId,
      allocation_type: input.allocationType,
      target_dimension: input.targetDimension,
      target_id: input.targetId ?? null,
      allocated_amount: input.allocatedAmount,
      allocation_percent: input.allocationPercent ?? null,
      currency_code: input.currencyCode,
      notes: input.notes?.trim() ?? null,
    } as never);

  if (error) return { ok: false, error: error.message };

  invalidatePlanningCache();
  revalidatePath(PLANNING_PATH);
  devLog("[budget-allocation] saved", input.budgetLineId);
  return { ok: true };
}
