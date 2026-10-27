import assert from "node:assert/strict";
import { test } from "node:test";
import { otherServiceSeed, otherServicePlatforms, isOtherService } from "./other-service";
import { lineAssignmentPayloadSchema } from "@/lib/campaigns/schemas";
import { mapQuotationItemsToExecutionLineSeeds, type QuotationItemExecutionRow } from "@/lib/domains/commercial/quotation-execution-mapper";
import { buildQuotationConvertUnits } from "@/lib/domains/commercial/quotation-convert-selection";
import { packagePlatformsToCommercialRows } from "@/lib/assignments/sync-package-deliverables";
import { resolveLineVatInput } from "@/lib/services/campaigns/campaign-commercial";
import { countUniqueQuotationCreators } from "@/features/quotations/export/quotation-export-utils";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { countUniqueQuotationCreators as workspaceCreatorCount } from "@/lib/quotations/quotation-creator-options";
import { quotationItemsForClient } from "@/features/client-workspace/source-readiness";
import { quotationItemSnapshotCreator, overlayQuotationDetailOnCreators } from "@/features/client-workspace/quotation-client-overlay";

const vendorId = "11111111-1111-4111-8111-111111111111";
function item(id: string, cost = 8000.25, revenue = 12000.75): QuotationItemRow {
  return { ...otherServiceSeed({ vendorId, title: "Videographer", description: "One shoot day and edited film", cost, revenue, currency: "EGP", agencyFeePercent: 10 }, "Studio Vendor"),
    id, sort_order: Number(id) || 0, option_number: null } as QuotationItemRow;
}

test("vendor service needs no fabricated social account; social lines still require one", () => {
  assert.equal(lineAssignmentPayloadSchema.safeParse({ platforms: otherServicePlatforms("Studio Vendor") }).success, true);
  assert.equal(lineAssignmentPayloadSchema.safeParse({ platforms: [{ ...otherServicePlatforms("Studio Vendor")[0], platform: "instagram", deliverables: ["instagram_reel"] }] }).success, false);
  assert.equal(isOtherService({ deliverables: [null] }), false);
});

test("all services from one vendor remain independently selectable and convert, even without explicit selection", () => {
  const rows = [item("1"), item("2")];
  assert.equal(buildQuotationConvertUnits(rows).length, 2);
  assert.equal(countUniqueQuotationCreators(rows), 0);
  assert.equal(workspaceCreatorCount(rows), 0);
  const seeds = mapQuotationItemsToExecutionLineSeeds({ items: rows as QuotationItemExecutionRow[], creators: [], influencerIdByCreatorId: new Map(), defaultCurrency: "EGP" });
  assert.equal(seeds.length, 2);
  assert.equal(seeds[0].influencerId, vendorId);
  assert.equal(seeds[0].cost, 8000.25);
  assert.equal(seeds[0].revenue, 12000.75);
  assert.equal(seeds[0].platforms[0].deliverables[0], "other_service");
});

test("client review keeps each supplier service independent without leaking supplier identity or costs", () => {
  const rows = [item("1"), item("2")];
  const visible = quotationItemsForClient(rows);
  assert.equal(visible.length, 2);
  const snapshots = visible.map(row => quotationItemSnapshotCreator(row, "EGP", 1, rows));
  assert.deepEqual(snapshots.map(row => row.creatorId), ["service:1", "service:2"]);
  assert.equal(snapshots[0].influencerId, undefined);
  assert.equal(snapshots[0].categories?.[0], "Others");
  assert.equal(snapshots[0].quotationOptions?.length, 1);
  assert.equal(overlayQuotationDetailOnCreators(snapshots, rows, "EGP", 1, rows).length, 2);
});

test("free or zero-cost services retain intentional zero prices during conversion", () => {
  const seeds = mapQuotationItemsToExecutionLineSeeds({ items: [item("1", 0, 2500), item("2", 900, 0)] as QuotationItemExecutionRow[], creators: [], influencerIdByCreatorId: new Map(), defaultCurrency: "EGP" });
  assert.deepEqual(seeds.map(row => [row.cost, row.revenue]), [[0, 2500], [900, 0]]);
});

test("service deliverables preserve supplier costs and billable revenue for normal billing allocation", () => {
  const rows = packagePlatformsToCommercialRows(otherServicePlatforms("Studio Vendor", 3), { totalRevenueBeforeVat: 12000.75, totalCostBeforeVat: 8000.25, dueDate: "2026-11-01" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].quantity, 3);
  assert.equal(rows[0].deliverable_type, "other_service");
  assert.equal(rows[0].revenue_before_vat * rows[0].quantity, 12000.75);
  assert.equal(rows[0].unit_cost * rows[0].quantity, 8000.25);
});

test("services use client and registered vendor VAT defaults; GP excludes VAT", () => {
  const result = resolveLineVatInput({ cost: 8000, revenue: 12000, revenue_vat_percent: 0, cost_vat_percent: -1, agency_fee_percent: 10 }, { clientVatRate: 14, vendorVatRate: 14, vendorVatRegistered: true });
  assert.equal(result.revenue_before_vat, 12000);
  assert.equal(result.revenue_vat_percent, 14);
  assert.equal(result.cost_vat_percent, 14);
  assert.equal(result.cost_before_vat, 8000);
});
