import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AssignmentHierarchy } from "@/lib/domains/campaign/assignment-hierarchy-types";

import { buildDocumentationUnitsFromHierarchy, emptyAgg } from "./build-documentation-units";
import {
  defaultOpenTypeGroupKeys,
  documentationSlotDestinationLabel,
  documentationSlotRowLabel,
  documentationSlotTitle,
  groupDocumentationUnits,
} from "./documentation-list-groups";
import {
  defaultDeliverableAssetType,
  documentationReceiptStatus,
  mediumCountsAsReceived,
  rollupCreatorCompleteness,
} from "./documentation-types";

function hierarchyFixture(): AssignmentHierarchy {
  return {
    currency_code: "EGP",
    groups: [
      {
        line: {
          id: "line-1",
          name: "Eman — Package",
          document_number: "TW-2026-0001-A",
          influencer_id: "inf-1",
          influencer_name: "Eman Abdullah",
        } as AssignmentHierarchy["groups"][0]["line"],
        deliverables: [
          {
            id: "del-1",
            campaign_line_id: "line-1",
            sort_order: 0,
            label: "IG Reel",
            platform: "instagram",
            deliverable_type: "ig_reel",
            deliverable_type_label: "IG reel",
            quantity: 1,
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
            billing_status: "ready_to_invoice",
            collection_status: "not_collected",
            invoice_id: null,
            invoice_document_number: null,
            payout_status: null,
            workflow_status: "draft",
            posts: [],
            remaining_amount: 0,
            invoiced_amount: 0,
            invoice_eligible: true,
            is_synthetic: false,
            is_locked: false,
            locked_at: null,
            live_ad_date_locked: false,
          },
          {
            id: "del-2",
            campaign_line_id: "line-1",
            sort_order: 1,
            label: "IG Stories",
            platform: "instagram",
            deliverable_type: "ig_story_set",
            deliverable_type_label: "IG story set",
            quantity: 3,
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
            billing_status: "ready_to_invoice",
            collection_status: "not_collected",
            invoice_id: null,
            invoice_document_number: null,
            payout_status: null,
            workflow_status: "draft",
            posts: [
              {
                id: "post-1",
                assignment_deliverable_id: "del-2",
                sequence_number: 1,
                label: "Story 1",
                platform: "instagram",
                deliverable_type: "ig_story_set",
                deliverable_type_label: "IG story set",
                live_date: null,
                workflow_status: "draft",
                notes: null,
                revenue_per_post: 0,
                cost_per_post: 0,
                revenue_vat_percent: 0,
                revenue_vat_amount: 0,
                cost_vat_amount: 0,
                billing_status: "ready_to_invoice",
                collection_status: "not_collected",
                invoice_id: null,
                invoice_document_number: null,
                payout_status: null,
                is_locked: false,
              },
              {
                id: "post-2",
                assignment_deliverable_id: "del-2",
                sequence_number: 2,
                label: "Story 2",
                platform: "instagram",
                deliverable_type: "ig_story_set",
                deliverable_type_label: "IG story set",
                live_date: null,
                workflow_status: "draft",
                notes: null,
                revenue_per_post: 0,
                cost_per_post: 0,
                revenue_vat_percent: 0,
                revenue_vat_amount: 0,
                cost_vat_amount: 0,
                billing_status: "ready_to_invoice",
                collection_status: "not_collected",
                invoice_id: null,
                invoice_document_number: null,
                payout_status: null,
                is_locked: false,
              },
              {
                id: "post-3",
                assignment_deliverable_id: "del-2",
                sequence_number: 3,
                label: "Story 3",
                platform: "instagram",
                deliverable_type: "ig_story_set",
                deliverable_type_label: "IG story set",
                live_date: null,
                workflow_status: "draft",
                notes: null,
                revenue_per_post: 0,
                cost_per_post: 0,
                revenue_vat_percent: 0,
                revenue_vat_amount: 0,
                cost_vat_amount: 0,
                billing_status: "ready_to_invoice",
                collection_status: "not_collected",
                invoice_id: null,
                invoice_document_number: null,
                payout_status: null,
                is_locked: false,
              },
            ],
            remaining_amount: 0,
            invoiced_amount: 0,
            invoice_eligible: true,
            is_synthetic: false,
            is_locked: false,
            locked_at: null,
            live_ad_date_locked: false,
          },
        ],
        rollups: {
          deliverable_count: 2,
          revenue: 0,
          cost: 0,
          gp: 0,
          margin_percent: 0,
          invoiced_value: 0,
          remaining_value: 0,
          collected_value: 0,
        },
      },
    ],
  };
}

