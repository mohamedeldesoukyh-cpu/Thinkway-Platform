import assert from "node:assert/strict";

import { computeAgencyFee } from "@/lib/commercial/commercial-engine";
import { QUOTATION_CLIENT_LABELS } from "@/features/quotations/constants";
import { buildQuotationDocument } from "@/features/quotations/export/quotation-document";
import { buildQuotationHtml, renderMoney } from "@/features/quotations/export/quotation-html";
import {
  selectShowcasePublicationShots,
  SHOWCASE_PUBLICATION_SHOT_LIMIT,
} from "@/features/quotations/export/quotation-export-publications";
import { resolveQuotationTemplate } from "@/features/quotations/export/quotation-template";
import type { QuotationDetail, QuotationItemRow } from "@/features/quotations/types";
import {
  computeLiveQuotationTotals,
  computeQuotationRowComputed,
  type QuotationRowDraft,
} from "@/features/quotations/quotation-row-math";
import { formatCreatorCount } from "@/features/discovery/components/creator-search/creator-search-utils";
import { quotationCreatorDuplicateKey } from "@/features/quotations/export/quotation-export-utils";
import { computeReachForecast } from "@/lib/performance/reach-forecast-engine";
import type { CreatorRecentPublication } from "@/lib/creators/types";
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

// Template resolver
{
  assert.equal(resolveQuotationTemplate(undefined), "detailed");
  assert.equal(resolveQuotationTemplate("detailed"), "detailed");
  assert.equal(resolveQuotationTemplate("lump-sum"), "lump-sum");
  assert.equal(resolveQuotationTemplate("showcase"), "showcase");
  assert.equal(resolveQuotationTemplate("showcase-lump-sum"), "showcase-lump-sum");
  assert.equal(resolveQuotationTemplate("unknown"), "detailed");
}

// Money renderer keeps amount and currency inline
{
  const html = renderMoney("1,333.33 EGP");
  assert.ok(html.includes('class="money-amount"'));
  assert.ok(html.includes('class="money-currency"'));
  assert.ok(html.includes("1,333.33"));
  assert.ok(html.includes("EGP"));
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
  assert.equal(doc.template, "detailed");
  assert.ok(doc.preparedForLine.includes("Acme Corp"));
  assert.ok(doc.termsSections.length >= 5);
  assert.ok(
    !doc.commercialKpis.some((k) => k.label === QUOTATION_CLIENT_LABELS.totalClientCost),
    "Client cost belongs in AF summary, not KPI strip"
  );
  assert.ok(
    doc.commercialKpis.some((k) => k.label === "Total agency fee"),
    "Client KPIs include AF total"
  );
  assert.ok(
    !doc.commercialKpis.some((k) => k.label === QUOTATION_CLIENT_LABELS.totalAgencyMargin),
    "Agency margin must not appear in client document KPIs"
  );
  assert.ok(
    !doc.commercialKpis.some((k) => k.label === "Total Revenue"),
    "Agency revenue label must not appear in document KPIs"
  );
  assert.ok(
    !doc.commercialKpis.some((k) => k.label === "Total Cost"),
    "Internal cost KPI must not appear in detailed client document"
  );
  assert.equal(doc.rows[0]?.afPct, "10.0%");
  assert.equal(doc.summary.grandTotal, "1,466.66 EGP");
}

{
  const lumpDoc = buildQuotationDocument(mockDetail(), { template: "lump-sum" });
  assert.equal(lumpDoc.template, "lump-sum");
  assert.ok(
    lumpDoc.commercialKpis.some((k) => k.label === QUOTATION_CLIENT_LABELS.lumpSumCost)
  );
  assert.ok(lumpDoc.commercialKpis.some((k) => k.label === QUOTATION_CLIENT_LABELS.totalCost));
}

