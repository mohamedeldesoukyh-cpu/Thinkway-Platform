import { computeAgencyFeeAmount } from "@/lib/assignments/client-billing-commercial";
import { distributeAmountByWeights } from "@/lib/assignments/commercial-calculations";
import type {
  AssignmentDeliverableHierarchyRow,
  AssignmentPostOperationalRow,
} from "@/lib/domains/campaign/assignment-hierarchy-types";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export type AssignmentTypeCommercialSlice = {
  qty: number;
  rev: number;
  cost: number;
  revPerAd: number;
  costPerAd: number;
  usageRightsAmount: number;
  usageRightsCost: number;
  agencyFeePercent: number;
  agencyFeeAmount: number;
};

export type AssignmentTypeLineSeed = {
  revenueBeforeVat: number;
  costBeforeVat: number;
  usageRightsAmount: number;
  usageRightsCost: number;
  agencyFeePercent: number;
};

export function assignmentPostTypeKey(post: {
  platform: string;
  deliverable_type: string;
}): string {
  return `${post.platform}::${post.deliverable_type}`;
}

export function uniqueAssignmentPostTypeCount(
  posts: AssignmentPostOperationalRow[]
): number {
  return new Set(posts.map(assignmentPostTypeKey)).size;
}

export function isFirstPostOfType(
  posts: AssignmentPostOperationalRow[],
  postId: string
): boolean {
  const post = posts.find((row) => row.id === postId);
  if (!post) return false;
  const key = assignmentPostTypeKey(post);
  const first = posts.find((row) => assignmentPostTypeKey(row) === key);
  return first?.id === postId;
}

function sumMoney(posts: AssignmentPostOperationalRow[], field: "revenue_per_post" | "cost_per_post") {
  return roundMoney(posts.reduce((sum, row) => sum + Number(row[field] ?? 0), 0));
}

function sliceFromTotals(
  qty: number,
  revenue: number,
  cost: number,
  usageRightsAmount: number,
  usageRightsCost: number,
  agencyFeePercent: number
): AssignmentTypeCommercialSlice {
  const safeQty = Math.max(1, qty);
  return {
    qty: safeQty,
    rev: revenue,
    cost,
    revPerAd: roundMoney(revenue / safeQty),
    costPerAd: roundMoney(cost / safeQty),
    usageRightsAmount,
    usageRightsCost,
    agencyFeePercent,
    agencyFeeAmount: computeAgencyFeeAmount(revenue, usageRightsAmount, agencyFeePercent),
  };
}

function weightPool(
  qty: number,
  totalQty: number,
  pool: AssignmentTypeLineSeed
): AssignmentTypeCommercialSlice {
  const weights = [Math.max(1, qty), Math.max(0, totalQty - qty)];
  const revenueShares = distributeAmountByWeights(pool.revenueBeforeVat, weights);
  const costShares = distributeAmountByWeights(pool.costBeforeVat, weights);
  const urShares = distributeAmountByWeights(pool.usageRightsAmount, weights);
  const urCostShares = distributeAmountByWeights(pool.usageRightsCost, weights);
  return sliceFromTotals(
    qty,
    revenueShares[0] ?? 0,
    costShares[0] ?? 0,
    urShares[0] ?? 0,
    urCostShares[0] ?? 0,
    pool.agencyFeePercent
  );
}

