/**
 * Run: npx tsx lib/campaigns/assignment-hierarchy-rollups.test.ts
 */
import {
  alignPackageLineCommercialToDeliverables,
  buildAssignmentHierarchyRollups,
} from "@/lib/campaigns/assignment-hierarchy-rollups";
import type {
  AssignmentDeliverableHierarchyRow,
  AssignmentPostOperationalRow,
} from "@/lib/domains/campaign/assignment-hierarchy-types";
import type { CampaignLineWorkspace } from "@/lib/domains/campaign/workspace-types";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function basePost(id: string, deliverableId: string): AssignmentPostOperationalRow {
  return {
    id,
    assignment_deliverable_id: deliverableId,
    sequence_number: 1,
    label: "#1",
    platform: "instagram",
    deliverable_type: "story",
    deliverable_type_label: "Story",
    live_date: null,
    workflow_status: "draft",
    notes: null,
    revenue_per_post: 0,
    cost_per_post: 0,
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

function baseDeliverable(
  overrides: Partial<AssignmentDeliverableHierarchyRow>
): AssignmentDeliverableHierarchyRow {
  return {
    id: "del-1",
    campaign_line_id: "line-1",
    sort_order: 1,
    label: "Story",
    platform: "instagram",
    deliverable_type: "story",
    deliverable_type_label: "Story",
    quantity: 1,
    unit_cost: 0,
    unit_revenue: 37_500,
    live_date: null,
    notes: null,
    revenue_before_vat: 37_500,
    usage_rights_amount: 0,
    usage_rights_cost: 0,
    agency_fee_percent: 0,
    agency_fee_amount: 0,
    cost_before_vat: 0,
    revenue_vat_percent: 0,
    revenue_vat_amount: 0,
    revenue_after_vat: 37_500,
    cost_vat_amount: 0,
    billing_status: "draft",
    collection_status: null,
    invoice_id: null,
    invoice_document_number: null,
    payout_status: null,
    workflow_status: "draft",
    posts: [basePost("virtual-del-1-1", "del-1")],
    remaining_amount: 37_500,
    invoiced_amount: 0,
    invoice_eligible: false,
    is_synthetic: false,
    is_locked: false,
    locked_at: null,
    live_ad_date_locked: false,
    ...overrides,
  };
}

function packageLine(overrides: Partial<CampaignLineWorkspace> = {}): CampaignLineWorkspace {
  return {
    id: "line-1",
    document_number: "TW-2026-0001-A",
    name: "Shimaa Saber",
    revenue: 150_000,
    cost: 140_000,
    revenue_before_vat: 150_000,
    cost_before_vat: 140_000,
    usage_rights_amount: 0,
    usage_rights_cost: 0,
    agency_fee_percent: 10,
    agency_fee_amount: 15_000,
    gp: 25_000,
    margin_percent: 15.15,
    deliverable_count: 4,
    assignment: {
      influencer_id: "inf-1",
      influencer_name: "Shimaa Saber",
      influencer_document_number: "V-1",
      platforms: [],
      pricing_mode: "package",
    },
    ...overrides,
  } as CampaignLineWorkspace;
}

function testPackageRollupUsesLineCommercialDespiteZeroChildCost() {
  const line = packageLine();
  const deliverables = [
    baseDeliverable({ id: "del-1", revenue_before_vat: 37_500, unit_revenue: 37_500 }),
    baseDeliverable({
      id: "del-2",
      deliverable_type: "post",
      revenue_before_vat: 37_500,
      unit_revenue: 37_500,
      posts: [basePost("virtual-del-2-1", "del-2")],
    }),
    baseDeliverable({
      id: "del-3",
      platform: "tiktok",
      deliverable_type: "video",
      revenue_before_vat: 37_500,
      unit_revenue: 37_500,
      posts: [basePost("virtual-del-3-1", "del-3")],
    }),
    baseDeliverable({
      id: "del-4",
      deliverable_type: "story",
      revenue_before_vat: 37_500,
      unit_revenue: 37_500,
      posts: [basePost("virtual-del-4-1", "del-4")],
    }),
  ];

  const rollups = buildAssignmentHierarchyRollups(deliverables, line);

  assert(rollups.cost === 140_000, `expected line cost 140000, got ${rollups.cost}`);
  assert(rollups.gp === 25_000, `expected gp 25000, got ${rollups.gp}`);
  assert(
    Math.abs(rollups.margin_percent - 15.15) < 0.01,
    `expected margin ~15.15%, got ${rollups.margin_percent}`
  );
}

function testAlignPackageLineDistributesCostToChildren() {
  const line = packageLine();
  const deliverables = [
    baseDeliverable({ id: "del-1", quantity: 1 }),
    baseDeliverable({
      id: "del-2",
      quantity: 1,
      posts: [basePost("virtual-del-2-1", "del-2")],
    }),
    baseDeliverable({
      id: "del-3",
      quantity: 1,
      posts: [basePost("virtual-del-3-1", "del-3")],
    }),
    baseDeliverable({
      id: "del-4",
      quantity: 1,
      posts: [basePost("virtual-del-4-1", "del-4")],
    }),
  ];

  const aligned = alignPackageLineCommercialToDeliverables(deliverables, line);
  const totalChildCost = aligned.reduce((sum, row) => sum + row.cost_before_vat, 0);

  assert(totalChildCost === 140_000, `expected distributed child cost 140000, got ${totalChildCost}`);
  assert(
    aligned.every((row) => row.unit_cost === 35_000 && row.posts[0]!.cost_per_post === 35_000),
    "each deliverable should show 35000 cost/ad"
  );
}

function testAlignPackageLineDistributesRevenueToChildren() {
  const line = packageLine({ revenue_before_vat: 11_200, revenue: 11_200, cost_before_vat: 10_000, cost: 10_000 });
  const deliverables = [
    baseDeliverable({
      id: "del-1",
      quantity: 1,
      unit_revenue: 5_600,
      revenue_before_vat: 5_600,
      unit_cost: 3_333.34,
      cost_before_vat: 3_333.34,
    }),
    baseDeliverable({
      id: "del-2",
      quantity: 1,
      unit_revenue: 5_600,
      revenue_before_vat: 5_600,
      unit_cost: 3_333.33,
      cost_before_vat: 3_333.33,
      posts: [basePost("virtual-del-2-1", "del-2")],
    }),
    baseDeliverable({
      id: "del-3",
      quantity: 1,
      unit_revenue: 5_600,
      revenue_before_vat: 5_600,
      unit_cost: 3_333.33,
      cost_before_vat: 3_333.33,
      posts: [basePost("virtual-del-3-1", "del-3")],
    }),
  ];

  const aligned = alignPackageLineCommercialToDeliverables(deliverables, line);
  const totalChildRev = aligned.reduce((sum, row) => sum + row.revenue_before_vat, 0);
  const totalChildCost = aligned.reduce((sum, row) => sum + row.cost_before_vat, 0);

  assert(totalChildRev === 11_200, `expected distributed child rev 11200, got ${totalChildRev}`);
  assert(totalChildCost === 10_000, `expected distributed child cost 10000, got ${totalChildCost}`);
}

function testAlignPackageLineSplitsUnevenQtyAndUsageRights() {
  const line = packageLine({
    revenue_before_vat: 32_000,
    revenue: 32_000,
    cost_before_vat: 16_000,
    cost: 16_000,
    usage_rights_amount: 3_200,
    usage_rights_cost: 1_600,
    agency_fee_percent: 10,
    agency_fee_amount: 3_520,
  });
  const deliverables = [
    baseDeliverable({
      id: "stories",
      quantity: 26,
      revenue_before_vat: 32_000,
      unit_revenue: 32_000,
      cost_before_vat: 16_000,
      unit_cost: 16_000,
      usage_rights_amount: 3_200,
      usage_rights_cost: 1_600,
      agency_fee_percent: 10,
      agency_fee_amount: 3_520,
    }),
    baseDeliverable({
      id: "reels",
      quantity: 6,
      revenue_before_vat: 0,
      unit_revenue: 0,
      cost_before_vat: 0,
      unit_cost: 0,
      usage_rights_amount: 0,
      usage_rights_cost: 0,
      agency_fee_percent: 0,
      agency_fee_amount: 0,
      posts: [basePost("virtual-reels-1", "reels")],
    }),
  ];

  const aligned = alignPackageLineCommercialToDeliverables(deliverables, line);
  const stories = aligned[0]!;
  const reels = aligned[1]!;

  assert(stories.revenue_before_vat === 26_000, `stories rev should be 26000, got ${stories.revenue_before_vat}`);
  assert(reels.revenue_before_vat === 6_000, `reels rev should be 6000, got ${reels.revenue_before_vat}`);
  assert(stories.cost_before_vat === 13_000, `stories cost should be 13000, got ${stories.cost_before_vat}`);
  assert(reels.cost_before_vat === 3_000, `reels cost should be 3000, got ${reels.cost_before_vat}`);
  assert(stories.usage_rights_amount === 2_600, `stories UR should be 2600, got ${stories.usage_rights_amount}`);
  assert(reels.usage_rights_amount === 600, `reels UR should be 600, got ${reels.usage_rights_amount}`);
  assert(stories.usage_rights_cost === 1_300, `stories UR cost should be 1300, got ${stories.usage_rights_cost}`);
  assert(reels.usage_rights_cost === 300, `reels UR cost should be 300, got ${reels.usage_rights_cost}`);
  assert(stories.agency_fee_percent === 10 && reels.agency_fee_percent === 10, "AF% copies to every child");
  assert(
    stories.agency_fee_amount + reels.agency_fee_amount === 3_520,
    `child fees should match parent 3520, got ${stories.agency_fee_amount + reels.agency_fee_amount}`
  );
}

const tests = [
  testPackageRollupUsesLineCommercialDespiteZeroChildCost,
  testAlignPackageLineDistributesCostToChildren,
  testAlignPackageLineDistributesRevenueToChildren,
  testAlignPackageLineSplitsUnevenQtyAndUsageRights,
];

for (const run of tests) {
  run();
}

console.log(`assignment-hierarchy-rollups: ${tests.length} passed`);