{
  const html = buildQuotationHtml(buildQuotationDocument(mockDetail()));
  assert.ok(html.includes("Client Quotation"));
  assert.ok(html.includes("Terms &amp; Conditions"));
  assert.ok(html.includes("Prepared exclusively for Acme Corp"));
  assert.ok(html.includes("page-break"));
  assert.ok(html.includes("avoid-break"));
  assert.ok(html.includes("Client investment"));
  assert.ok(html.includes(QUOTATION_CLIENT_LABELS.grossFees));
  assert.ok(html.includes("Client Cost"));
  assert.ok(html.includes(">Tier<"));
  assert.ok(html.includes(">Type<"));
  assert.ok(html.includes("Service description"));
  assert.ok(html.includes(">Option<"));
  assert.ok(html.includes("creator-quote-block"));
  assert.ok(html.includes("creator-name"));
  assert.ok(html.includes("Campaign mix insight"));
  assert.ok(html.includes("Creators by Category"));
  assert.ok(html.includes("summary-overview-page"), "Summary overview uses dedicated page-2 class");
  assert.ok(html.includes("FULL INFLUENCER BREAKDOWN BY TIER"), "Tier breakdown title present");
  assert.ok(html.includes("tier-breakdown-table"), "Tier breakdown table rendered");
  assert.ok(html.includes(">Handle<"), "Tier breakdown includes Handle column");
  assert.ok(!html.includes(">EG Audience %<"), "Tier breakdown must not include EG Audience column");
  assert.ok(html.includes("tier-breakdown-grand-total"), "Tier breakdown grand total rendered");
  const coverEnd = html.indexOf("</section>");
  const categoryPos = html.indexOf("Creators by Category");
  const tierPos = html.indexOf("FULL INFLUENCER BREAKDOWN BY TIER");
  const commercialPos = html.indexOf("Commercial Summary");
  const termsPos = html.indexOf("Terms &amp; Conditions");
  assert.ok(
    categoryPos > coverEnd,
    "Category summary appears after cover page"
  );
  assert.ok(
    tierPos > categoryPos,
    "Tier breakdown appears after category summary table"
  );
  assert.ok(
    commercialPos < 0 || tierPos < commercialPos,
    "Tier breakdown appears before commercial section"
  );
  assert.ok(
    categoryPos < termsPos,
    "Category summary appears before terms"
  );
  assert.ok(!html.includes("<th>Creator</th>"), "Creator belongs in group header, not table columns");
  assert.ok(html.includes("platform-cell"), "Platform icons column appears in client option table");
  const commercialSectionStart = html.indexOf('id="section-commercial"');
  const commercialSectionHtml =
    commercialSectionStart >= 0 ? html.slice(commercialSectionStart) : html;
  assert.ok(
    !commercialSectionHtml.includes(">Followers<"),
    "Followers column must not appear in client option table"
  );
  assert.ok(!html.includes("Agency fee (AF)"), "Per-line AF must not appear in client line table");
  assert.ok(!html.includes(">AF %<"), "Per-line AF % must not appear in client line table");
  assert.ok(html.includes('class="money"'));
  assert.ok(!html.includes(">Revenue<"), "Revenue column header must not appear in HTML");
  assert.ok(!html.includes("Total Revenue"), "Total Revenue label must not appear in HTML");
  assert.ok(!html.includes("Budget (Revenue)"), "Cover hero must not use Budget (Revenue)");
  assert.ok(!html.includes(">Unit Cost<"), "Unit Cost column must not appear in client preview");
  assert.ok(!html.includes(">GP<"), "GP column must not appear in client preview");
  assert.ok(!html.includes(">GP%<"), "GP% column must not appear in client preview");
  assert.ok(!html.includes("Gross Profit"), "Gross Profit must not appear in client preview");
  const summaryStart = html.indexOf('class="summary-box');
  const summaryHtml = summaryStart >= 0 ? html.slice(summaryStart) : html;
  assert.ok(summaryHtml.includes("Client Cost"));
  assert.ok(summaryHtml.includes("Total agency fee"), "AF total remains in client summary");
  assert.ok(summaryHtml.includes("Total cost included AF"));
  assert.ok(
    !summaryHtml.includes(QUOTATION_CLIENT_LABELS.totalAgencyMargin),
    "Agency margin must not appear in detailed client export"
  );
}

{
  const sentDetail = mockDetail({
    status: "sent",
    version: "v2.0",
    serial_number: "QT-2026-0009-V2",
    issue_date: "2026-07-01",
    validity_date: "2026-07-24",
    is_expired: false,
    valid_days_remaining: 13,
  });
  const doc = buildQuotationDocument(sentDetail);
  assert.equal(doc.status, "sent");
  assert.equal(doc.statusLabel, "Sent");
  const html = buildQuotationHtml(doc);
  assert.ok(html.includes(">Sent</span>"), "Cover page shows Sent status from quotations.status");
  assert.ok(html.includes("v2.0 ·"), "Cover page includes document version label");
  assert.ok(!html.includes(">Draft</span>"), "Cover page must not show Draft when status is sent");
}

{
  const lumpHtml = buildQuotationHtml(
    buildQuotationDocument(mockDetail(), { template: "lump-sum" })
  );
  assert.ok(lumpHtml.includes("Lump Sum"));
  assert.ok(lumpHtml.includes("Included Creators (1)"));
  assert.ok(lumpHtml.includes("Creator A"));
  assert.ok(lumpHtml.includes("creator-quote-block"));
  assert.ok(lumpHtml.includes(QUOTATION_CLIENT_LABELS.lumpSumCost));
  assert.ok(lumpHtml.includes(QUOTATION_CLIENT_LABELS.totalCost));
  assert.ok(!lumpHtml.includes(">AF %<"), "Lump sum must not show per-line AF % table");
  assert.ok(
    !lumpHtml.includes(QUOTATION_CLIENT_LABELS.grossFees),
    "Lump sum creator roster must not show per-creator pricing"
  );
  assert.ok(!lumpHtml.includes('class="creator-list"'), "Lump sum must use roster blocks, not bullet list");
}