/** Commercial for the first post of a type: stored post rates, else a qty-weighted package seed. */
export function resolveAssignmentTypeCommercial(input: {
  posts: AssignmentPostOperationalRow[];
  post: AssignmentPostOperationalRow;
  deliverable: AssignmentDeliverableHierarchyRow;
  line?: AssignmentTypeLineSeed | null;
}): AssignmentTypeCommercialSlice {
  const key = assignmentPostTypeKey(input.post);
  const ofType = input.posts.filter((row) => assignmentPostTypeKey(row) === key);
  const qty = Math.max(1, ofType.length);
  const storedRev = sumMoney(ofType, "revenue_per_post");
  const storedCost = sumMoney(ofType, "cost_per_post");
  const typeCount = uniqueAssignmentPostTypeCount(input.posts);
  const feePercent = Number(
    input.deliverable.agency_fee_percent || input.line?.agencyFeePercent || 0
  );

  if (storedRev > 0.01 || storedCost > 0.01) {
    if (typeCount <= 1) {
      return sliceFromTotals(
        qty,
        storedRev,
        storedCost,
        Number(input.deliverable.usage_rights_amount ?? 0),
        Number(input.deliverable.usage_rights_cost ?? 0),
        feePercent
      );
    }
    const urPool: AssignmentTypeLineSeed = {
      revenueBeforeVat: 0,
      costBeforeVat: 0,
      usageRightsAmount: Number(
        input.deliverable.usage_rights_amount || input.line?.usageRightsAmount || 0
      ),
      usageRightsCost: Number(
        input.deliverable.usage_rights_cost || input.line?.usageRightsCost || 0
      ),
      agencyFeePercent: feePercent,
    };
    const urSlice = weightPool(qty, input.posts.length, urPool);
    return sliceFromTotals(
      qty,
      storedRev,
      storedCost,
      urSlice.usageRightsAmount,
      urSlice.usageRightsCost,
      feePercent
    );
  }

  if (typeCount <= 1) {
    const rev = Number(input.deliverable.revenue_before_vat ?? 0);
    const cost = Number(input.deliverable.cost_before_vat ?? 0);
    if (rev > 0.01 || cost > 0.01) {
      return sliceFromTotals(
        Math.max(qty, Number(input.deliverable.quantity) || qty),
        rev,
        cost,
        Number(input.deliverable.usage_rights_amount ?? 0),
        Number(input.deliverable.usage_rights_cost ?? 0),
        feePercent
      );
    }
  }

  const pool: AssignmentTypeLineSeed | null =
    Number(input.deliverable.revenue_before_vat ?? 0) > 0.01 ||
    Number(input.deliverable.cost_before_vat ?? 0) > 0.01
      ? {
          revenueBeforeVat: Number(input.deliverable.revenue_before_vat ?? 0),
          costBeforeVat: Number(input.deliverable.cost_before_vat ?? 0),
          usageRightsAmount: Number(input.deliverable.usage_rights_amount ?? 0),
          usageRightsCost: Number(input.deliverable.usage_rights_cost ?? 0),
          agencyFeePercent: feePercent,
        }
      : input.line
        ? input.line
        : null;

  if (!pool) {
    return sliceFromTotals(qty, 0, 0, 0, 0, feePercent);
  }

  const groups = new Map<string, AssignmentPostOperationalRow[]>();
  for (const row of input.posts) {
    const rowKey = assignmentPostTypeKey(row);
    const list = groups.get(rowKey) ?? [];
    list.push(row);
    groups.set(rowKey, list);
  }

  const leftoverKeys: string[] = [];
  let leftoverQty = 0;
  let allocatedRev = 0;
  let allocatedCost = 0;
  let allocatedUr = 0;
  let allocatedUrCost = 0;
  for (const [groupKey, rows] of groups) {
    const groupStoredRev = sumMoney(rows, "revenue_per_post");
    const groupStoredCost = sumMoney(rows, "cost_per_post");
    if (groupStoredRev > 0.01 || groupStoredCost > 0.01) {
      allocatedRev = roundMoney(allocatedRev + groupStoredRev);
      allocatedCost = roundMoney(allocatedCost + groupStoredCost);
      continue;
    }
    leftoverKeys.push(groupKey);
    leftoverQty += rows.length;
  }

  const remainingPool: AssignmentTypeLineSeed = {
    revenueBeforeVat: Math.max(0, roundMoney(pool.revenueBeforeVat - allocatedRev)),
    costBeforeVat: Math.max(0, roundMoney(pool.costBeforeVat - allocatedCost)),
    usageRightsAmount: Math.max(0, roundMoney(pool.usageRightsAmount - allocatedUr)),
    usageRightsCost: Math.max(0, roundMoney(pool.usageRightsCost - allocatedUrCost)),
    agencyFeePercent: pool.agencyFeePercent,
  };

  const weightQty = leftoverKeys.includes(key) ? leftoverQty : input.posts.length;
  return weightPool(qty, Math.max(qty, weightQty), remainingPool);
}
