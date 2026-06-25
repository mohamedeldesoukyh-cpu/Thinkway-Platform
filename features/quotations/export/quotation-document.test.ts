import assert from "node:assert/strict";

import { buildQuotationDocument } from "@/features/quotations/export/quotation-document";
import { buildQuotationHtml } from "@/features/quotations/export/quotation-html";
import type { QuotationDetail } from "@/features/quotations/types";

function mockDetail(overrides: Partial<QuotationDetail> = {}): QuotationDetail {
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
    items: [],
    revisions: [],
    canManage: true,
    estimated_reach: 0,
    estimated_engagement_rate: null,
    ...overrides,
  };
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
    !doc.commercialKpis.some((k) => k.label === "Total Revenue"),
    "Agency revenue label must not appear in document KPIs"
  );
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
  assert.ok(!html.includes(">Revenue<"), "Revenue column header must not appear in HTML");
  assert.ok(!html.includes("Total Revenue"), "Total Revenue label must not appear in HTML");
  assert.ok(!html.includes("Budget (Revenue)"), "Cover hero must not use Budget (Revenue)");
}

console.log("quotation-document.test.ts passed");
