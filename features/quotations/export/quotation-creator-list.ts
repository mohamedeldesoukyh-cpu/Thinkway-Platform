import { renderCreatorListReport, CREATOR_LIST_PDF_OPTIONS } from "@/features/discovery/shortlists/export/creator-list-html";
import { clientListPerformanceStyles } from "@/features/rate-cards/client-list-styles";
import { rateReportPlatformIcon } from "@/features/rate-cards/report-icons";
import { escapeHtml as e, safeProfileUrl } from "@/features/rate-cards/report";
import type { QuotationDocument } from "./quotation-document";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { compareClientListCreators } from "@/lib/creators/client-list-order";

function quotedPlatforms(group: QuotationDocument["creatorGroups"][number]) {
  return new Set(group.rows.flatMap(row => row.quotedPlatforms ?? []).map(canonicalPlatformKey));
}

function layout(doc: QuotationDocument) {
  const performanceOnly = doc.template === "client-list-by-name";
  const platforms = Math.max(1, ...doc.creatorGroups.map(g => g.platformMetrics.length));
  // Both lists use the same six-column profile cards; pricing only adds vertical space.
  const pricingHeight = performanceOnly ? 0 : Math.max(1, ...doc.creatorGroups.map(g => g.rows.length)) * 240 + 30;
  return { performanceOnly, height: Math.max(900, 690 + platforms * 110) + pricingHeight };
}

export function quotationListPdfOptions(doc: QuotationDocument) {
  const { height } = layout(doc);
  return { ...CREATOR_LIST_PDF_OPTIONS,
    width: "1600px", height: `${height}px`,
    viewport: { ...CREATOR_LIST_PDF_OPTIONS.viewport, width: 1600, height: Math.ceil(height) } };
}

/** Client-safe projection: internal document fields never enter either report. */
export function buildQuotationCreatorListHtml(doc: QuotationDocument): string {
  const { performanceOnly, height } = layout(doc);
  // Rank within each tier by strongest platform audience; exact ties retain source order.
  const groups = [...doc.creatorGroups].sort((a, b) =>
    compareClientListCreators(
      { tier: a.highestPlatformTier ?? a.rows[0]?.tier, followers: a.highestPlatformFollowers },
      { tier: b.highestPlatformTier ?? b.rows[0]?.tier, followers: b.highestPlatformFollowers }));
  const creators = groups.map(g => ({
    name: g.creator, handle: g.handle, profileUrl: safeProfileUrl(g.profileUrl),
    portrait: g.avatarUrl, avatar: g.avatarUrl, categories: g.categories,
    tier: g.highestPlatformTier ?? g.rows[0]?.tier, markets: [g.country], platforms: [...quotedPlatforms(g)],
  }));
  return renderCreatorListReport({
    name: doc.brandName || doc.clientName || doc.name, reference: doc.serial,
    issuedDate: doc.issueDateLabel, clientLogo: doc.clientLogo, creators,
  }, {
    title: performanceOnly ? "Client List by Name" : "Creator List",
    desktopLayout: true, cardsPerPage: 6, uniqueCreators: creators.length,
    showClientLogoInHeader: true, coverLogoOnRight: true, hideCoverReference: true,
    platformIcon: rateReportPlatformIcon,
    cardSupplement: (_creator, index) => {
      const group = groups[index];
      const prices = performanceOnly ? "" : `${group.rows.map(row =>
        `<div class="price">${group.optionCount > 1 ? `<strong>${e(row.collapseOptionLabel || row.option)}</strong>` : ""}<h3 class="rate-list-heading">Deliverables</h3><p>${e(row.serviceDescription || row.deliverables)}</p>${row.isCollapsePackageFollower
          ? `<p>Included in shared package</p>`
          : doc.hideCostAndFees
            ? `<div class="quote-money"><span>Total price inc. AF</span><b>${e(row.totalInvestment ?? row.clientCost)}</b></div>`
            : `<div class="quote-money"><span>Price before AF</span><b>${e(row.clientCost)}</b></div><div class="quote-money"><span>Agency fees (AF) · ${e(row.afPct)}</span><b>${e(row.af)}</b></div><div class="quote-money quote-money--total"><span>Total price inc. AF</span><b>${e(row.totalInvestment ?? row.clientCost)}</b></div>`}</div>`
      ).join("")}`;
      const included = quotedPlatforms(group);
      const metrics = group.platformMetrics.filter(metric => included.has(canonicalPlatformKey(metric.platform))).map(metric => {
        const url = safeProfileUrl(metric.profileUrl);
        const icon = rateReportPlatformIcon(metric.platform);
        const label = `${icon ? `<img class="rate-platform-icon" src="${icon}" alt="" />` : ""}${e(metric.platform)}`;
        return `<div class="rate-platform-summary">${url ? `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label}<small>Followers: <b>${e(metric.followers)}</b> · ER: <b>${e(metric.engagement)}</b> · Avg. views: <b>${e(metric.views)}</b></small></div>`;
      }).join("");
      return `<div class="rate-prices">${prices}<h3 class="rate-list-heading">Performance</h3>${metrics || "<p>Performance not available</p>"}</div>`;
    },
    closingContent: `<div class="end__hd"><span class="end__eye">${e(doc.name)}</span><h1>${creators.length} creators</h1><p>${performanceOnly ? "Creator profiles and performance" : "Client quotation"}</p></div>`,
    extraCss: clientListPerformanceStyles("en", height, true) + `
      .price{display:grid;gap:3px;border-top:1px solid #e5e3ee;padding-top:5px;margin-top:5px;overflow-wrap:anywhere;font-size:12px}
      .price p{white-space:normal;text-align:start;font-size:11px;line-height:1.5;margin:0}
      .price small{font-size:10px;line-height:1.5;color:#666477}
      .price .rate-list-heading{font-size:15px;margin:0 0 5px}
      .price p{font-family:inherit;font-size:12px}
      .quote-money{display:grid;gap:3px;padding-top:7px}
      .quote-money span{font-size:11px;color:#666477}
      .quote-money b{font-size:14px;color:#080642}
      .quote-money--total{border-top:1px solid #d4d0e5;margin-top:5px}
      .ph .report-client-logo{max-width:180px;width:150px;height:64px;filter:url(#report-logo-white-key) drop-shadow(0 3px 1px rgba(0,0,0,.25)) drop-shadow(0 8px 8px rgba(0,0,0,.3))}
      .cov__client>.cover-client-logo{flex-basis:420px;width:420px;max-width:420px;height:420px;filter:url(#report-logo-white-key) drop-shadow(0 4px 1px rgba(0,0,0,.25)) drop-shadow(0 18px 18px rgba(0,0,0,.3))}
    `,
  });
}
