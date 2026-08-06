import assert from "node:assert/strict";

import type { AssignmentHierarchy } from "@/lib/domains/campaign/assignment-hierarchy-types";
import type { CampaignWorkspace } from "@/lib/domains/campaign/workspace-types";
import {
  POSTING_DATE_STATUS_CONFIRMED,
  POSTING_DATE_STATUS_TENTATIVE,
} from "@/lib/campaigns/execution-schedule-metadata";

import { evaluateCampaignOperationalReadiness } from "./campaign-operational-readiness";

function baseWorkspace(overrides?: Partial<CampaignWorkspace>): CampaignWorkspace {
  return {
    id: "camp-1",
    document_number: "TW-2026-0001",
    name: "Summer Launch",
    description: null,
    brief: null,
    status: "active",
    currency_code: "EGP",
    start_date: null,
    end_date: null,
    platform: "instagram",
    group: null,
    client: null,
    brand: null,
    team: null,
    account_manager: null,
    financials: {
      budget: 100_000,
      revenue: 80_000,
      cost: 50_000,
      gp: 30_000,
      margin_percent: 37.5,
      po_total: 100_000,
      remaining_po: 20_000,
      po_consumed: 80_000,
      po_remaining_percent: 20,
      po_status: "active",
      po_health: "healthy",
      po_exceeded: false,
      po_banner_consumed: 80_000,
      billing_outstanding: 0,
      collected: 0,
    },
    po: {
      po_number: "PO-100",
      po_currency: "EGP",
      po_exchange_rate: 1,
      po_amount_original: 100_000,
      po_amount_campaign_currency: 100_000,
      po_consumed_amount: 80_000,
      po_remaining_amount: 20_000,
      po_remaining_percent: 20,
      po_status: "active",
      po_expiry_date: null,
      po_override_approved: false,
      po_override_reason: null,
      fx_snapshot_at: null,
      health: "healthy",
    },
    workflow_stage: "live",
    lines: [
      {
        id: "line-a",
        document_number: "TW-2026-0001-A",
        name: "Creator A",
        description: null,
        usage_period: null,
        status: "active",
        assignment_status: "assigned",
        platform: "instagram",
        influencer_id: "inf-a",
        influencer_name: "Creator A",
        creator_profile_image_url: null,
        influencer_avatar_url: null,
        creator_avatar_url: null,
        platform_summary: null,
        deliverable_count: 1,
        influencer_count: 1,
        campaign_influencer_id: "ci-a",
        vendor_payment_status: null,
        revenue: 40_000,
        cost: 25_000,
        revenue_before_vat: 40_000,
        usage_rights_amount: 0,
        usage_rights_cost: 0,
        agency_fee_percent: 0,
        agency_fee_amount: 0,
        revenue_vat_percent: 0,
        revenue_vat_amount: 0,
        revenue_after_vat: 40_000,
        revenue_vat_exempt: false,
        cost_received: 0,
        cost_received_currency: "EGP",
        cost_before_vat: 25_000,
        cost_vat_percent: 0,
        cost_vat_amount: 0,
        cost_after_vat: 25_000,
        cost_vat_exempt: false,
        vat_locked: false,
        gp: 15_000,
        margin_percent: 37.5,
        po_amount: 50_000,
        remaining_po: 10_000,
        billing_status: "draft",
        operational_status: "draft",
        vendor_io_id: null,
        vendor_io_document_number: null,
        revenue_locked: false,
        cost_locked: false,
        vendor_assignment_locked: false,
        finance_override_until: null,
        invoice_id: null,
        po_consumed: 40_000,
        po_over_consumed: false,
        payment_status: "pending",
        currency_code: "EGP",
        start_date: null,
        end_date: null,
        assignment: null,
        creator_platform_accounts: [],
      },
    ],
    vendors: [],
    deliverables: [],
    assignment_deliverable_count: 0,
    assignment_uploaded_deliverable_count: 0,
    publication_count: 0,
    invoices: [],
    payments: [],
    approvals: [],
    activity: [],
    blockers: [],
    client_io: { id: "io-1" } as CampaignWorkspace["client_io"],
    client_io_versions: [],
    client_io_milestones: [],
    client_io_send_recipients: [],
    client_io_send_history: [],
    client_io_sender_name: null,
    vendor_ios: [],
    campaign_intelligence: null,
    vat_context: {
      client_country_code: "EG",
      default_revenue_vat_percent: 14,
    },
    campaign_object_id: "co-1",
    quotation_id: "qt-1",
    ...overrides,
  };
}

