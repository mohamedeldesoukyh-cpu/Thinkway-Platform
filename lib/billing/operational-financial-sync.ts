import type { AssignmentBillingGroup } from "@/features/billing/types";
import {
  aggregateRollupFromLeaves,
  flattenOperationalLeaves,
  isOperationalRowAchieved,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";

type FinancialSnapshot = {
  billable_amount: number;
  invoiced_amount: number;
  collected_amount: number;
  remaining_amount: number;
};

export type OperationalBillingContext = {
  linesById: Map<
    string,
    {
      revenue: number;
      billing_status: string;
    }
  >;
  groupsByLineId: Map<
    string,
    Pick<AssignmentBillingGroup, "total_value" | "invoiced_value" | "remaining_value" | "collected_value">
  >;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function resolveAmount(
  primary: number | null | undefined,
  ...fallbacks: Array<number | null | undefined>
): number {
  if (isPositive(Number(primary ?? 0))) return Number(primary);
  for (const fallback of fallbacks) {
    if (isPositive(Number(fallback ?? 0))) return Number(fallback);
  }
  return 0;
}

/** Equal split with remainder applied to the last slot. */
export function distributeEqual(total: number, count: number): number[] {
  if (count <= 0) return [];
  if (total <= 0) return Array.from({ length: count }, () => 0);
  const base = roundMoney(total / count);
  const amounts = Array.from({ length: count }, () => base);
  const allocated = roundMoney(base * count);
  const remainder = roundMoney(total - allocated);
  if (remainder !== 0) {
    amounts[count - 1] = roundMoney(amounts[count - 1] + remainder);
  }
  return amounts;
}

function distributeFinancialSnapshot(
  total: FinancialSnapshot,
  count: number
): FinancialSnapshot[] {
  const billableParts = distributeEqual(total.billable_amount, count);
  const invoicedParts = distributeEqual(total.invoiced_amount, count);
  const collectedParts = distributeEqual(total.collected_amount, count);
  const remainingParts = distributeEqual(total.remaining_amount, count);

  return Array.from({ length: count }, (_, index) => ({
    billable_amount: billableParts[index] ?? 0,
    invoiced_amount: invoicedParts[index] ?? 0,
    collected_amount: collectedParts[index] ?? 0,
    remaining_amount: remainingParts[index] ?? 0,
  }));
}

function sumFinancialRows(rows: Pick<OperationalBillingRow, keyof FinancialSnapshot>[]): FinancialSnapshot {
  return {
    billable_amount: roundMoney(rows.reduce((sum, row) => sum + row.billable_amount, 0)),
    invoiced_amount: roundMoney(rows.reduce((sum, row) => sum + row.invoiced_amount, 0)),
    collected_amount: roundMoney(rows.reduce((sum, row) => sum + row.collected_amount, 0)),
    remaining_amount: roundMoney(rows.reduce((sum, row) => sum + row.remaining_amount, 0)),
  };
}

function postsHaveFinancialAllocation(posts: OperationalBillingRow[]): boolean {
  return posts.some((post) => isPositive(post.billable_amount));
}

export function buildOperationalBillingContext(
  lines: Array<{ id: string; revenue: number; billing_status: string }>,
  groups: AssignmentBillingGroup[]
): OperationalBillingContext {
  const linesById = new Map(
    lines.map((line) => [
      line.id,
      { revenue: Number(line.revenue), billing_status: line.billing_status },
    ])
  );
  const groupsByLineId = new Map(
    groups.map((group) => [
      group.line_id,
      {
        total_value: group.total_value,
        invoiced_value: group.invoiced_value,
        remaining_value: group.remaining_value,
        collected_value: group.collected_value,
      },
    ])
  );
  return { linesById, groupsByLineId };
}

function normalizePostRow(
  post: OperationalBillingRow,
  fallbackPerPost: FinancialSnapshot
): OperationalBillingRow {
  const billable = resolveAmount(post.billable_amount, fallbackPerPost.billable_amount);
  const invoiced = resolveAmount(post.invoiced_amount, fallbackPerPost.invoiced_amount);
  const collected = resolveAmount(post.collected_amount, fallbackPerPost.collected_amount);
  const remaining = resolveAmount(
    post.remaining_amount,
    fallbackPerPost.remaining_amount,
    Math.max(0, billable - invoiced)
  );
  const inherited = billable === fallbackPerPost.billable_amount && fallbackPerPost.billable_amount > 0;

  return {
    ...post,
    billable_amount: billable,
    invoiced_amount: invoiced,
    collected_amount: collected,
    remaining_amount: remaining,
    is_invoice_eligible: !post.is_locked && remaining > 0,
    is_legacy_synthetic: post.is_legacy_synthetic || inherited,
  };
}

function normalizeDeliverableRow(
  deliverable: OperationalBillingRow,
  fallback: FinancialSnapshot
): OperationalBillingRow {
  const posts = deliverable.children;
  const source: FinancialSnapshot = {
    billable_amount: resolveAmount(deliverable.billable_amount, fallback.billable_amount),
    invoiced_amount: resolveAmount(deliverable.invoiced_amount, fallback.invoiced_amount),
    collected_amount: resolveAmount(deliverable.collected_amount, fallback.collected_amount),
    remaining_amount: resolveAmount(
      deliverable.remaining_amount,
      fallback.remaining_amount,
      Math.max(0, deliverable.billable_amount - deliverable.invoiced_amount)
    ),
  };

  if (posts.length === 0) {
    return {
      ...deliverable,
      ...source,
      is_invoice_eligible: source.remaining_amount > 0 && !deliverable.is_locked,
    };
  }

  const needsDistribution = !postsHaveFinancialAllocation(posts) && source.billable_amount > 0;

  if (needsDistribution) {
    const distributed = distributeFinancialSnapshot(source, posts.length);
    const normalizedPosts = posts.map((post, index) =>
      normalizePostRow(post, distributed[index] ?? source)
    );

    if (process.env.NODE_ENV === "development") {
      console.debug("[legacy-financial-fallback] distributed deliverable revenue to posts", {
        deliverableId: deliverable.id,
        sourceBillable: source.billable_amount,
        postCount: posts.length,
      });
    }

    return {
      ...deliverable,
      ...source,
      children: normalizedPosts,
      is_invoice_eligible: source.remaining_amount > 0 && !deliverable.is_locked,
    };
  }

  const normalizedPosts = posts.map((post) =>
    normalizePostRow(post, {
      billable_amount: 0,
      invoiced_amount: 0,
      collected_amount: 0,
      remaining_amount: 0,
    })
  );
  const rolledUp = sumFinancialRows(normalizedPosts);

  return {
    ...deliverable,
    billable_amount: isPositive(rolledUp.billable_amount)
      ? rolledUp.billable_amount
      : source.billable_amount,
    invoiced_amount: isPositive(rolledUp.invoiced_amount)
      ? rolledUp.invoiced_amount
      : source.invoiced_amount,
    collected_amount: isPositive(rolledUp.collected_amount)
      ? rolledUp.collected_amount
      : source.collected_amount,
    remaining_amount: isPositive(rolledUp.remaining_amount)
      ? rolledUp.remaining_amount
      : source.remaining_amount,
    children: normalizedPosts,
    is_invoice_eligible:
      (isPositive(rolledUp.remaining_amount) ? rolledUp.remaining_amount : source.remaining_amount) >
        0 && !deliverable.is_locked,
  };
}

function normalizeAssignmentRow(
  assignment: OperationalBillingRow,
  context: OperationalBillingContext
): OperationalBillingRow {
  const line = context.linesById.get(assignment.id);
  const group = context.groupsByLineId.get(assignment.id);
  const lineRevenue = Number(line?.revenue ?? 0);
  const deliverables = assignment.children;

  const assignmentFallback: FinancialSnapshot = {
    billable_amount: resolveAmount(
      assignment.billable_amount,
      group?.total_value,
      lineRevenue
    ),
    invoiced_amount: resolveAmount(assignment.invoiced_amount, group?.invoiced_value),
    collected_amount: resolveAmount(assignment.collected_amount, group?.collected_value),
    remaining_amount: resolveAmount(
      assignment.remaining_amount,
      group?.remaining_value,
      Math.max(0, assignment.billable_amount - assignment.invoiced_amount)
    ),
  };

  if (deliverables.length === 0) {
    return {
      ...assignment,
      ...assignmentFallback,
      is_legacy_synthetic: false,
      is_invoice_eligible: assignmentFallback.remaining_amount > 0,
      is_achieved: isOperationalRowAchieved({
        kind: "assignment",
        billing_status: assignment.billing_status,
        line_billing_status: assignment.line_billing_status,
        is_achieved: assignment.is_achieved,
      }),
    };
  }

  const perDeliverableFallback = distributeFinancialSnapshot(
    assignmentFallback,
    deliverables.length
  );
  const normalizedDeliverables = deliverables.map((deliverable, index) =>
    normalizeDeliverableRow(deliverable, perDeliverableFallback[index] ?? assignmentFallback)
  );

  let rolledUp = sumFinancialRows(normalizedDeliverables);
  if (rolledUp.billable_amount <= 0 && assignmentFallback.billable_amount > 0) {
    rolledUp = assignmentFallback;
    if (process.env.NODE_ENV === "development") {
      console.debug("[legacy-financial-fallback] assignment totals inherited from line/group", {
        lineId: assignment.id,
        lineRevenue,
        groupTotal: group?.total_value,
      });
    }
  }

  return {
    ...assignment,
    billable_amount: rolledUp.billable_amount,
    invoiced_amount: rolledUp.invoiced_amount,
    collected_amount: rolledUp.collected_amount,
    remaining_amount: rolledUp.remaining_amount,
    children: normalizedDeliverables,
    is_invoice_eligible: normalizedDeliverables.some((row) => row.is_invoice_eligible),
    is_achieved: isOperationalRowAchieved({
      kind: "assignment",
      billing_status: assignment.billing_status,
      line_billing_status: assignment.line_billing_status,
      is_achieved: assignment.is_achieved,
    }),
  };
}

/** Reconcile operational row financials with assignment/deliverable legacy totals. */
export function normalizeOperationalBillingTree(
  rows: OperationalBillingRow[],
  context: OperationalBillingContext
): OperationalBillingRow[] {
  const normalized = rows.map((row) => normalizeAssignmentRow(row, context));

  if (process.env.NODE_ENV === "development") {
    const before = sumFinancialRows(flattenOperationalLeaves(rows));
    const after = sumFinancialRows(flattenOperationalLeaves(normalized));
    console.debug("[operational-financial-sync] normalized operational tree", {
      assignmentCount: rows.length,
      before,
      after,
    });
  }

  return normalized;
}

export function computeLegacyAchievedRevenue(
  rows: OperationalBillingRow[],
  legacyTotal: number
): number {
  let achieved = 0;
  for (const row of rows) {
    if (row.kind !== "assignment") continue;
    if (!isOperationalRowAchieved(row)) continue;
    achieved += row.billable_amount > 0 ? row.billable_amount : 0;
  }
  if (achieved > 0) return achieved;
  if (legacyTotal <= 0) return 0;

  const achievedAssignments = rows.filter(
    (row) => row.kind === "assignment" && isOperationalRowAchieved(row)
  );
  if (achievedAssignments.length === 0) return 0;
  return roundMoney(legacyTotal * (achievedAssignments.length / Math.max(rows.length, 1)));
}

export function computeCampaignFinancialRollup(input: {
  operational_rows: OperationalBillingRow[];
  legacy_line_revenue?: number;
  legacy_invoiced?: number;
}): {
  total_campaign_amount: number;
  achieved_revenue: number;
  already_invoiced: number;
  remaining_to_invoice: number;
  unachieved_revenue: number;
} {
  const leaves = flattenOperationalLeaves(input.operational_rows);
  const legacyTotal = input.legacy_line_revenue ?? 0;
  const legacyInvoiced = input.legacy_invoiced ?? 0;

  if (leaves.length === 0) {
    const rollup = {
      total_campaign_amount: legacyTotal,
      achieved_revenue: legacyTotal,
      already_invoiced: legacyInvoiced,
      remaining_to_invoice: Math.max(0, legacyTotal - legacyInvoiced),
      unachieved_revenue: 0,
    };
    if (process.env.NODE_ENV === "development") {
      console.debug("[campaign-financial-aggregation] legacy-only rollup", rollup);
    }
    return rollup;
  }

  let rollup = aggregateRollupFromLeaves(leaves);

  if (rollup.total_campaign_amount <= 0 && legacyTotal > 0) {
    const achieved = computeLegacyAchievedRevenue(input.operational_rows, legacyTotal);
    rollup = {
      total_campaign_amount: legacyTotal,
      achieved_revenue: achieved,
      already_invoiced: legacyInvoiced,
      remaining_to_invoice: Math.max(0, achieved - legacyInvoiced),
      unachieved_revenue: Math.max(0, legacyTotal - achieved),
    };
    if (process.env.NODE_ENV === "development") {
      console.debug("[legacy-financial-fallback] campaign rollup inherited legacy totals", {
        legacyTotal,
        legacyInvoiced,
        ...rollup,
      });
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[billing-rollup] campaign financial rollup", {
      leafCount: leaves.length,
      ...rollup,
    });
  }

  return rollup;
}

export function resolvePostBillableAmount(input: {
  billable_amount?: number | null;
  revenue_before_vat?: number | null;
  fallback?: number;
}): number {
  return resolveAmount(
    input.billable_amount,
    Number(input.revenue_before_vat ?? 0),
    input.fallback ?? 0
  );
}
