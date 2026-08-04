/**
 * Product excellence validation for Shortlist / Quotation export layouts.
 *
 * Generates fixture HTML (+ PPTX when possible) for:
 * 1 / 2 / 5 / 10 / 50 creators · long descriptions · long notes · multi-currency
 *
 * Usage: npx tsx scripts/validate-shortlist-quotation-export-quality.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildShortlistDocument } from "@/features/discovery/shortlists/export/shortlist-document";
import { buildShortlistHtml } from "@/features/discovery/shortlists/export/shortlist-html";
import { buildShortlistPptxBuffer } from "@/features/discovery/shortlists/export/shortlist-pptx";
import type { ShortlistCreatorItem, ShortlistDetail } from "@/features/discovery/shortlists/types";
import { buildQuotationDocument } from "@/features/quotations/export/quotation-document";
import { buildQuotationHtml } from "@/features/quotations/export/quotation-html";
import { buildQuotationPptxBuffer } from "@/features/quotations/export/quotation-pptx";
import type { QuotationDetail, QuotationItemRow } from "@/features/quotations/types";

const OUT_DIR = join(process.cwd(), "tmp", "export-quality-validation");

const LONG_DESCRIPTION =
  "Full commercial rationale for this creator partnership. ".repeat(12) +
  "\n\nDeliverables include concepting, scripting, on-camera delivery, and paid amplification rights for 90 days across MENA markets.";

const LONG_NOTES =
  "Why selected: category authority with proven conversion in beauty and lifestyle.\n" +
  "Recommendation: prioritize Option 2 package for Q4 flight.\n" +
  "Pricing explanation: influencer fee covers primary asset + 2 organic cutdowns; agency fee covers briefing, QC, and reporting.\n" +
  LONG_DESCRIPTION;

function mockUnified(handle: string, name: string): NonNullable<ShortlistCreatorItem["creator"]> {
  return {
    unified_id: `u-${handle}`,
    source_type: "imported",
    influencer_id: `inf-${handle}`,
    discovered_profile_id: null,
    document_number: null,
    display_name: name,
    status: "active",
    country_code: "EG",
    estimated_country: "EG",
    city: null,
    categories: ["Lifestyle", "Beauty"],
    language_codes: [],
    profile_image_url: null,
    bio: null,
    metrics: {
      followers: { value: 120_000, confidence: "estimated" },
      engagement_rate: { value: 3.4, confidence: "estimated" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      avg_views: { value: null, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
    ai_category: null,
    ai_niche: null,
    authenticity_score: 82,
    thinkway_score: 70,
    source_confidence: 0.5,
    brand_fit_score: null,
    is_platform_verified: false,
    platforms: [
      {
        id: `p-${handle}`,
        platform: "instagram",
        handle,
        profile_url: `https://instagram.com/${handle}`,
        follower_count: 120_000,
        engagement_rate: 3.4,
        audience_country: "EG",
        sync_source: "imported",
      },
    ],
  };
}

function shortlistCreator(index: number, longNotes = false): ShortlistCreatorItem {
  const handle = `creator${index}`;
  return {
    item_id: `sl-item-${index}`,
    item_status: "approved",
    notes: longNotes ? LONG_NOTES : index % 2 === 0 ? `Short note ${index}` : null,
    match_score: 80,
    unified_id: `u-${handle}`,
    profile_id: null,
    influencer_id: `inf-${handle}`,
    platform_account_ids: [`p-${handle}`],
    creator: mockUnified(handle, `Creator ${index}`),
    quotation_refs: [],
    collapse_group_id: null,
    collapse_label: null,
  };
}

function mockShortlist(count: number, longNotes = false): ShortlistDetail {
  return {
    id: "sl-quality",
    serial_number: "SL-QA-0001",
    slug: null,
    name: `Quality Shortlist (${count})`,
    description: LONG_DESCRIPTION,
    status: "approved",
    visibility: "team",
    currency: "EGP",
    owner_id: "user-1",
    owner_name: "QA Planner",
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
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-04T00:00:00.000Z",
    creators: Array.from({ length: count }, (_, i) => shortlistCreator(i + 1, longNotes)),
    movements: [],
    movedAssignments: [],
    linkedQuotations: [],
    canManage: true,
    canApprove: true,
  };
}

function mockQuotationItem(index: number, currency: string, longService = false): QuotationItemRow {
  const handle = `@qt_creator${index}`;
  const fx = currency === "USD" ? 50 : 1;
  return {
    id: `qt-item-${index}`,
    influencer_id: null,
    profile_id: null,
    unified_id: `u-qt-${index}`,
    source_shortlist_item_id: null,
    creator_name: `QT Creator ${index}`,
    platform: index % 2 === 0 ? "tiktok" : "instagram",
    handle,
    followers: 50_000 * index,
    engagement_rate: 2.5 + index * 0.1,
    country_code: "EG",
    profile_image_url: null,
    profile_url: null,
    deliverables: [
      {
        platform: index % 2 === 0 ? "tiktok" : "instagram",
        type: "reel",
        quantity: 1,
        service_description: longService ? LONG_DESCRIPTION : `1× primary asset option ${index}`,
      },
      {
        platform: index % 2 === 0 ? "tiktok" : "instagram",
        type: "story",
        quantity: 3,
        service_description: longService
          ? "Story sequence with swipe-up / link sticker plus usage rights clarification for paid social."
          : "3× stories",
      },
    ],
    option_number: 1,
    service_description: longService ? LONG_DESCRIPTION : `Package ${index} — 1× reel + stories`,
    commercial_input_mode: "cost_gp_pct",
    cost: 1000 * index,
    cost_currency: currency,
    revenue: 1400 * index,
    gp_pct: 25,
    gp_value: 400 * index,
    fx_rate_to_egp: fx,
    cost_egp: 1000 * index * fx,
    revenue_egp: 1400 * index * fx,
    gp_value_egp: 400 * index * fx,
    af_pct: 10,
    af_value: 140 * index,
    af_value_egp: 140 * index * fx,
    sort_order: index,
    collapse_group_id: null,
    collapse_label: null,
  };
}

function mockQuotation(count: number, options?: { longService?: boolean; multiCurrency?: boolean }): QuotationDetail {
  const items = Array.from({ length: count }, (_, i) =>
    mockQuotationItem(
      i + 1,
      options?.multiCurrency && i % 2 === 1 ? "USD" : "EGP",
      options?.longService
    )
  );
  const totalRevenue = items.reduce((sum, item) => sum + item.revenue_egp, 0);
  const totalCost = items.reduce((sum, item) => sum + item.cost_egp, 0);
  const totalAf = items.reduce((sum, item) => sum + item.af_value_egp, 0);
  const totalGp = items.reduce((sum, item) => sum + item.gp_value_egp, 0);

  return {
    id: "qt-quality",
    serial_number: "QT-QA-0001",
    name: `Quality Quotation (${count})`,
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
    campaign_name: "QA Campaign",
    campaign_document_number: null,
    campaign_object_id: null,
    source_campaign_object_version: null,
    parent_quotation_id: null,
    version_number: 1,
    revision_notes: null,
    sync_enabled: true,
    version_chain: [],
    owner_id: "u-1",
    owner_name: "QA Planner",
    approved_by: null,
    approved_at: null,
    currency: "EGP",
    total_cost_egp: totalCost,
    total_revenue_egp: totalRevenue,
    total_gp_value_egp: totalGp,
    total_gp_pct: totalRevenue > 0 ? (totalGp / totalRevenue) * 100 : 0,
    total_af_egp: totalAf,
    total_agency_margin_egp: totalAf,
    gp_target_pct: 25,
    notes: LONG_NOTES,
    terms: "Standard Thinkway terms apply.\n\n" + LONG_DESCRIPTION,
    prepared_by_name: "QA Planner",
    reviewed_by_name: null,
    client_signature_name: null,
    client_signed_at: null,
    client_onboarding_status: null,
    issue_date: "2026-08-01",
    validity_date: "2026-12-31",
    version: "v1.0",
    department: "Influencer Marketing",
    change_summary: null,
    shared_with_client: false,
    client_visible: false,
    is_archived: false,
    is_expired: false,
    valid_days_remaining: 149,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-04T00:00:00.000Z",
    items,
    revisions: [],
    canManage: true,
    audience_size: 100000,
    estimated_reach: 80000,
    estimated_engagement_rate: 3.1,
  };
}

type Check = { name: string; ok: boolean; detail?: string };

function validateHtml(label: string, html: string, expectedCreators: number): Check[] {
  const checks: Check[] = [];
  const pageCount = (html.match(/class="[^"]*\bpage\b/g) ?? []).length;
  checks.push({
    name: `${label}: has pages`,
    ok: pageCount > 0,
    detail: `pages=${pageCount}`,
  });
  checks.push({
    name: `${label}: no ellipsis truncation markers in body text classes`,
    ok: !html.includes("text-overflow:ellipsis") && !html.includes("line-clamp-"),
  });
  checks.push({
    name: `${label}: descriptions wrap`,
    ok: html.includes("overflow-wrap") || html.includes("white-space:pre-wrap") || html.includes("word-break"),
  });
  checks.push({
    name: `${label}: creator count reflected`,
    ok:
      html.includes(`of ${expectedCreators}`) ||
      html.includes(`(${expectedCreators})`) ||
      html.includes(`>${expectedCreators}<`) ||
      expectedCreators === 0,
    detail: `expectedCreators=${expectedCreators}`,
  });
  checks.push({
    name: `${label}: no empty page shells`,
    ok: !html.includes('<div class="pad"></div>'),
  });
  return checks;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const allChecks: Check[] = [];

  const scenarios = [
    { count: 1, long: false, multi: false },
    { count: 2, long: false, multi: false },
    { count: 5, long: true, multi: false },
    { count: 10, long: true, multi: true },
    { count: 50, long: true, multi: true },
  ] as const;

  for (const scenario of scenarios) {
    const sl = mockShortlist(scenario.count, scenario.long);
    const slDoc = buildShortlistDocument(sl, { template: "showcase" });
    const slHtml = buildShortlistHtml(slDoc, { forPdf: true });
    const slPath = join(OUT_DIR, `shortlist-${scenario.count}${scenario.long ? "-long" : ""}.html`);
    writeFileSync(slPath, slHtml, "utf8");
    allChecks.push(...validateHtml(`shortlist/${scenario.count}`, slHtml, scenario.count));

    try {
      const pptx = await buildShortlistPptxBuffer(slDoc);
      writeFileSync(
        join(OUT_DIR, `shortlist-${scenario.count}${scenario.long ? "-long" : ""}.pptx`),
        pptx
      );
      allChecks.push({ name: `shortlist/${scenario.count}: pptx built`, ok: true });
    } catch (error) {
      allChecks.push({
        name: `shortlist/${scenario.count}: pptx built`,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }

    const qt = mockQuotation(scenario.count, {
      longService: scenario.long,
      multiCurrency: scenario.multi,
    });
    const qtDoc = buildQuotationDocument(qt, { template: "showcase" });
    const qtHtml = buildQuotationHtml(qtDoc, { forPdf: true });
    writeFileSync(
      join(OUT_DIR, `quotation-${scenario.count}${scenario.long ? "-long" : ""}${scenario.multi ? "-fx" : ""}.html`),
      qtHtml,
      "utf8"
    );
    allChecks.push(...validateHtml(`quotation/${scenario.count}`, qtHtml, scenario.count));
    allChecks.push({
      name: `quotation/${scenario.count}: full service description present`,
      ok: !scenario.long || qtHtml.includes("Full commercial rationale"),
    });
    allChecks.push({
      name: `quotation/${scenario.count}: notes present`,
      ok: qtHtml.includes("Why selected") || qtHtml.includes("Standard Thinkway terms"),
    });

    // Selection subset: keep first half of items
    const keepIds = qt.items.slice(0, Math.max(1, Math.floor(qt.items.length / 2))).map((item) => item.id);
    const filtered = buildQuotationDocument(qt, { template: "showcase", itemIds: keepIds });
    allChecks.push({
      name: `quotation/${scenario.count}: item filter updates creator count`,
      ok: filtered.summary.creatorCount === keepIds.length,
      detail: `selected=${keepIds.length} got=${filtered.summary.creatorCount}`,
    });

    try {
      const pptx = await buildQuotationPptxBuffer(qtDoc);
      writeFileSync(
        join(
          OUT_DIR,
          `quotation-${scenario.count}${scenario.long ? "-long" : ""}${scenario.multi ? "-fx" : ""}.pptx`
        ),
        pptx
      );
      allChecks.push({ name: `quotation/${scenario.count}: pptx built`, ok: true });
    } catch (error) {
      allChecks.push({
        name: `quotation/${scenario.count}: pptx built`,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const failed = allChecks.filter((check) => !check.ok);
  const report = [
    "# Shortlist & Quotation Export Quality Validation",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Output: \`${OUT_DIR}\``,
    "",
    "## Infrastructure Assumptions",
    "",
    "- Local fixture generation only (no Railway / Puppeteer PDF in this script).",
    "- HTML is the shared Preview + PDF document model; PPTX is the parallel deck builder.",
    "- Puppeteer PDF parity should be confirmed in browser Preview + export download after deploy.",
    "",
    "## Results",
    "",
    `| Check | Result | Detail |`,
    `|---|---|---|`,
    ...allChecks.map(
      (check) => `| ${check.name} | ${check.ok ? "PASS" : "FAIL"} | ${check.detail ?? ""} |`
    ),
    "",
    `**Summary:** ${allChecks.length - failed.length}/${allChecks.length} passed`,
    "",
  ].join("\n");

  writeFileSync(join(OUT_DIR, "VALIDATION_REPORT.md"), report, "utf8");
  writeFileSync(
    join(process.cwd(), "docs/architecture/SHORTLIST_QUOTATION_EXPORT_QUALITY_REPORT.md"),
    report,
    "utf8"
  );

  console.log(report);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
