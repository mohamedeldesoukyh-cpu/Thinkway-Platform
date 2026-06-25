import assert from "node:assert/strict";

import { computeAgencyFee } from "@/lib/commercial/commercial-engine";
import { buildQuotationDocument } from "@/features/quotations/export/quotation-document";
import { buildQuotationHtml } from "@/features/quotations/export/quotation-html";
import type { QuotationDetail, QuotationItemRow } from "@/features/quotations/types";
import {
  computeLiveQuotationTotals,
  computeQuotationRowComputed,
  type QuotationRowDraft,
} from "@/features/quotations/quotation-row-math";

function mockItem(overrides: Partial<QuotationItemRow> = {}): QuotationItemRow {
  return {
    id: "item-1",
    influencer_id: null,
    profile_id: null,
    unified_id: null,
    source_shortlist_item_id: null,
    creator_name: "Creator A",
    platform: "instagram",
    handle: "@creator",
    followers: 10000,
    engagement_rate: 3,
    country_code: "EG",
    deliverables: [],
    commercial_input_mode: "cost_gp_pct",
    cost: 1000,
    cost_currency: "EGP",
    revenue: 1333.33,
    gp_pct: 25,
    gp_value: 333.33,
    fx_rate_to_egp: 1,
    cost_egp: 1000,
    revenue_egp: 1333.33,
    gp_value_egp: 333.33,
    af_pct: 10,
    af_value: 133.33,
    af_value_egp: 133.33,
    sort_order: 0,
    ...overrides,
  };
}

function mockDetail(overrides: Partial<QuotationDetail> = {}): QuotationDetail {
  const item = mockItem();
  return {
    id: "q-1",
    serial_number: "QT-2026-0001",
    name: "Test Quotation",
    status: "draft",
    shortlist_id: null,
    client_id: "c-1",
    client_name: "Acme Corp",
    brand_id: "b-1",
    brand_name: "Acme Brand",
    campaign_header_id: null,
    campaign_name: null,
    owner_id: null,
    owner_name: "Alex",
    approved_by: null,
    approved_at: null,
    currency: "EGP",
    total_cost_egp: 1000,
    total_revenue_egp: 1333.33,
    total_gp_value_egp: 333.33,
    total_gp_pct: 25,
    total_af_egp: 133.33,
    total_agency_margin_egp: 466.66,
    gp_target_pct: 25,
    notes: null,
    terms: null,
    prepared_by_name: "Alex",
    reviewed_by_name: null,
    client_signature_name: null,
    client_signed_at: null,
    issue_date: "2026-06-01",
    validity_date: "2026-06-16",
    version: "v1.0",
    department: "Influencer Marketing",
    change_summary: null,
    shared_with_client: false,
    client_visible: false,
    is_archived: false,
    is_expired: false,
    valid_days_remaining: 10,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    items: [item],
    revisions: [],
    canManage: true,
    estimated_reach: 10000,
    estimated_engagement_rate: 3,
    ...overrides,
  };
}

// AF = revenue × (AF% / 100)
{
  const af = computeAgencyFee({ revenue: 1333.33, afPct: 10, gpValue: 333.33 });
  assert.equal(af.afValue, 133.33);
  assert.ok(Math.abs(af.agencyMargin - 466.66) < 0.01);
}

// Live totals include AF
{
  const draft: QuotationRowDraft = {
    id: "a",
    mode: "cost_gp_pct",
    cost: 1000,
    costCurrency: "EGP",
    gpPct: 25,
    revenue: 0,
    gpValue: 0,
    afPct: 10,
    fxRateToEgp: 1,
  };
  const row = computeQuotationRowComputed(draft);
  assert.equal(row.afValueEgp, 133.33);
  assert.ok(Math.abs(row.agencyMarginEgp - (row.gpValueEgp + row.afValueEgp)) < 0.02);
  const totals = computeLiveQuotationTotals([draft]);
  assert.equal(totals.totalAfValueEgp, 133.33);
  assert.ok(
    Math.abs(totals.totalAgencyMarginEgp - (totals.totalGpValueEgp + totals.totalAfValueEgp)) <
      0.02
  );
}

{
  const doc = buildQuotationDocument(mockDetail());
  assert.equal(doc.serial, "QT-2026-0001");
  assert.ok(doc.preparedForLine.includes("Acme Corp"));
  assert.ok(doc.termsSections.length >= 5);
  assert.ok(
    doc.commercialKpis.some((k) => k.label === "Total client cost"),
    "KPI strip uses client-facing total label"
  );
  assert.ok(
    doc.commercialKpis.some((k) => k.label === "Total agency fee"),
    "Client KPIs include AF total"
  );
  assert.ok(
    !doc.commercialKpis.some((k) => k.label === "Total Revenue"),
    "Agency revenue label must not appear in document KPIs"
  );
  assert.ok(
    !doc.commercialKpis.some((k) => k.label === "Total Cost"),
    "Internal cost KPI must not appear in client document"
  );
  assert.equal(doc.rows[0]?.afPct, "10.0%");
}

{
  const html = buildQuotationHtml(buildQuotationDocument(mockDetail()));
  assert.ok(html.includes("Client Quotation"));
  assert.ok(html.includes("Terms &amp; Conditions"));
  assert.ok(html.includes("Prepared exclusively for Acme Corp"));
  assert.ok(html.includes("page-break"));
  assert.ok(html.includes("avoid-break"));
  assert.ok(html.includes("Client investment"));
  assert.ok(html.includes("Client cost"));
  assert.ok(html.includes("Total client cost"));
  assert.ok(html.includes("Agency fee (AF)"));
  assert.ok(html.includes("AF %"));
  assert.ok(!html.includes(">Revenue<"), "Revenue column header must not appear in HTML");
  assert.ok(!html.includes("Total Revenue"), "Total Revenue label must not appear in HTML");
  assert.ok(!html.includes("Budget (Revenue)"), "Cover hero must not use Budget (Revenue)");
  assert.ok(!html.includes(">Unit Cost<"), "Unit Cost column must not appear in client preview");
  assert.ok(!html.includes(">GP<"), "GP column must not appear in client preview");
  assert.ok(!html.includes(">GP%<"), "GP% column must not appear in client preview");
  assert.ok(!html.includes("Gross Profit"), "Gross Profit must not appear in client preview");
}

console.log("quotation-document.test.ts passed");
