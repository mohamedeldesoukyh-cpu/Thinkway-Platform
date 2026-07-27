import assert from "node:assert/strict";

import { buildShortlistDocument } from "@/features/discovery/shortlists/export/shortlist-document";
import { buildShortlistHtml } from "@/features/discovery/shortlists/export/shortlist-html";
import type { ShortlistTemplateVariant } from "@/features/discovery/shortlists/export/shortlist-template";
import { buildShortlistTemplatePayload } from "@/features/discovery/shortlists/templates/shortlist-template-payload";
import { buildShortlistTemplateHtml } from "@/features/discovery/shortlists/templates/shortlist-template-html";
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
    creators: [],
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
  const payload = buildShortlistTemplatePayload(docWithTemplate("summary"));
  assert.equal(payload.flags.showcaseCreators, false);
  assert.equal(payload.flags.includeInternalFields, false);
  assert.equal(payload.roster.sectionNo, "02");
  assert.equal(payload.shortlist.number, "SL-2026-0001");
}

{
  const payload = buildShortlistTemplatePayload(docWithTemplate("detailed"));
  assert.equal(payload.flags.includeInternalFields, true);
  assert.equal(payload.cover.kicker, "Discovery Shortlist · Detailed");
}

{
  const html = buildShortlistTemplateHtml(docWithTemplate("summary"));
  assert.ok(html.includes("Discovery Shortlist · Summary"));
  assert.ok(html.includes("Creator mix"));
  assert.ok(html.includes("Creators by category"));
  assert.ok(html.includes("Summary roster"));
  assert.ok(html.includes("fee-avatar"));
  assert.ok(html.includes("creator-name-cell"));
  assert.ok(html.includes("tier-breakdown-header"));
  assert.ok(html.includes("summary-overview-page"));
  assert.ok(html.includes("@page{size:A4 landscape; margin:0;}"));
  assert.ok(html.includes("--sl-page-h:210mm"));
  assert.ok(html.includes("sl-measure-root"));
  assert.ok(html.includes("sl-page-root"));
  assert.ok(html.includes("paginateShowcase"));
  assert.ok(html.includes("--blue:#0057FF"));
  assert.ok(!html.includes("Proposed deliverables"));
  assert.ok(!html.includes("Commercial summary"));
}

{
  const showcaseHtml = buildShortlistTemplateHtml(docWithTemplate("showcase"));
  assert.ok(showcaseHtml.includes("Discovery Shortlist · Showcase"));
  assert.ok(showcaseHtml.includes("sc-avatar"));
  assert.ok(showcaseHtml.includes("showcase-creator-page"));
  assert.ok(showcaseHtml.includes("shortlist-export-preview"));
  assert.ok(showcaseHtml.includes("Recent publications"));
  assert.ok(showcaseHtml.includes("Shortlist context"));
  assert.ok(showcaseHtml.includes("position:absolute"));
  assert.ok(showcaseHtml.includes("height:calc(var(--sl-page-h) - var(--sl-footer-h))"));
  assert.ok(showcaseHtml.includes('data-sl-block'));
  assert.ok(showcaseHtml.includes("getBoundingClientRect"));
  assert.ok(!showcaseHtml.includes("Proposed deliverables"));
}

{
  const pdfHtml = buildShortlistTemplateHtml(docWithTemplate("showcase"), { forPdf: true });
  assert.ok(pdfHtml.includes('body class="shortlist-export-print shortlist-showcase shortlist-report"'));
  assert.ok(pdfHtml.includes("@page{size:A4 landscape; margin:0;}"));
  assert.ok(pdfHtml.includes("--sl-page-h:210mm"));
  assert.ok(pdfHtml.includes("height:210mm !important"));
  assert.ok(pdfHtml.includes("position:absolute"));
  assert.ok(pdfHtml.includes("bottom:0"));
  assert.ok(pdfHtml.includes("margin-top:0 !important"));
  assert.ok(pdfHtml.includes("paginateShowcase"));
  assert.ok(pdfHtml.includes("data-sl-paginated"));
  assert.ok(pdfHtml.includes("summary-tier-page") || pdfHtml.includes("summary-totals-page"));
  assert.ok(!pdfHtml.includes('body class="shortlist-export-preview'));
  // Preview and PDF share the same pagination engine (forPdf only flips body class).
  const previewHtml = buildShortlistTemplateHtml(docWithTemplate("showcase"), { forPdf: false });
  assert.ok(previewHtml.includes("paginateShowcase"));
  assert.equal(
    previewHtml.includes("sl-measure-root"),
    pdfHtml.includes("sl-measure-root")
  );
}

{
  const wrapperHtml = buildShortlistHtml(docWithTemplate("summary"));
  assert.ok(wrapperHtml.includes("Discovery Shortlist · Summary"));
}

console.log("shortlist-template.test.ts passed");