{
  const showcaseDoc = buildQuotationDocument(mockDetail(), { template: "showcase" });
  assert.equal(showcaseDoc.template, "showcase");
  assert.ok(
    !showcaseDoc.commercialKpis.some((k) => k.label === QUOTATION_CLIENT_LABELS.totalAgencyFee),
    "Showcase KPIs must not include pricing"
  );
  assert.equal(showcaseDoc.creatorGroups[0]?.engagementRate, "3.00%");
  assert.deepEqual(showcaseDoc.creatorGroups[0]?.publicationShots, []);
}

{
  const pubs: CreatorRecentPublication[] = [
    {
      url: "https://www.instagram.com/p/A/",
      thumbnail: "https://cdn.example.com/a.jpg",
      likes: 10,
      comments: 1,
      views: null,
      posted_at: null,
      caption: "Post A",
    },
    {
      url: "https://www.instagram.com/p/B/",
      thumbnail: null,
      likes: 5,
      comments: 0,
      views: null,
      posted_at: null,
      caption: "No thumb",
    },
    {
      url: "https://www.instagram.com/p/C/",
      thumbnail: "https://cdn.example.com/c.jpg",
      likes: 20,
      comments: 2,
      views: null,
      posted_at: null,
      caption: "Post C",
    },
  ];
  const shots = selectShowcasePublicationShots(pubs, 6);
  assert.equal(shots.length, 3, "Thumbs plus postUrl-only rows for embed fallback");
  assert.equal(shots[0]?.imageUrl, "https://cdn.example.com/a.jpg");
  assert.equal(shots[1]?.imageUrl, "https://cdn.example.com/c.jpg");
  assert.equal(shots[2]?.imageUrl, "");
  assert.equal(shots[2]?.postUrl, "https://www.instagram.com/p/B/");
  assert.equal(SHOWCASE_PUBLICATION_SHOT_LIMIT, 6);
}

{
  const item = mockItem({ influencer_id: "inf-1", unified_id: "inf:inf-1" });
  const creatorKey = quotationCreatorDuplicateKey(item);
  const showcaseDoc = buildQuotationDocument(mockDetail({ items: [item] }), {
    template: "showcase",
    publicationShotsByCreatorKey: new Map([
      [
        creatorKey,
        [
          {
            imageUrl: "data:image/jpeg;base64,abc",
            postUrl: "https://www.instagram.com/p/XYZ/",
            caption: "Look",
          },
        ],
      ],
    ]),
  });
  assert.equal(showcaseDoc.creatorGroups[0]?.publicationShots.length, 1);
  const showcaseHtml = buildQuotationHtml(showcaseDoc);
  assert.ok(showcaseHtml.includes("Recent publications"));
  assert.ok(showcaseHtml.includes("showcase-pubs-grid"));
  assert.ok(showcaseHtml.includes("showcase-pub-thumb"));
  assert.ok(showcaseHtml.includes("data:image/jpeg;base64,abc"));
  assert.ok(showcaseHtml.includes("https://www.instagram.com/p/XYZ/"));
}

{
  const item = mockItem({ influencer_id: "inf-1", unified_id: "inf:inf-1" });
  const creatorKey = quotationCreatorDuplicateKey(item);
  const showcaseHtml = buildQuotationHtml(
    buildQuotationDocument(mockDetail({ items: [item] }), {
      template: "showcase",
      publicationShotsByCreatorKey: new Map([
        [
          creatorKey,
          [
            {
              imageUrl: "https://scontent.cdninstagram.com/v/expired.jpg",
              postUrl: "https://www.instagram.com/p/ali123/",
              caption: null,
              imageProxyUrl: "/api/creators/publication-preview?src=expired&postUrl=ali",
            },
          ],
        ],
      ]),
    }),
    { siteOrigin: "https://app.thinkway.test" }
  );
  assert.ok(
    showcaseHtml.includes(
      "https://app.thinkway.test/api/creators/publication-preview?src=expired&amp;postUrl=ali"
    ),
    "Showcase uses absolute proxy URL when CDN embed fails"
  );
}

{
  const showcaseHtml = buildQuotationHtml(
    buildQuotationDocument(mockDetail(), { template: "showcase" })
  );
  assert.ok(showcaseHtml.includes("Showcase"));
  assert.ok(
    showcaseHtml.includes("Showcase Quotation — Test Quotation"),
    "Showcase cover/title uses Showcase Quotation prefix"
  );
  assert.ok(showcaseHtml.includes("showcase-avatar"));
  assert.ok(showcaseHtml.includes("showcase-creator-page"));
  assert.ok(showcaseHtml.includes("Creator Roster (1)"));
  assert.ok(showcaseHtml.includes("Proposed deliverables"));
  assert.ok(showcaseHtml.includes("Creator A"));
  assert.ok(showcaseHtml.includes("Recent publications"));
  assert.ok(
    showcaseHtml.includes("No publication screenshots available for this creator."),
    "Showcase shows empty-state when no publication screenshots"
  );
  assert.ok(!showcaseHtml.includes("Terms &amp; Conditions"), "Showcase deck omits terms");
  assert.ok(!showcaseHtml.includes("Client investment"), "Showcase cover omits investment");
  assert.ok(!showcaseHtml.includes(QUOTATION_CLIENT_LABELS.grossFees), "Showcase omits pricing");
  assert.ok(!showcaseHtml.includes("Commercial Summary"), "Showcase omits commercial summary");
}

