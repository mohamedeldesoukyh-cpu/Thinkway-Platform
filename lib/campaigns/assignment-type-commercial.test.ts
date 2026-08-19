/**
 * Run: npx tsx lib/campaigns/assignment-type-commercial.test.ts
 */
import {
  isFirstPostOfType,
  resolveAssignmentTypeCommercial,
  uniqueAssignmentPostTypeCount,
} from "@/lib/campaigns/assignment-type-commercial";
import type {
  AssignmentDeliverableHierarchyRow,
  AssignmentPostOperationalRow,
} from "@/lib/domains/campaign/assignment-hierarchy-types";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function post(
  id: string,
  type: string,
  amounts: { rev?: number; cost?: number } = {}
): AssignmentPostOperationalRow {
  return {
    id,
    assignment_deliverable_id: "del-1",
    sequence_number: 1,
    label: id,
    platform: "instagram",
    deliverable_type: type,
    deliverable_type_label: type,
    live_date: null,
    workflow_status: "draft",
    notes: null,
    revenue_per_post: amounts.rev ?? 0,
    cost_per_post: amounts.cost ?? 0,
    revenue_vat_percent: 0,
    revenue_vat_amount: 0,
    cost_vat_amount: 0,
    billing_status: "draft",
    collection_status: null,
    invoice_id: null,
    invoice_document_number: null,
    payout_status: null,
    is_locked: false,
  };
}

function deliverable(
  overrides: Partial<AssignmentDeliverableHierarchyRow> = {}
): AssignmentDeliverableHierarchyRow {
  return {
    id: "del-1",
    campaign_line_id: "line-1",
    sort_order: 1,
    label: "Package",
    platform: "instagram",
    deliverable_type: "reel",
    deliverable_type_label: "Reel",
    quantity: 32,
    unit_cost: 0,
    unit_revenue: 0,
    live_date: null,
    notes: null,
    revenue_before_vat: 0,
    usage_rights_amount: 0,
    usage_rights_cost: 0,
    agency_fee_percent: 0,
    agency_fee_amount: 0,
    cost_before_vat: 0,
    revenue_vat_percent: 0,
    revenue_vat_amount: 0,
    revenue_after_vat: 0,
    cost_vat_amount: 0,
    billing_status: "draft",
    collection_status: null,
    invoice_id: null,
    invoice_document_number: null,
    payout_status: null,
    workflow_status: "draft",
    posts: [],
    remaining_amount: 0,
    invoiced_amount: 0,
    invoice_eligible: false,
    is_synthetic: false,
    is_locked: false,
    locked_at: null,
    live_ad_date_locked: false,
    ...overrides,
  };
}

{
  const posts = [
    ...Array.from({ length: 6 }, (_, i) => post(`reel-${i + 1}`, "reel")),
    ...Array.from({ length: 26 }, (_, i) => post(`story-${i + 1}`, "story")),
  ];
  assert(uniqueAssignmentPostTypeCount(posts) === 2, "two types");
  assert(isFirstPostOfType(posts, "reel-1"), "first reel owns type commercial");
  assert(!isFirstPostOfType(posts, "reel-2"), "later reels do not");
  assert(isFirstPostOfType(posts, "story-1"), "first story owns type commercial");

  const reel = resolveAssignmentTypeCommercial({
    posts,
    post: posts[0]!,
    deliverable: deliverable({ posts }),
    line: {
      revenueBeforeVat: 51_200,
      costBeforeVat: 40_000,
      usageRightsAmount: 3_200,
      usageRightsCost: 1_600,
      agencyFeePercent: 10,
    },
  });
  const story = resolveAssignmentTypeCommercial({
    posts,
    post: posts[6]!,
    deliverable: deliverable({ posts }),
    line: {
      revenueBeforeVat: 51_200,
      costBeforeVat: 40_000,
      usageRightsAmount: 3_200,
      usageRightsCost: 1_600,
      agencyFeePercent: 10,
    },
  });
  assert(reel.qty === 6, `reel qty 6, got ${reel.qty}`);
  assert(story.qty === 26, `story qty 26, got ${story.qty}`);
  assert(reel.rev + story.rev === 51_200, `type rev must match parent 51200, got ${reel.rev + story.rev}`);
  assert(reel.cost + story.cost === 40_000, `type cost must match parent 40000, got ${reel.cost + story.cost}`);
  assert(reel.revPerAd !== story.revPerAd || reel.qty !== story.qty, "per-ad can match; totals follow qty");
  assert(reel.rev === 9_600, `reels get 6/32 of 51200 = 9600, got ${reel.rev}`);
  assert(story.rev === 41_600, `stories get 26/32 of 51200 = 41600, got ${story.rev}`);
}

{
  const posts = [post("reel-1", "reel"), post("story-1", "story", { rev: 2_800, cost: 2_000 })];
  const reel = resolveAssignmentTypeCommercial({
    posts,
    post: posts[0]!,
    deliverable: deliverable({ quantity: 2, posts, revenue_before_vat: 0, cost_before_vat: 0 }),
    line: {
      revenueBeforeVat: 5_600,
      costBeforeVat: 4_000,
      usageRightsAmount: 0,
      usageRightsCost: 0,
      agencyFeePercent: 0,
    },
  });
  assert(reel.rev === 2_800, `leftover parent after stored story is 2800, got ${reel.rev}`);
}

{
  const posts = [post("reel-1", "reel", { rev: 2_800, cost: 2_000 })];
  const slice = resolveAssignmentTypeCommercial({
    posts,
    post: posts[0]!,
    deliverable: deliverable({
      quantity: 1,
      posts,
      revenue_before_vat: 2_800,
      cost_before_vat: 2_000,
      unit_revenue: 2_800,
      unit_cost: 2_000,
    }),
  });
  assert(slice.qty === 1 && slice.rev === 2_800, "single type keeps stored deliverable amounts");
}

{
  const posts = [
    post("reel-1", "reel", { rev: 1_600, cost: 1_000 }),
    post("reel-2", "reel", { rev: 1_600, cost: 1_000 }),
    post("story-1", "story", { rev: 200, cost: 100 }),
  ];
  const reel = resolveAssignmentTypeCommercial({
    posts,
    post: posts[0]!,
    deliverable: deliverable({
      quantity: 3,
      posts,
      usage_rights_amount: 3_200,
      usage_rights_cost: 1_600,
    }),
    line: {
      revenueBeforeVat: 5_200,
      costBeforeVat: 3_200,
      usageRightsAmount: 3_200,
      usageRightsCost: 1_600,
      agencyFeePercent: 0,
    },
  });
  assert(reel.qty === 2, `stored mixed reel qty 2, got ${reel.qty}`);
  assert(reel.rev === 3_200, `stored mixed reel rev 3200, got ${reel.rev}`);
  assert(reel.usageRightsAmount === 2_133.33, `mixed UR follows qty, got ${reel.usageRightsAmount}`);
}

console.log("assignment-type-commercial: 4 passed");