function baseHierarchy(overrides?: Partial<AssignmentHierarchy>): AssignmentHierarchy {
  return {
    groups: [
      {
        line: baseWorkspace().lines[0]!,
        deliverables: [
          {
            id: "del-1",
            campaign_line_id: "line-a",
            sort_order: 1,
            label: "Instagram Reel",
            platform: "instagram",
            deliverable_type: "reel",
            deliverable_type_label: "Reel",
            quantity: 1,
            unit_cost: 25_000,
            unit_revenue: 40_000,
            live_date: "2026-08-01",
            notes: null,
            revenue_before_vat: 40_000,
            usage_rights_amount: 0,
            usage_rights_cost: 0,
            agency_fee_percent: 0,
            agency_fee_amount: 0,
            cost_before_vat: 25_000,
            revenue_vat_percent: 0,
            revenue_vat_amount: 0,
            revenue_after_vat: 40_000,
            cost_vat_amount: 0,
            billing_status: "draft",
            collection_status: "pending",
            invoice_id: null,
            invoice_document_number: null,
            payout_status: null,
            workflow_status: "draft",
            posts: [
              {
                id: "post-1",
                assignment_deliverable_id: "del-1",
                sequence_number: 1,
                label: "#1",
                platform: "instagram",
                deliverable_type: "reel",
                deliverable_type_label: "Reel",
                live_date: "2026-08-01",
                workflow_status: "draft",
                notes: null,
                revenue_per_post: 40_000,
                cost_per_post: 25_000,
                revenue_vat_percent: 0,
                revenue_vat_amount: 0,
                cost_vat_amount: 0,
                billing_status: "draft",
                collection_status: "pending",
                invoice_id: null,
                invoice_document_number: null,
                payout_status: null,
                is_locked: false,
                metadata: {
                  posting_date_status: POSTING_DATE_STATUS_CONFIRMED,
                  planned_posting_date: "2026-08-01",
                  planned_posting_label: null,
                  planned_week: null,
                  planned_day: null,
                  schedule_source: "plan",
                  inherited_at: new Date().toISOString(),
                },
              },
            ],
            remaining_amount: 40_000,
            invoiced_amount: 0,
            invoice_eligible: true,
            is_synthetic: false,
            is_locked: false,
            locked_at: null,
            live_ad_date_locked: false,
          },
        ],
        rollups: {
          deliverable_count: 1,
          revenue: 40_000,
          cost: 25_000,
          gp: 15_000,
          margin_percent: 37.5,
          invoiced_value: 0,
          remaining_value: 40_000,
          collected_value: 0,
        },
      },
    ],
    currency_code: "EGP",
    ...overrides,
  };
}

const ready = evaluateCampaignOperationalReadiness(baseWorkspace(), baseHierarchy());
assert.equal(ready.status, "operational_ready");
assert.equal(ready.mandatoryMissing.length, 0);
assert.equal(ready.statusLabel, "Operationally Ready");

const missingVendor = evaluateCampaignOperationalReadiness(
  baseWorkspace({
    lines: [
      {
        ...baseWorkspace().lines[0]!,
        influencer_id: null,
        campaign_influencer_id: null,
      },
    ],
  }),
  baseHierarchy()
);
assert.equal(missingVendor.status, "needs_attention");
assert.ok(missingVendor.mandatoryMissing.some((item) => item.id === "vendor_assignments"));

const tentativeOnly = evaluateCampaignOperationalReadiness(
  baseWorkspace(),
  baseHierarchy({
    groups: [
      {
        ...baseHierarchy().groups[0]!,
        deliverables: [
          {
            ...baseHierarchy().groups[0]!.deliverables[0]!,
            live_date: null,
            posts: [
              {
                ...baseHierarchy().groups[0]!.deliverables[0]!.posts[0]!,
                live_date: null,
                metadata: {
                  posting_date_status: POSTING_DATE_STATUS_TENTATIVE,
                  planned_posting_date: "2026-08-15",
                  planned_posting_label: "Week 3",
                  planned_week: 3,
                  planned_day: null,
                  schedule_source: "plan",
                  inherited_at: new Date().toISOString(),
                },
              },
            ],
          },
        ],
      },
    ],
  })
);
assert.equal(tentativeOnly.mandatoryMissing.length, 0, "tentative dates satisfy mandatory posting_dates");
assert.ok(
  tentativeOnly.optional.some((item) => item.id === "posting_dates_confirmed" && !item.satisfied),
  "tentative dates do not satisfy optional confirmed check"
);

const missingCommercials = evaluateCampaignOperationalReadiness(
  baseWorkspace(),
  baseHierarchy({
    groups: [
      {
        ...baseHierarchy().groups[0]!,
        deliverables: [
          {
            ...baseHierarchy().groups[0]!.deliverables[0]!,
            revenue_before_vat: 0,
            cost_before_vat: 0,
          },
        ],
      },
    ],
  })
);
assert.ok(missingCommercials.mandatoryMissing.some((item) => item.id === "commercials"));

console.log("campaign-operational-readiness.test.ts — all tests passed");
