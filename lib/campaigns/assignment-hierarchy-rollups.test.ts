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
  assert(
    aligned.every((row) => row.cost_before_vat === 0 && row.unit_cost === 0),
    "package types keep their own cost/ad; zeros are not filled from the parent"
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

  assert(totalChildRev === 16_800, `child types keep their own rev, got ${totalChildRev}`);
  assert(totalChildCost === 10_000, `child types keep their own cost, got ${totalChildCost}`);
  assert(aligned[0]!.unit_revenue === 5_600, "first type keeps its rev/ad");
}

function testAlignPackageLineKeepsDifferentTypeRates() {
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
      unit_revenue: 200,
      revenue_before_vat: 5_200,
      unit_cost: 100,
      cost_before_vat: 2_600,
      usage_rights_amount: 0,
      usage_rights_cost: 0,
    }),
    baseDeliverable({
      id: "reels",
      quantity: 6,
      unit_revenue: 1_000,
      revenue_before_vat: 6_000,
      unit_cost: 800,
      cost_before_vat: 4_800,
      usage_rights_amount: 0,
      usage_rights_cost: 0,
      posts: [basePost("virtual-reels-1", "reels")],
    }),
  ];

  const aligned = alignPackageLineCommercialToDeliverables(deliverables, line);
  const stories = aligned[0]!;
  const reels = aligned[1]!;

  assert(stories.unit_cost === 100, `stories keep cost/ad 100, got ${stories.unit_cost}`);
  assert(reels.unit_cost === 800, `reels keep cost/ad 800, got ${reels.unit_cost}`);
  assert(stories.unit_revenue === 200, `stories keep rev/ad 200, got ${stories.unit_revenue}`);
  assert(reels.unit_revenue === 1_000, `reels keep rev/ad 1000, got ${reels.unit_revenue}`);
  assert(stories.cost_before_vat === 2_600, "stories cost stays qty × cost/ad");
  assert(reels.cost_before_vat === 4_800, "reels cost stays qty × cost/ad");
}

function testAlignMixedPostsKeepPerTypeRates() {
  const line = packageLine({
    revenue_before_vat: 11_200,
    revenue: 11_200,
    cost_before_vat: 8_000,
    cost: 8_000,
  });
  const posts: AssignmentPostOperationalRow[] = [
    {
      ...basePost("reel-1", "pkg"),
      deliverable_type: "reel",
      deliverable_type_label: "Reel",
      revenue_per_post: 1_600,
      cost_per_post: 1_000,
    },
    {
      ...basePost("reel-2", "pkg"),
      deliverable_type: "reel",
      deliverable_type_label: "Reel",
      revenue_per_post: 0,
      cost_per_post: 0,
    },
    {
      ...basePost("story-1", "pkg"),
      deliverable_type: "story",
      deliverable_type_label: "Story",
      revenue_per_post: 200,
      cost_per_post: 100,
    },
    {
      ...basePost("story-2", "pkg"),
      deliverable_type: "story",
      deliverable_type_label: "Story",
      revenue_per_post: 0,
      cost_per_post: 0,
    },
  ];
  const aligned = alignPackageLineCommercialToDeliverables(
    [
      baseDeliverable({
        id: "pkg",
        quantity: 4,
        unit_revenue: 2_800,
        revenue_before_vat: 11_200,
        unit_cost: 2_000,
        cost_before_vat: 8_000,
        posts,
      }),
    ],
    line
  );
  const next = aligned[0]!.posts;
  assert(next[0]!.revenue_per_post === 1_600, "reel unit stays 1600");
  assert(next[1]!.revenue_per_post === 1_600, "extra reel inherits reel unit");
  assert(next[2]!.revenue_per_post === 200, "story unit stays 200");
  assert(next[3]!.revenue_per_post === 200, "extra story inherits story unit");
}

const tests = [
  testPackageRollupUsesLineCommercialDespiteZeroChildCost,
  testAlignPackageLineDistributesCostToChildren,
  testAlignPackageLineDistributesRevenueToChildren,
  testAlignPackageLineKeepsDifferentTypeRates,
  testAlignMixedPostsKeepPerTypeRates,
];

for (const run of tests) {
  run();
}

console.log(`assignment-hierarchy-rollups: ${tests.length} passed`);
