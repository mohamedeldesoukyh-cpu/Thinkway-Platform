import assert from "node:assert/strict";

import { shortlistDocumentToQuotationDocument } from "@/features/discovery/shortlists/export/shortlist-as-quotation-document";
import { buildShortlistDocument } from "@/features/discovery/shortlists/export/shortlist-document";
import { buildShortlistHtml } from "@/features/discovery/shortlists/export/shortlist-html";
import type { ShortlistTemplateVariant } from "@/features/discovery/shortlists/export/shortlist-template";
import type { ShortlistDetail } from "@/features/discovery/shortlists/types";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

function mockCreator(overrides: Partial<UnifiedCreatorResult> = {}): UnifiedCreatorResult {
  return {
    unified_id: "inf:test",
    source_type: "imported",
    influencer_id: "test",
    discovered_profile_id: null,
    document_number: null,
    display_name: "Test Creator",
    status: "active",
    country_code: "EG",
    estimated_country: "EG",
    city: null,
    categories: ["Fitness"],
    language_codes: [],
    profile_image_url: "https://cdn.example.com/avatar.jpg",
    bio: null,
    metrics: {
      followers: { value: 125_000, confidence: "estimated" },
      engagement_rate: { value: 3.2, confidence: "estimated" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      avg_views: { value: null, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
    ai_category: null,
    ai_niche: null,
    authenticity_score: 85,
    thinkway_score: 72,
    source_confidence: 0.5,
    brand_fit_score: null,
    is_platform_verified: true,
    platforms: [
      {
        id: "pa-1",
        platform: "instagram",
        handle: "testcreator",
        profile_url: "https://www.instagram.com/testcreator/",
        follower_count: 125_000,
        engagement_rate: 3.2,
        audience_country: "EG",
        sync_source: "imported",
      },
    ],
    ...overrides,
  };
}

function mockDetail(overrides: Partial<ShortlistDetail> = {}): ShortlistDetail {
  return {
    id: "sl-1",
    serial_number: "SL-2026-0001",
    slug: null,
    name: "Summer Creators",
    description: "Top picks for Q3",
    status: "approved",
    visibility: "team",
    currency: "EGP",
    owner_id: "user-1",
    owner_name: "Alex Manager",
    created_by: "user-1",
    client_id: "client-1",
    client_name: "Acme Corp",
    brand_id: "brand-1",
    brand_name: "Acme Brand",
    approved_by: null,
    approved_by_name: null,
    approved_at: null,
    submitted_at: null,
    cancelled_at: null,
    cancellation_reason: null,
    is_archived: false,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-13T08:00:00.000Z",
    movements: [],
    movedAssignments: [],
    linkedQuotations: [],
    canManage: true,
    canApprove: true,
    creators: [
      {
        item_id: "item-1",
        influencer_id: "test",
        profile_id: null,
        unified_id: "inf:test",
        item_status: "approved",
        match_score: 82,
        notes: "Strong fit",
        platform_account_ids: ["pa-1"],
        quotation_refs: [],
        collapse_group_id: null,
        collapse_label: null,
        creator: mockCreator(),
      },
    ],
    ...overrides,
  };
}

function docWithTemplate(template: ShortlistTemplateVariant) {
  return buildShortlistDocument(mockDetail(), { template });
}

{
  const mapped = shortlistDocumentToQuotationDocument(docWithTemplate("detailed"));
  assert.equal(mapped.source, "shortlist");
  assert.equal(mapped.template, "detailed");
  assert.equal(mapped.serial, "SL-2026-0001");
  assert.equal(mapped.summary.totalClientCost, "—");
}

{
  const html = buildShortlistHtml(docWithTemplate("lump-sum"));
  assert.ok(html.includes("Discovery Shortlist · Lump Sum"));
  assert.ok(html.includes("Creator mix"));
  assert.ok(html.includes("Creators by category"));
  assert.ok(html.includes("At a glance"));
  assert.ok(html.includes("quotation-export-preview"));
  assert.ok(html.includes("shortlist-report"));
  assert.ok(html.includes('class="cpage') || html.includes("cpage page"));
  assert.ok(html.includes("@page{ size:297mm 210mm"));
  assert.ok(html.includes("--blue:#0057ff"));
  assert.ok(!html.includes("Commercial summary"));
  assert.ok(!html.includes("Proposed deliverable"));
  assert.ok(!html.includes("sl-measure-root"));
}

{
  const html = buildShortlistHtml(docWithTemplate("detailed"));
  assert.ok(html.includes("Discovery Shortlist"));
  assert.ok(!html.includes("Client Quotation"));
  assert.ok(!html.includes("id=\"section-commercial\""));
  assert.ok(!html.includes("Terms &amp; conditions"));
}

{
  const showcaseHtml = buildShortlistHtml(docWithTemplate("showcase"));
  assert.ok(showcaseHtml.includes("Discovery Shortlist · Showcase"));
  assert.ok(showcaseHtml.includes("Showcase Shortlist — Summer Creators"));
  assert.ok(showcaseHtml.includes("sc-avatar"));
  assert.ok(showcaseHtml.includes("showcase-creator-page"));
  assert.ok(showcaseHtml.includes("Recent publications"));
  assert.ok(showcaseHtml.includes("quotation-export-preview"));
  assert.ok(showcaseHtml.includes("quotation-showcase"));
  assert.ok(showcaseHtml.includes("TOTAL AUDIENCE"));
  assert.ok(!showcaseHtml.includes("Proposed deliverable"));
  assert.ok(!showcaseHtml.includes("Client investment"));
  assert.ok(!showcaseHtml.includes("sl-measure-root"));
}

{
  const pdfHtml = buildShortlistHtml(docWithTemplate("showcase"), { forPdf: true });
  assert.ok(pdfHtml.includes('body class="quotation-export-print quotation-showcase quotation-report shortlist-report"'));
  assert.ok(!pdfHtml.includes('body class="quotation-export-preview'));
  const previewHtml = buildShortlistHtml(docWithTemplate("showcase"), { forPdf: false });
  assert.equal(
    previewHtml.includes("cpage"),
    pdfHtml.includes("cpage")
  );
}

{
  const pitchLumpHtml = buildShortlistHtml(docWithTemplate("pitch-lump-sum"));
  assert.ok(pitchLumpHtml.includes("Discovery Shortlist · Pitch Lump-Sum"));
  assert.ok(pitchLumpHtml.includes("quotation-pitch"));
  assert.ok(!pitchLumpHtml.includes("Commercial summary"));
}

{
  const wrapperHtml = buildShortlistHtml(docWithTemplate("detailed"));
  assert.ok(wrapperHtml.includes("Shortlist No."));
  assert.ok(!wrapperHtml.includes("Quotation No."));
}

console.log("shortlist-template.test.ts passed");
