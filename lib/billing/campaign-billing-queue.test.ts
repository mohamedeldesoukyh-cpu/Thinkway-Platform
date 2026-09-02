/**
 * Run: npm run test:partial-assignment-invoice
 */
import assert from "node:assert/strict";

import type { CampaignLineBillingStatus } from "@/lib/domains/campaign/types";
import {
  filterCampaignQueueRows,
  filterCampaignsWithRemainingInvoiceable,
  type CampaignBillingQueueRow,
} from "@/lib/billing/campaign-billing-queue";

function row(
  extras: Partial<CampaignBillingQueueRow> & {
    remaining_to_invoice: number;
    already_invoiced: number;
  }
): CampaignBillingQueueRow {
  const total = extras.total_campaign_amount ?? 1_000_000;
  const invoiced = extras.already_invoiced;
  const remaining = extras.remaining_to_invoice;
  return {
    campaign_header_id: extras.campaign_header_id ?? "c1",
    campaign_document_number: extras.campaign_document_number ?? "TW-2026-0007",
    campaign_name: extras.campaign_name ?? "Arab Bank",
    client_id: extras.client_id ?? "cl1",
    client_name: extras.client_name ?? "Client",
    brand_name: extras.brand_name ?? "Brand",
    legal_entity_name: extras.legal_entity_name ?? null,
    currency_code: extras.currency_code ?? "EGP",
    billing_status: (extras.billing_status ?? "draft") as CampaignLineBillingStatus,
    total_campaign_amount: total,
    achieved_revenue: extras.achieved_revenue ?? total,
    already_invoiced: invoiced,
    remaining_to_invoice: remaining,
    unachieved_revenue: extras.unachieved_revenue ?? 0,
    assignment_count: extras.assignment_count ?? 1,
    operational_row_count: extras.operational_row_count ?? 1,
  };
}

function testPartialInvoiceIsNotFullyAchieved() {
  const partial = row({
    remaining_to_invoice: 900_000,
    already_invoiced: 100_000,
    billing_status: "partially_invoiced",
  });
  const sixtyPercent = row({
    campaign_document_number: "TW-2026-0017",
    remaining_to_invoice: 400_000,
    already_invoiced: 600_000,
    billing_status: "partially_invoiced",
  });
  const unbilledDraft = row({
    remaining_to_invoice: 600_000,
    already_invoiced: 0,
    billing_status: "draft",
  });

  assert.equal(filterCampaignQueueRows([partial], "fully_achieved").length, 0);
  assert.equal(filterCampaignQueueRows([sixtyPercent], "fully_achieved").length, 0);
  assert.equal(filterCampaignQueueRows([unbilledDraft], "fully_achieved").length, 0);
  assert.equal(filterCampaignQueueRows([partial], "partially_invoiced").length, 1);
  assert.equal(filterCampaignQueueRows([sixtyPercent], "partially_invoiced").length, 1);
  assert.equal(filterCampaignQueueRows([partial], "invoiced").length, 0);
}

function testFullyInvoicedOnlyWhenRemainingIsGone() {
  const full = row({
    remaining_to_invoice: 0,
    already_invoiced: 1_000_000,
    billing_status: "invoiced",
  });
  assert.equal(filterCampaignQueueRows([full], "invoiced").length, 1);
  assert.equal(filterCampaignQueueRows([full], "fully_achieved").length, 1);
  assert.equal(filterCampaignQueueRows([full], "partially_invoiced").length, 0);
}

function testQueueKeepsRemainingCampaigns() {
  const sixtyPercent = row({
    campaign_document_number: "TW-2026-0017",
    remaining_to_invoice: 400_000,
    already_invoiced: 600_000,
    billing_status: "partially_invoiced",
  });
  const full = row({
    campaign_document_number: "TW-2026-0099",
    remaining_to_invoice: 0,
    already_invoiced: 1_000_000,
    billing_status: "invoiced",
  });
  const kept = filterCampaignsWithRemainingInvoiceable([sixtyPercent, full]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0]?.campaign_document_number, "TW-2026-0017");
}

function run() {
  testPartialInvoiceIsNotFullyAchieved();
  testFullyInvoicedOnlyWhenRemainingIsGone();
  testQueueKeepsRemainingCampaigns();
  console.log("campaign-billing-queue.test.ts: ok");
}

run();
