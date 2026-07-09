import assert from "node:assert/strict";

import {
  getReportPlatformIconDataUri,
  getReportPlatformIconTitle,
} from "@/lib/performance/report/report-platform-icons";
import { buildQuotationDocument } from "@/features/quotations/export/quotation-document";
import { buildQuotationHtml } from "@/features/quotations/export/quotation-html";
import type { QuotationDetail, QuotationItemRow } from "@/features/quotations/types";

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
    profile_image_url: null,
    profile_url: null,
    deliverables: [],
    option_number: 1,
    service_description: null,
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
    shortlist_serial: null,
    client_id: "c-1",
    client_name: "Acme Corp",
    is_temporary_client: false,
    is_temporary_brand: false,
    temporary_client_name: null,
    temporary_brand_name: null,
    brand_id: "b-1",
    brand_name: "Acme Brand",
    campaign_header_id: null,
    campaign_name: null,
    campaign_document_number: null,
    parent_quotation_id: null,
    version_number: 1,
    revision_notes: null,
    sync_enabled: true,
    version_chain: [],
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
    client_onboarding_status: null,
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

// Report platform icon data URIs
{
  const ig = getReportPlatformIconDataUri("instagram");
  const fb = getReportPlatformIconDataUri("facebook");
  const yt = getReportPlatformIconDataUri("youtube");
  const fbAlias = getReportPlatformIconDataUri("fb");
  const ytAlias = getReportPlatformIconDataUri("yt");
  const ytType = getReportPlatformIconDataUri("yt_short");

  assert.ok(ig?.startsWith("data:image/png;base64,"), "Instagram icon is PNG data URI");
  assert.ok(fb?.startsWith("data:image/svg+xml;base64,"), "Facebook icon is SVG data URI");
  assert.ok(yt?.startsWith("data:image/svg+xml;base64,"), "YouTube icon is SVG data URI");
  assert.equal(fb, fbAlias, "fb alias resolves to facebook icon");
  assert.equal(yt, ytAlias, "yt alias resolves to youtube icon");
  assert.equal(yt, ytType, "yt_short post type resolves to youtube icon");

  assert.equal(getReportPlatformIconTitle("fb"), "Facebook");
  assert.equal(getReportPlatformIconTitle("yt_video"), "YouTube");
}

// Quotation HTML renders platform logos, not text badges
{
  const detail = mockDetail({
    items: [
      mockItem({
        id: "fb-item",
        platform: "facebook",
        deliverables: [{ type: "facebook_reel", types: ["facebook_reel"] }],
      }),
      mockItem({
        id: "yt-item",
        platform: "youtube",
        deliverables: [{ type: "yt_short", types: ["yt_short"] }],
      }),
    ],
  });
  const html = buildQuotationHtml(buildQuotationDocument(detail));

  assert.ok(html.includes('class="platform-link-icon"'), "Platform logo images render in export");
  assert.ok(html.includes('title="Facebook"'), "Facebook platform title on icon");
  assert.ok(html.includes('title="YouTube"'), "YouTube platform title on icon");
  assert.ok(!html.includes('class="platform-text-badge">Facebook'), "Facebook must not fall back to text badge");
  assert.ok(!html.includes('class="platform-text-badge">YouTube'), "YouTube must not fall back to text badge");
}

console.log("report-platform-icons.test.ts passed");