{
  const showcaseLumpDoc = buildQuotationDocument(mockDetail(), {
    template: "showcase-lump-sum",
  });
  assert.equal(showcaseLumpDoc.template, "showcase-lump-sum");
  assert.ok(
    showcaseLumpDoc.commercialKpis.some((k) => k.label === QUOTATION_CLIENT_LABELS.lumpSumCost),
    "Showcase lump sum KPIs include lump sum cost"
  );
  assert.ok(
    showcaseLumpDoc.commercialKpis.some((k) => k.label === QUOTATION_CLIENT_LABELS.totalCost),
    "Showcase lump sum KPIs include total cost"
  );
  assert.deepEqual(showcaseLumpDoc.creatorGroups[0]?.publicationShots, []);
}

{
  const showcaseLumpHtml = buildQuotationHtml(
    buildQuotationDocument(mockDetail(), { template: "showcase-lump-sum" })
  );
  assert.ok(
    showcaseLumpHtml.includes("Showcase Quotation — Test Quotation"),
    "Showcase lump sum cover/title uses Showcase Quotation prefix (no Lump Sum in header)"
  );
  assert.ok(
    !showcaseLumpHtml.includes("Showcase Quotation Lump Sum"),
    "Showcase lump sum export must not say Lump Sum in title"
  );
  assert.ok(showcaseLumpHtml.includes(" · Showcase"));
  assert.ok(
    !showcaseLumpHtml.includes(" · Showcase Lump Sum"),
    "Showcase lump sum kicker is · Showcase only"
  );
  assert.ok(showcaseLumpHtml.includes("showcase-avatar"));
  assert.ok(showcaseLumpHtml.includes("showcase-creator-page"));
  assert.ok(showcaseLumpHtml.includes("showcase-creator-sheet"));
  assert.ok(showcaseLumpHtml.includes("page-break-inside: avoid"));
  assert.ok(showcaseLumpHtml.includes('class="quotation-report quotation-showcase"'));
  assert.ok(!showcaseLumpHtml.includes("min-height: 240mm"));
  assert.ok(showcaseLumpHtml.includes("Creator Roster (1)"));
  assert.ok(showcaseLumpHtml.includes("Proposed deliverables"));
  assert.ok(showcaseLumpHtml.includes("Commercial Summary"));
  assert.ok(showcaseLumpHtml.includes(QUOTATION_CLIENT_LABELS.lumpSumCost));
  assert.ok(showcaseLumpHtml.includes(QUOTATION_CLIENT_LABELS.totalCost));
  assert.ok(
    showcaseLumpHtml.includes(QUOTATION_CLIENT_LABELS.totalCost),
    "Cover shows total cost investment KPI"
  );
  assert.ok(
    !showcaseLumpHtml.includes(QUOTATION_CLIENT_LABELS.grossFees),
    "Showcase lump sum must not show per-creator pricing"
  );
  assert.ok(!showcaseLumpHtml.includes("Terms &amp; Conditions"), "Showcase lump sum omits terms");
  assert.ok(
    !showcaseLumpHtml.includes("Client investment"),
    "Showcase lump sum cover uses total cost, not client investment"
  );
}

{
  const showcaseNamed = buildQuotationHtml(
    buildQuotationDocument(
      mockDetail({ name: "Quotation — TUNA DOLPHIN – DELTA CAMPAIGN" }),
      { template: "showcase" }
    )
  );
  assert.ok(
    showcaseNamed.includes("Showcase Quotation — TUNA DOLPHIN – DELTA CAMPAIGN"),
    "Showcase rewrites Quotation — prefix to Showcase Quotation —"
  );
  assert.ok(
    showcaseNamed.includes('<h1 class="cover-title">Showcase Quotation — TUNA DOLPHIN – DELTA CAMPAIGN</h1>'),
    "Showcase cover h1 uses Showcase Quotation prefix"
  );

  const showcaseLumpNamed = buildQuotationHtml(
    buildQuotationDocument(
      mockDetail({ name: "Quotation — TUNA DOLPHIN – DELTA CAMPAIGN" }),
      { template: "showcase-lump-sum" }
    )
  );
  assert.ok(
    showcaseLumpNamed.includes(
      "Showcase Quotation — TUNA DOLPHIN – DELTA CAMPAIGN"
    ),
    "Showcase lump sum rewrites Quotation — prefix without Lump Sum"
  );
  assert.ok(
    showcaseLumpNamed.includes(
      '<h1 class="cover-title">Showcase Quotation — TUNA DOLPHIN – DELTA CAMPAIGN</h1>'
    ),
    "Showcase lump sum cover h1 matches Showcase Quotation — {name}"
  );
  assert.ok(
    !showcaseLumpNamed.includes("Lump Sum —"),
    "Showcase lump sum cover must not include Lump Sum in the title"
  );

  const detailedNamed = buildQuotationHtml(
    buildQuotationDocument(
      mockDetail({ name: "Quotation — TUNA DOLPHIN – DELTA CAMPAIGN" }),
      { template: "detailed" }
    )
  );
  assert.ok(
    detailedNamed.includes('<h1 class="cover-title">Quotation — TUNA DOLPHIN – DELTA CAMPAIGN</h1>'),
    "Detailed template keeps original Quotation — title"
  );
  assert.ok(
    !detailedNamed.includes("Showcase Quotation —"),
    "Detailed template must not use Showcase Quotation prefix"
  );
}

