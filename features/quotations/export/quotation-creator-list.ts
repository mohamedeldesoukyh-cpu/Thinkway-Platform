import { renderCreatorListReport, CREATOR_LIST_PDF_OPTIONS } from "@/features/discovery/shortlists/export/creator-list-html";
import { rateReportStyles, RATE_A4_HEIGHT } from "@/features/rate-cards/report-styles";
import { clientListPerformanceStyles } from "@/features/rate-cards/client-list-styles";
import { rateReportPlatformIcon } from "@/features/rate-cards/report-icons";
import { escapeHtml as e, safeProfileUrl } from "@/features/rate-cards/report";
import type { QuotationDocument } from "./quotation-document";

function layout(doc: QuotationDocument) {
  const performanceOnly = doc.template === "client-list-by-name";
  const platforms = Math.max(1, ...doc.creatorGroups.map(g => g.platformMetrics.length));
  return { performanceOnly, height: performanceOnly ? Math.max(900, 690 + platforms * 110) : RATE_A4_HEIGHT };
}

export function quotationListPdfOptions(doc: QuotationDocument) {
  const { performanceOnly, height } = layout(doc);
  return { ...CREATOR_LIST_PDF_OPTIONS,
    width: performanceOnly ? "1600px" : "297mm", height: performanceOnly ? `${height}px` : "210mm",
    viewport: { ...CREATOR_LIST_PDF_OPTIONS.viewport, width: 1600, height: Math.ceil(height) } };
}

/** Client-safe projection: internal document fields never enter either report. */
export function buildQuotationCreatorListHtml(doc: QuotationDocument): string {
  const { performanceOnly, height } = layout(doc);
  const creators = doc.creatorGroups.map(g => ({
    name: g.creator, handle: g.handle, profileUrl: safeProfileUrl(g.profileUrl),
    portrait: g.avatarUrl, avatar: g.avatarUrl, categories: g.categories,
    tier: g.rows[0]?.tier, markets: [g.country], platforms: g.platformIcons,
  }));
  return renderCreatorListReport({
    name: doc.brandName || doc.clientName || doc.name, reference: doc.serial,
    issuedDate: doc.issueDateLabel, clientLogo: doc.clientLogo, creators,
  }, {
    title: performanceOnly ? "Client List by Name" : "Creator List",
    cardsPerPage: performanceOnly ? 6 : 4, uniqueCreators: creators.length,
    showClientLogoInHeader: true, coverLogoOnRight: true, hideCoverReference: true,
    platformIcon: rateReportPlatformIcon,
    cardSupplement: (_creator, index) => {
      const group = doc.creatorGroups[index];
      const prices = performanceOnly ? "" : `<h3 class="rate-list-heading">Quotation</h3>${group.rows.map(row =>
        `<div class="price"><strong>${e(row.collapseOptionLabel || row.option)}</strong><p>${e(row.serviceDescription || row.deliverables)}</p>${row.isCollapsePackageFollower
          ? `<p>Included in shared package</p>`
          : doc.hideCostAndFees
            ? `<b>${e(row.totalInvestment ?? row.clientCost)}</b><small>AF included</small>`
            : `<b>${e(row.clientCost)}</b><small>Agency fees (AF): ${e(row.af)} · ${e(row.afPct)}</small><small>Total: ${e(row.totalInvestment ?? row.clientCost)}</small>`}</div>`
      ).join("")}`;
      const metrics = group.platformMetrics.map(metric => {
        const url = safeProfileUrl(metric.profileUrl);
        const icon = rateReportPlatformIcon(metric.platform);
        const label = `${icon ? `<img class="rate-platform-icon" src="${icon}" alt="" />` : ""}${e(metric.platform)}`;
        return `<div class="rate-platform-summary">${url ? `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label}<small>Followers: <b>${e(metric.followers)}</b> · ER: <b>${e(metric.engagement)}</b> · Avg. views: <b>${e(metric.views)}</b></small></div>`;
      }).join("");
      return `<div class="rate-prices">${prices}<h3 class="rate-list-heading">Performance</h3>${metrics || "<p>Performance not available</p>"}</div>`;
    },
    closingContent: `<div class="end__hd"><span class="end__eye">${e(doc.name)}</span><h1>${creators.length} creators</h1><p>${performanceOnly ? "Creator profiles and performance" : "Client quotation"}</p></div>`,
    extraCss: performanceOnly ? clientListPerformanceStyles("en", height) : rateReportStyles(false, "en", 1),
  });
}
