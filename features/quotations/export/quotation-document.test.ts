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
import { quotationCreatorDuplicateKey } from "@/features/quotations/export/quotation-export-utils";
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
  assert.ok(!html.includes("<th>Creator</th>"), "Creator belongs in group header, not table columns");
  assert.ok(html.includes("platform-cell"), "Platform icons column appears in client option table");
  assert.ok(!html.includes(">Followers<"), "Followers column must not appear in client option table");
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

console.log("quotation-document.test.ts passed");