{
  const detailDoc = buildQuotationDocument(mockDetail(), {
    template: "detailed",
    publicationShotsByCreatorKey: new Map([
      [
        "any",
        [{ imageUrl: "https://cdn.example.com/x.jpg", postUrl: null, caption: null }],
      ],
    ]),
  });
  assert.deepEqual(
    detailDoc.creatorGroups[0]?.publicationShots,
    [],
    "Detailed template ignores publication shots map"
  );
}

{
  const detail = mockDetail({
    items: [
      mockItem({ id: "item-1", creator_name: null, handle: "fitswithnt", option_number: 1 }),
      mockItem({ id: "item-2", creator_name: null, handle: "fitswithnt", option_number: 2 }),
      mockItem({ id: "item-3", creator_name: null, handle: "reemrafat", option_number: 1 }),
    ],
  });
  const doc = buildQuotationDocument(detail);
  assert.equal(doc.summary.creatorCount, 2);
  assert.equal(doc.creatorGroups.length, 2);
  assert.equal(doc.creatorGroups[0]?.rows.length, 2);
  assert.equal(doc.commercialKpis[0]?.value, "2");
}

{
  const detail = mockDetail({
    items: [
      mockItem({ id: "item-1", influencer_id: "inf-1", engagement_rate: 4, option_number: 1 }),
      mockItem({
        id: "item-2",
        influencer_id: "inf-1",
        engagement_rate: 4,
        option_number: 2,
      }),
      mockItem({ id: "item-3", influencer_id: "inf-2", engagement_rate: 2, option_number: 1 }),
    ],
    estimated_engagement_rate: 3,
  });
  const doc = buildQuotationDocument(detail, { audience: "internal" });
  assert.equal(
    doc.commercialKpis.find((k) => k.label === "Est. Engagement")?.value,
    "3.00%"
  );
  assert.equal(doc.rows[0]?.engagementRate, "4.00%");
  assert.equal(doc.rows[2]?.engagementRate, "2.00%");
}

{
  const igCdn =
    "https://scontent.cdninstagram.com/v/t51.2885-19/example.jpg";
  const detail = mockDetail({
    items: [
      mockItem({
        creator_name: "withpassanteto",
        handle: "withpassanteto",
        profile_image_url: igCdn,
        profile_url: "https://www.instagram.com/withpassanteto/",
        creator_profile_source: {
          displayName: "withpassanteto",
          avatarUrl: igCdn,
          platform: "instagram",
          handle: "withpassanteto",
          profile_url: "https://www.instagram.com/withpassanteto/",
        },
      }),
    ],
  });
  const doc = buildQuotationDocument(detail);
  const proxyPath = doc.creatorGroups[0]?.avatarProxyUrl ?? "";
  assert.ok(proxyPath.includes("/api/creators/avatar"), "CDN avatars get proxy URL for export");
  const html = buildQuotationHtml(doc, { siteOrigin: "http://localhost:3000" });
  assert.ok(
    html.includes("/api/creators/avatar"),
    "HTML should proxy Instagram CDN avatars instead of hotlinking"
  );
}

{
  const item = mockItem({
    creator_categories: ["Beauty", "Lifestyle"],
  });
  const detail = mockDetail({
    items: [
      item,
      mockItem({
        id: "item-2",
        influencer_id: "inf-2",
        unified_id: "inf:inf-2",
        creator_name: "Creator B",
        handle: "@creatorb",
        creator_categories: ["Beauty, Sport"],
        sort_order: 1,
      }),
    ],
  });
  const detailedDoc = buildQuotationDocument(detail, { template: "detailed" });
  assert.deepEqual(detailedDoc.creatorGroups[0]?.categories, ["Beauty", "Lifestyle"]);
  assert.deepEqual(
    detailedDoc.summary.categoryBreakdown.map((row) => [row.label, row.count]),
    [
      ["Beauty", 2],
      ["Lifestyle", 1],
      ["Sports", 1],
    ]
  );
  assert.ok(
    detailedDoc.summary.insightBullets.some((bullet) => bullet.includes("Category mix"))
  );

  const detailedHtml = buildQuotationHtml(detailedDoc);
  assert.ok(detailedHtml.includes("creator-category-chip"));
  assert.ok(detailedHtml.includes("Beauty"));
  assert.ok(detailedHtml.includes("Lifestyle"));
  assert.ok(detailedHtml.includes("Sport"));
  assert.ok(detailedHtml.includes("2 creators"));

  const showcaseHtml = buildQuotationHtml(
    buildQuotationDocument(detail, { template: "showcase" })
  );
  assert.ok(showcaseHtml.includes("<label>Categories</label>"));
  assert.ok(showcaseHtml.includes("Beauty, Lifestyle"));
  assert.ok(
    showcaseHtml.includes('<th>Categories</th>'),
    "Showcase creator roster includes Categories column"
  );
  assert.ok(
    showcaseHtml.includes('class="categories-cell"'),
    "Showcase creator roster renders category chips per creator"
  );

  const showcaseLumpHtml = buildQuotationHtml(
    buildQuotationDocument(detail, { template: "showcase-lump-sum" })
  );
  assert.ok(
    showcaseLumpHtml.includes('<th>Categories</th>'),
    "Showcase lump sum creator roster includes Categories column"
  );
  assert.ok(showcaseLumpHtml.includes("Beauty"));
  assert.ok(showcaseLumpHtml.includes("Lifestyle"));
}

