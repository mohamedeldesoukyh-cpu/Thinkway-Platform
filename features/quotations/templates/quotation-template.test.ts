import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildQuotationDocument } from "@/features/quotations/export/quotation-document";
import { buildQuotationTemplatePayload } from "@/features/quotations/templates/quotation-template-payload";
import { buildQuotationTemplateHtml } from "@/features/quotations/templates/quotation-template-html";
import type { QuotationDetail, QuotationItemRow } from "@/features/quotations/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplePath = join(__dirname, "quotation-sample.json");
const sampleFixture = JSON.parse(readFileSync(samplePath, "utf8")) as {
  flags: { itemizedPricing: boolean; showcaseCreators: boolean };
  quotation: { number: string; title: string };
  commercial: { sectionNo: string };
};

function mockItem(overrides: Partial<QuotationItemRow> = {}): QuotationItemRow {
  return {
    id: "item-1",
    influencer_id: "inf-1",
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
    profile_url: "https://www.instagram.com/creator/",
    deliverables: [],
    option_number: 1,
    service_description: "1× IG Reel",
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
    group_name: null,
    agency_or_direct: null,
    agency_name: null,
    is_temporary_client: false,
    is_temporary_brand: false,
    temporary_client_name: null,
    temporary_brand_name: null,
    brand_id: "b-1",
    brand_name: "Acme Brand",
    campaign_header_id: null,
    campaign_name: null,
    campaign_document_number: null,
    campaign_object_id: null,
    source_campaign_object_version: null,
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

{
  const payload = buildQuotationTemplatePayload(buildQuotationDocument(mockDetail()));
  assert.equal(payload.flags.itemizedPricing, true);
  assert.equal(payload.flags.showcaseCreators, false);
  assert.equal(payload.commercial.sectionNo, "02");
  assert.equal(payload.quotation.number, "QT-2026-0001");
}

{
  const html = buildQuotationTemplateHtml(buildQuotationDocument(mockDetail()));
  assert.ok(html.includes("Client Quotation"));
  assert.ok(html.includes("Creator mix"));
  assert.ok(html.includes("Creators by category"));
  assert.ok(html.includes("Commercial summary"));
  assert.ok(html.includes("Investment &amp; deliverables"));
  assert.ok(html.includes("Terms &amp; conditions"));
  assert.ok(html.includes("fee-avatar"));
  assert.ok(html.includes("creator-name-cell"));
  assert.ok(html.includes("Gross fees (EGP)"));
  assert.ok(html.includes("Total cost incl. AF"));
  assert.ok(html.includes("tier-tag"));
  assert.ok(html.includes("summary-overview-page"));
  assert.ok(html.includes("@page{ size:297mm 210mm"));
  assert.ok(html.includes("--blue:#0057ff"));
  assert.ok(html.includes('class="cpage') || html.includes("cpage page"));
}

{
  const showcaseHtml = buildQuotationTemplateHtml(
    buildQuotationDocument(mockDetail(), { template: "showcase" })
  );
  assert.ok(showcaseHtml.includes("Showcase Quotation — Test Quotation"));
  assert.ok(showcaseHtml.includes("sc-avatar"));
  assert.ok(showcaseHtml.includes("showcase-creator-page"));
  assert.ok(showcaseHtml.includes("Recent publications"));
  assert.ok(showcaseHtml.includes("Proposed deliverable"));
  assert.ok(showcaseHtml.includes("sc-metric"));
  assert.ok(showcaseHtml.includes("sc-er-list"));
  assert.ok(showcaseHtml.includes(">10K<"));
  assert.ok(showcaseHtml.includes("ml-with-icon"));
  assert.ok(showcaseHtml.includes("Noto+Sans+Arabic") || showcaseHtml.includes("Noto Sans Arabic"));
  assert.ok(showcaseHtml.includes("sc-fee-pill") || showcaseHtml.includes("EGP"));
  assert.ok(!showcaseHtml.includes("Terms &amp; conditions"));
  assert.ok(!showcaseHtml.includes('id="section-commercial"'));
  assert.ok(
    !showcaseHtml.includes('showcase-pubs-grid"><div class="pubs showcase-pubs-grid"'),
    "Creator publication grids must not be nested"
  );
  assert.ok(showcaseHtml.includes("roster-page"));
}

{
  const collapseDetail = mockDetail({
    items: [
      mockItem({
        id: "collapse-leader",
        collapse_group_id: "cg-1",
        collapse_label: "Collap",
        creator_name: "Creator A",
        handle: "@creator_a",
        sort_order: 1,
        deliverables: [{ platform: "instagram", type: "instagram_reel", quantity: 1 }],
      }),
      mockItem({
        id: "collapse-follower",
        collapse_group_id: "cg-1",
        collapse_label: "Collap",
        creator_name: "Creator B",
        handle: "@creator_b",
        sort_order: 2,
        deliverables: [],
      }),
    ],
  });
  const showcasePdfHtml = buildQuotationTemplateHtml(
    buildQuotationDocument(collapseDetail, { template: "showcase" }),
    { forPdf: true }
  );
  assert.ok(showcasePdfHtml.includes('body class="quotation-export-print quotation-showcase quotation-report"'));
  assert.ok(showcasePdfHtml.includes("@page{ size:297mm 210mm"));
  assert.ok(showcasePdfHtml.includes("showcase-creator-slide"));
  assert.ok(showcasePdfHtml.includes("collapse-content-slide"));
  assert.ok(
    (showcasePdfHtml.match(/collapse-content-slide/g) ?? []).length >= 1,
    "Each Collap option should render as its own PDF slide"
  );
  assert.ok(showcasePdfHtml.includes('class="cpage') || showcasePdfHtml.includes("cpage page"));
}

{
  const pdfHtml = buildQuotationTemplateHtml(buildQuotationDocument(mockDetail()), { forPdf: true });
  assert.ok(pdfHtml.includes('body class="quotation-export-print quotation-report"'));
  assert.ok(pdfHtml.includes("commercial-page"));
  assert.ok(!pdfHtml.includes("Commercial summary (continued)"));
}

{
  const lumpHtml = buildQuotationTemplateHtml(
    buildQuotationDocument(mockDetail(), { template: "lump-sum" })
  );
  assert.ok(lumpHtml.includes("Client Quotation · Lump Sum"));
  assert.ok(lumpHtml.includes("Lump-sum engagement"));
  assert.ok(!lumpHtml.includes("Gross fees (EGP)"));
}

{
  const pitchDoc = buildQuotationDocument(mockDetail(), { template: "pitch" });
  const pitchPayload = buildQuotationTemplatePayload(pitchDoc);
  assert.equal(pitchPayload.flags.pitchCreators, true);
  assert.equal(pitchPayload.flags.includeAcceptance, false);
  assert.equal(pitchPayload.flags.includeTerms, false);
  assert.equal(pitchPayload.showcaseCreators[0]?.views, "—");
  const pitchHtml = buildQuotationTemplateHtml(pitchDoc);
  assert.ok(!pitchHtml.includes("Pitch Presentation"));
  assert.ok(!pitchHtml.includes("Quotation No."));
  assert.ok(pitchHtml.includes("sc-metric"));
  assert.ok(pitchHtml.includes("Proposed deliverable"));
  assert.ok(!pitchHtml.includes(">Views<"));
  assert.ok(!pitchHtml.includes("Avg views"));
  assert.ok(!pitchHtml.includes("Acceptance"));
  assert.equal(pitchPayload.quotation.title.includes("Pitch Presentation"), false);
}

{
  const pitchLumpDoc = buildQuotationDocument(mockDetail(), {
    template: "pitch-lump-sum",
  });
  const pitchLumpPayload = buildQuotationTemplatePayload(pitchLumpDoc);
  assert.equal(pitchLumpPayload.flags.pitchCreators, true);
  assert.equal(pitchLumpPayload.flags.showCommercialSummary, true);
  assert.equal(pitchLumpPayload.flags.pricing, "lump_sum");
  assert.equal(pitchLumpPayload.flags.showFees, false);
  assert.equal(pitchLumpPayload.flags.includeAcceptance, false);
  const pitchLumpHtml = buildQuotationTemplateHtml(pitchLumpDoc);
  assert.ok(pitchLumpHtml.includes("Client RFQ Response · Lump-Sum"));
  assert.ok(pitchLumpHtml.includes("commercial-page"));
  assert.ok(!pitchLumpHtml.includes("Acceptance"));
}

{
  // Prefer workspace service description over reconstructed type labels (no extra IG Reel).
  const detail = mockDetail({
    items: [
      mockItem({
        service_description: null,
        deliverables: [
          {
            platform: "instagram",
            type: "instagram_reel",
            types: ["instagram_reel", "instagram_story", "mirrored_tt"],
            type_lines: [
              { type: "instagram_reel", quantity: 1 },
              { type: "instagram_story", quantity: 1 },
              { type: "mirrored_tt", quantity: 1 },
            ],
            quantity: 1,
            service_description: "1× IG Reel + 1× IG Story + 1× Mirrored TT",
          },
          {
            platform: "tiktok",
            type: "instagram_reel",
            types: ["instagram_reel"],
            type_lines: [{ type: "instagram_reel", quantity: 1 }],
            quantity: 1,
            service_description: null,
          },
        ],
      }),
    ],
  });
  const payload = buildQuotationTemplatePayload(buildQuotationDocument(detail));
  assert.equal(
    payload.feeLines[0]?.deliverable,
    "1× IG Reel + 1× IG Story + 1× Mirrored TT"
  );
  const html = buildQuotationTemplateHtml(buildQuotationDocument(detail));
  assert.ok(html.includes("1× IG Reel + 1× IG Story + 1× Mirrored TT"));
  assert.ok(!html.includes("1× IG Reel + 1× IG Story + 1× Mirrored TT + 1× IG Reel"));
}

{
  // Detailed cover shows Fees + Total Client Investment after Fees.
  const payload = buildQuotationTemplatePayload(buildQuotationDocument(mockDetail()));
  assert.equal(payload.cover.feeStat?.label, "Fees");
  assert.ok(payload.cover.feeStat?.value);
  assert.equal(
    payload.cover.totalAfterFeesStat?.label,
    "Total Client Investment after Fees"
  );
  assert.ok(payload.cover.totalAfterFeesStat?.value);
  const html = buildQuotationTemplateHtml(buildQuotationDocument(mockDetail()));
  assert.ok(html.includes(">Fees<"));
  assert.ok(html.includes("Total Client Investment after Fees"));
  assert.ok(html.includes("statrow--4") || html.includes("statrow--3"));
}

{
  // Est. engagement KPI lists each platform with icon + rate (not a single blended %).
  const detail = mockDetail({
    items: [
      mockItem({
        platform: "instagram",
        engagement_rate: 2.5,
        export_platforms: [
          {
            platform: "instagram",
            handle: "creator",
            followers: 10000,
            engagement_rate: 2.5,
            avg_views: 1000,
            profile_url: "https://instagram.com/creator",
            avatar_url: "https://cdn.example/ig.jpg",
          },
          {
            platform: "tiktok",
            handle: "creator",
            followers: 8000,
            engagement_rate: 4.1,
            avg_views: 2000,
            profile_url: "https://tiktok.com/@creator",
            avatar_url: "https://cdn.example/tt.jpg",
          },
        ],
      }),
    ],
  });
  const payload = buildQuotationTemplatePayload(buildQuotationDocument(detail));
  assert.ok(payload.campaign.estEngagementPlatforms.length >= 2);
  const platforms = payload.campaign.estEngagementPlatforms.map((row) =>
    row.platform.toLowerCase()
  );
  assert.ok(platforms.includes("instagram"));
  assert.ok(platforms.includes("tiktok"));
  const html = buildQuotationTemplateHtml(buildQuotationDocument(detail));
  assert.ok(html.includes("camp-er-list"));
  assert.ok(html.includes("sc-er-pct"));
  assert.ok(html.includes("2.50%") || html.includes("2.5%"));
  assert.ok(html.includes("4.10%") || html.includes("4.1%"));
}

{
  assert.equal(sampleFixture.quotation.number, "QT-2026-0012");
  assert.equal(sampleFixture.flags.itemizedPricing, true);
  assert.equal(sampleFixture.commercial.sectionNo, "02");
}

console.log("quotation-template.test.ts passed");