describe("Deliverables documentation units", () => {
  it("qty=1 → one deliverable-level unit; qty>1 → one unit per post", () => {
    const units = buildDocumentationUnitsFromHierarchy(
      hierarchyFixture(),
      "ch1",
      new Map()
    );
    assert.equal(units.length, 4);
    assert.equal(units[0]?.assignmentPostScheduleId, null);
    assert.equal(units[0]?.unitKey, "d:del-1");
    assert.equal(units[1]?.assignmentPostScheduleId, "post-1");
    assert.equal(units[2]?.assignmentPostScheduleId, "post-2");
    assert.equal(units[3]?.assignmentPostScheduleId, "post-3");
  });

  it("received only when content assets exist (file/link)", () => {
    const agg = emptyAgg();
    agg.contentAssetCount = 1;
    const units = buildDocumentationUnitsFromHierarchy(
      hierarchyFixture(),
      "ch1",
      new Map([["d:del-1", agg]])
    );
    assert.equal(units[0]?.received, true);
    assert.equal(units[1]?.received, false);
  });

  it("text/caption medium does not count as received", () => {
    assert.equal(mediumCountsAsReceived("text"), false);
    assert.equal(mediumCountsAsReceived("file"), true);
    assert.equal(mediumCountsAsReceived("external_link"), true);
  });

  it("rolls up creator completeness", () => {
    assert.equal(rollupCreatorCompleteness([]), "none");
    assert.equal(
      rollupCreatorCompleteness([{ received: false }, { received: false }]),
      "none"
    );
    assert.equal(
      rollupCreatorCompleteness([{ received: true }, { received: false }]),
      "partial"
    );
    assert.equal(
      rollupCreatorCompleteness([{ received: true }, { received: true }]),
      "complete"
    );
  });
});

describe("Documentation repository grouping", () => {
  it("groups by creator then reel vs story, without mixing slots", () => {
    const units = buildDocumentationUnitsFromHierarchy(
      hierarchyFixture(),
      "ch1",
      new Map()
    );
    const groups = groupDocumentationUnits(units);
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.creatorName, "Eman Abdullah");
    assert.equal(groups[0]?.types.length, 2);
    assert.equal(groups[0]?.types[0]?.typeLabel, "IG reel");
    assert.equal(groups[0]?.types[0]?.units.length, 1);
    assert.equal(groups[0]?.types[1]?.units.length, 3);
    assert.equal(documentationSlotTitle(groups[0]!.types[1]!.units[0]!), "IG story set #1");
    assert.equal(documentationSlotRowLabel(groups[0]!.types[1]!.units[1]!), "#2");
    assert.equal(
      documentationSlotDestinationLabel(groups[0]!.types[0]!.units[0]!),
      "IG reel · Eman Abdullah"
    );
  });

  it("collapses large type groups unless the selected slot is inside", () => {
    const units = buildDocumentationUnitsFromHierarchy(
      hierarchyFixture(),
      "ch1",
      new Map()
    );
    const manyStories = Array.from({ length: 8 }, (_, index) => ({
      ...units[1]!,
      unitKey: `p:story-${index}`,
      sequenceNumber: index + 1,
    }));
    const grouped = groupDocumentationUnits([units[0]!, ...manyStories]);
    const openDefault = defaultOpenTypeGroupKeys(grouped, null);
    assert.equal(openDefault.has(grouped[0]!.types[0]!.groupKey), true);
    assert.equal(openDefault.has(grouped[0]!.types[1]!.groupKey), false);

    const openSelected = defaultOpenTypeGroupKeys(grouped, manyStories[2]!.unitKey);
    assert.equal(openSelected.has(grouped[0]!.types[1]!.groupKey), true);
  });

  it("marks unfinished uploads incomplete instead of missing", () => {
    assert.equal(
      documentationReceiptStatus({
        received: false,
        totalAssetCount: 1,
        contentAssetCount: 0,
      }),
      "incomplete"
    );
    assert.equal(
      documentationReceiptStatus({
        received: false,
        totalAssetCount: 0,
        contentAssetCount: 0,
      }),
      "missing"
    );
    assert.equal(
      documentationReceiptStatus({
        received: true,
        totalAssetCount: 1,
        contentAssetCount: 1,
      }),
      "received"
    );
  });

  it("defaults story slots to screenshots and reels to draft video", () => {
    assert.equal(defaultDeliverableAssetType("instagram_story"), "story_screenshot");
    assert.equal(defaultDeliverableAssetType("instagram_reel"), "draft_video");
    assert.equal(defaultDeliverableAssetType("instagram_post"), "feed_image");
  });
});