{
  const detail = mockDetail({
    items: [
      mockItem({
        id: "item-1",
        influencer_id: "inf-1",
        creator_categories: ["Beauty", "Lifestyle"],
        option_number: 1,
      }),
      mockItem({
        id: "item-2",
        influencer_id: "inf-1",
        creator_categories: ["Beauty", "Lifestyle"],
        option_number: 2,
        sort_order: 1,
      }),
      mockItem({
        id: "item-3",
        influencer_id: "inf-2",
        creator_categories: ["Recipe creator"],
        sort_order: 2,
      }),
    ],
  });
  const doc = buildQuotationDocument(detail, { template: "detailed" });
  assert.equal(doc.summary.creatorCount, 2, "Two unique creators");
  assert.deepEqual(
    doc.summary.categoryBreakdown.map((row) => [row.label, row.count]),
    [
      ["Beauty", 1],
      ["Food", 1],
      ["Lifestyle", 1],
    ],
    "Category summary counts unique creators under main categories"
  );
}

{
  const detail = mockDetail({
    items: [
      mockItem({
        creator_categories: ["Skincare", "Makeup"],
      }),
      mockItem({
        id: "item-2",
        influencer_id: "inf-2",
        creator_categories: ["Housewives", "Lifestyle"],
        sort_order: 1,
      }),
    ],
  });
  const doc = buildQuotationDocument(detail);
  assert.deepEqual(
    doc.summary.categoryBreakdown.map((row) => [row.label, row.count]),
    [
      ["Beauty", 1],
      ["Lifestyle", 1],
      ["Parenting", 1],
    ]
  );
  const tierRows = doc.summary.fullTierBreakdown.sections.flatMap(
    (section) => section.creators
  );
  assert.equal(
    tierRows.find((row) => row.category === "Beauty")?.category,
    "Beauty",
    "Skincare and Makeup roll up to Beauty in tier breakdown"
  );
  assert.equal(
    tierRows.find((row) => row.category.includes("Parenting"))?.category,
    "Lifestyle, Parenting",
    "Tier row shows comma-separated main categories matching category summary buckets"
  );
}

{
  const item = mockItem({ influencer_id: "inf-1", unified_id: "inf:inf-1" });
  const creatorKey = quotationCreatorDuplicateKey(item);
  const showcaseHtml = buildQuotationHtml(
    buildQuotationDocument(mockDetail({ items: [item] }), {
      template: "showcase",
      publicationShotsByCreatorKey: new Map([
        [
          creatorKey,
          [
            {
              imageUrl: "data:image/jpeg;base64,reel",
              postUrl: "https://www.instagram.com/reel/XYZ/",
              caption: "Reel",
              isVideo: true,
            },
            {
              imageUrl: "data:image/jpeg;base64,photo",
              postUrl: "https://www.instagram.com/p/XYZ/",
              caption: "Photo",
              isVideo: false,
            },
          ],
        ],
      ]),
    })
  );
  assert.ok(showcaseHtml.includes('class="showcase-pub-play"'), "Video shots render play overlay");
  const playCount = (showcaseHtml.match(/class="showcase-pub-play"/g) ?? []).length;
  assert.equal(playCount, 1, "Only video publications get a play overlay");
}

{
  const detail = mockDetail({
    items: [
      mockItem({
        id: "item-1",
        creator_name: "Noura",
        handle: "noura.eg",
        creator_categories: [],
        followers: 120_000,
        country_code: "EG",
      }),
      mockItem({
        id: "item-2",
        influencer_id: "inf-2",
        creator_name: "Layla",
        handle: "layla_kw",
        creator_categories: [],
        followers: 80_000,
        country_code: "KW",
        sort_order: 1,
      }),
    ],
  });
  const doc = buildQuotationDocument(detail, { template: "detailed" });
  assert.ok(
    !doc.summary.categoryBreakdown.some((row) => row.label === "Uncategorized"),
    "Handle/name-only creators should not appear as Uncategorized"
  );
  assert.deepEqual(
    doc.summary.categoryBreakdown.map((row) => row.label),
    ["Lifestyle"],
    "Thin-profile MENA creators should fall back to Lifestyle"
  );
}

{
  const detail = mockDetail({
    items: [
      mockItem({
        id: "item-1",
        influencer_id: "inf-1",
        creator_categories: [],
        option_number: 1,
      }),
      mockItem({
        id: "item-2",
        influencer_id: "inf-1",
        creator_categories: ["Recipe creator"],
        option_number: 2,
        sort_order: 1,
      }),
    ],
  });
  const doc = buildQuotationDocument(detail);
  assert.ok(
    doc.creatorGroups[0]?.categories.includes("Recipe creator"),
    "Creator group should merge categories across options"
  );
  assert.deepEqual(
    doc.summary.categoryBreakdown
      .map((row) => [row.label, row.count] as const)
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    [
      ["Food", 1],
      ["Lifestyle", 1],
    ],
    "Merged option categories should roll up in summary"
  );
  const tierRow = doc.summary.fullTierBreakdown.sections
    .flatMap((section) => section.creators)
    .find((row) => row.category.includes("Food"));
  assert.equal(
    tierRow?.category,
    "Food, Lifestyle",
    "Tier row merges categories across options like category summary"
  );
}

{
  const detail = mockDetail({
    items: [
      mockItem({
        id: "item-1",
        influencer_id: "inf-1",
        handle: "foodmom",
        creator_categories: ["Recipe creator", "Housewives"],
      }),
    ],
  });
  const doc = buildQuotationDocument(detail);
  assert.deepEqual(
    doc.summary.categoryBreakdown.map((row) => [row.label, row.count]),
    [
      ["Food", 1],
      ["Parenting", 1],
    ],
    "Food+Parenting creator counts in both category buckets"
  );
  const tierRow = doc.summary.fullTierBreakdown.sections
    .flatMap((section) => section.creators)[0];
  assert.equal(
    tierRow?.category,
    "Food, Parenting",
    "Food+Parenting creator shows same mains in tier row"
  );
}

{
  const detail = mockDetail({
    campaign_name: "Tuna Dolphin Delta",
    items: [
      mockItem({
        id: "item-mega",
        influencer_id: "inf-mega",
        handle: "dr.fitn3ss",
        platform: "instagram",
        followers: 5_500_000,
        engagement_rate: 0.05,
        creator_categories: ["Fitness"],
      }),
      mockItem({
        id: "item-macro",
        influencer_id: "inf-macro",
        handle: "menna_tawfek",
        platform: "instagram",
        followers: 1_200_000,
        engagement_rate: 3.51,
        creator_categories: ["Recipe creator"],
        sort_order: 1,
      }),
      mockItem({
        id: "item-mid",
        influencer_id: "inf-mid",
        handle: "hebaelsopkey",
        platform: "instagram",
        followers: 124_000,
        engagement_rate: 4.01,
        creator_categories: ["Recipe creator"],
        sort_order: 2,
      }),
      mockItem({
        id: "item-micro",
        influencer_id: "inf-micro",
        handle: "withpassanteto",
        platform: "instagram",
        followers: 35_000,
        engagement_rate: 8.43,
        creator_categories: ["Housewives"],
        sort_order: 3,
      }),
    ],
  });
  const doc = buildQuotationDocument(detail);
  assert.equal(doc.summary.fullTierBreakdown.sections.length, 4);
  assert.equal(doc.summary.fullTierBreakdown.sections[0]?.sectionLabel, "CELEBRITY");
  assert.equal(doc.summary.fullTierBreakdown.sections[1]?.sectionLabel, "MEGA");
  assert.equal(doc.summary.fullTierBreakdown.sections[2]?.sectionLabel, "MID");
  assert.equal(doc.summary.fullTierBreakdown.sections[3]?.sectionLabel, "MICRO");
  assert.equal(doc.summary.fullTierBreakdown.sections[0]?.creators[0]?.handle, "dr.fitn3ss");
  assert.equal(
    doc.summary.fullTierBreakdown.sections[0]?.creators[0]?.category,
    "Fitness",
    "Tier row category uses main category rollup"
  );
  assert.equal(
    doc.summary.fullTierBreakdown.sections[1]?.creators[0]?.category,
    "Food",
    "Recipe creator rolls up to Food in tier breakdown"
  );
  assert.equal(
    doc.summary.fullTierBreakdown.sections[3]?.creators[0]?.category,
    "Parenting",
    "Housewives rolls up to Parenting in tier breakdown"
  );
  assert.ok(doc.summary.fullTierBreakdown.title.includes("TUNA DOLPHIN DELTA"));

  const html = buildQuotationHtml(doc);
  assert.ok(html.includes("tier-breakdown-header"));
  assert.ok(html.includes("CELEBRITY"));
  assert.ok(html.includes("MEGA"));
  assert.ok(html.includes("MID"));
  assert.ok(html.includes("MICRO"));
  assert.ok(html.includes("dr.fitn3ss"));
  assert.ok(html.includes("Subtotal: 1 influencer"));
  assert.ok(html.includes("GRAND TOTAL | 4 Influencers"));
}

{
  const followers = 639_850;
  const platform = "instagram";
  const expectedReach = computeReachForecast({ followers, platform }).forecastReach;
  const detail = mockDetail({
    items: [
      mockItem({
        id: "item-1",
        influencer_id: "inf-hgabr",
        handle: "hgabr",
        platform: null,
        followers: null,
        engagement_rate: null,
        option_number: 1,
      }),
      mockItem({
        id: "item-2",
        influencer_id: "inf-hgabr",
        handle: "hgabr",
        platform,
        followers,
        engagement_rate: 2.15,
        option_number: 2,
        sort_order: 1,
      }),
      mockItem({
        id: "item-3",
        influencer_id: "inf-radwa",
        handle: "radwaadeeel",
        platform: null,
        followers: null,
        option_number: 1,
        sort_order: 2,
      }),
      mockItem({
        id: "item-4",
        influencer_id: "inf-radwa",
        handle: "radwaadeeel",
        creator_profile_source: {
          displayName: "radwaadeeel",
          platform: "instagram",
          handle: "radwaadeeel",
          profile_url: "https://www.instagram.com/radwaadeeel/",
        },
        platform: "instagram",
        followers: 210_000,
        engagement_rate: 4.2,
        option_number: 2,
        sort_order: 3,
      }),
    ],
  });
  const doc = buildQuotationDocument(detail);
  const tierRows = doc.summary.fullTierBreakdown.sections.flatMap(
    (section) => section.creators
  );

  const hgabrRow = tierRows.find((row) => row.handle === "hgabr");
  assert.equal(hgabrRow?.platform, "Instagram", "Platform merges from later option");
  assert.equal(
    hgabrRow?.estimatedReach,
    expectedReach != null ? formatCreatorCount(expectedReach) : "—",
    "Est. reach uses merged followers and platform"
  );

  const radwaRow = tierRows.find((row) => row.handle === "radwaadeeel");
  assert.equal(radwaRow?.platform, "Instagram", "Platform resolves from enriched option");
  assert.notEqual(radwaRow?.estimatedReach, "—", "Est. reach should not be empty when followers exist");
}

{
  const followers = 500_000;
  const detail = mockDetail({
    items: [
      mockItem({
        id: "item-hgabr",
        influencer_id: "inf-hgabr",
        handle: "hgabr",
        platform: null,
        followers,
        engagement_rate: 2.1,
        creator_profile_source: {
          displayName: "hgabr",
          avatarUrl: null,
          platform: null,
          linkedPlatforms: ["instagram", "tiktok"],
          handle: "hgabr",
          profile_url: "https://www.instagram.com/hgabr/",
        },
      }),
    ],
  });
  const doc = buildQuotationDocument(detail);
  const row = doc.summary.fullTierBreakdown.sections
    .flatMap((section) => section.creators)
    .find((entry) => entry.handle === "hgabr");
  assert.equal(row?.platform, "Instagram", "Multi-platform creators prefer Instagram in tier export");
  assert.notEqual(row?.estimatedReach, "—", "Est. reach resolves when followers exist without line platform");
}

{
  const followers = 180_000;
  const detail = mockDetail({
    items: [
      mockItem({
        id: "item-abeer",
        handle: "abeer_kittchen",
        platform: null,
        followers,
        profile_url: "https://www.instagram.com/abeer_kittchen/",
        country_code: "EG",
        creator_profile_source: {
          displayName: "abeer_kittchen",
          avatarUrl: null,
          platform: null,
          handle: "abeer_kittchen",
          profile_url: "https://www.instagram.com/abeer_kittchen/",
        },
      }),
    ],
  });
  const doc = buildQuotationDocument(detail);
  const row = doc.summary.fullTierBreakdown.sections
    .flatMap((section) => section.creators)
    .find((entry) => entry.handle === "abeer_kittchen");
  assert.equal(row?.platform, "Instagram", "Profile URL infers platform for handle-only lines");
  assert.notEqual(row?.estimatedReach, "—", "Est. reach uses inferred Instagram platform");
}

{
  const followers = 42_000;
  const detail = mockDetail({
    items: [
      mockItem({
        id: "item-passant",
        handle: "withpassanteto",
        platform: null,
        followers,
        country_code: "EG",
        creator_profile_source: {
          displayName: "withpassanteto",
          avatarUrl: null,
          platform: null,
          handle: "withpassanteto",
        },
      }),
    ],
  });
  const doc = buildQuotationDocument(detail);
  const row = doc.summary.fullTierBreakdown.sections
    .flatMap((section) => section.creators)
    .find((entry) => entry.handle === "withpassanteto");
  assert.equal(
    row?.platform,
    "Instagram",
    "MENA handle-only creators default to Instagram in tier export"
  );
  assert.notEqual(row?.estimatedReach, "—", "Est. reach defaults platform to Instagram when followers exist");
}

console.log("quotation-document.test.ts passed");
