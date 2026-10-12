import { reportedTotal, coverageLabel, metricCoverage } from './reported-metrics';
import { creatorHighlightPages, renderCreatorHighlights } from './creator-highlights';
import {
  formatCompactCount,
  formatPercent,
} from "@/lib/campaigns/performance-calculations";
import { formatDateRange } from "@/lib/performance/report/performance-report-document-data";
import { PERFORMANCE_REPORT_DESIGN_V2_STYLES } from "@/lib/performance/report/performance-report-design-v2-styles";
import type { PerformanceReportDocumentData } from "@/lib/performance/report/performance-report-types";
import {
  getReportPlatformIconTitle,
} from "@/lib/performance/report/report-platform-icons";
import { buildQrCodeImageUrl } from "@/lib/performance/report/qr-code";
import { partitionPublicationsByValueScope, resolvePublicationValueScope, addedValueCreatorPercent } from "@/lib/performance/publication-value-scope";
import {
  CARDS_PER_PAGE,
  chunk,
  esc,
  formatGeneratedDate,
  pageLabel,
  platformKey,
  renderPcard,
  renderPlatformDot,
  renderPlatformIconBox,
  renderSectionHeader,
  renderSheet,
  wordmark,
} from "@/lib/performance/report/performance-report-v2-parts";

function campaignFootLabel(data: PerformanceReportDocumentData): string {
  const name = data.campaign.name.replace(/^Campaign\s*[—–-]\s*/i, "").trim();
  return `${data.campaign.documentNumber} · ${name}`;
}

function campaignShortName(data: PerformanceReportDocumentData): string {
  return data.campaign.name.replace(/^Campaign\s*[—–-]\s*/i, "").trim();
}

function buildPlatformScopeRows(data: PerformanceReportDocumentData) {
  const map = new Map<
    string,
    { platform: string; label: string; agreed: number; added: number; engagements: number }
  >();

  for (const pub of data.bundle.publications) {
    const key = platformKey(pub.platform) || "unknown";
    const existing = map.get(key) ?? {
      platform: key,
      label: pub.platform_label || getReportPlatformIconTitle(key),
      agreed: 0,
      added: 0,
      engagements: 0,
    };
    if (resolvePublicationValueScope(pub) === "added_value") existing.added += 1;
    else existing.agreed += 1;
    existing.engagements += pub.total_engagements ?? 0;
    map.set(key, existing);
  }

  const order = data.bundle.charts.platform_split.map((p) => platformKey(p.platform));
  const rows = [...map.values()];
  rows.sort((a, b) => {
    const ai = order.indexOf(a.platform);
    const bi = order.indexOf(b.platform);
    if (ai === -1 && bi === -1) return b.agreed + b.added - (a.agreed + a.added);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  return rows;
}

function renderCover(data: PerformanceReportDocumentData): string {
  const { campaign, generatedAt, highlights, bundle, uniqueCreatorCount } = data;
  const variantLabel =
    data.variant === "influencers"
      ? "Influencer Performance Report"
      : "Campaign Performance Report";
  const title = esc(campaignShortName(data));
  const agreed = bundle.summary.agreed_publications;
  const added = bundle.summary.added_value_publications;
  const platforms = highlights.platforms.length
    ? highlights.platforms
    : [
        ...new Set(
          bundle.publications.map((p) => platformKey(p.platform)).filter(Boolean)
        ),
      ];

  const lede = `Creator programme across ${
    platforms.map(getReportPlatformIconTitle).join(", ") || "activated channels"
  } — ${agreed} agreed publication${agreed === 1 ? "" : "s"}${
    added > 0 ? ` plus ${added} added-value post${added === 1 ? "" : "s"}` : ""
  } from ${uniqueCreatorCount} creator${uniqueCreatorCount === 1 ? "" : "s"}${
    campaign.country ? ` in ${campaign.country}` : ""
  }.`;

  const qrUrl =
    campaign.qrCodeImageUrl?.trim() || buildQrCodeImageUrl(campaign.dashboardUrl, 160);

  return `<section class="sheet cover">
  <div class="cover__in">
    <div class="cover__top">
      ${wordmark("md", "light")}
      <div class="cover__badge">Confidential</div>
    </div>
    <div class="cover__mid">
      <div class="cover__kicker">${esc(variantLabel)}</div>
      <div class="cover__rule"></div>
      <h1 class="cover__title">${title}</h1>
      <p class="cover__lede">${esc(lede)}</p>
      <div class="cover__meta">
        <div class="mi"><div class="mk">Client</div><div class="mv">${esc(campaign.clientName)}</div></div>
        <div class="mi"><div class="mk">Brand</div><div class="mv">${esc(campaign.brandName ?? "—")}</div></div>
        <div class="mi"><div class="mk">Campaign ID</div><div class="mv">${esc(campaign.documentNumber)}</div></div>
        <div class="mi"><div class="mk">Market</div><div class="mv">${esc(campaign.country ?? "—")}</div></div>
        <div class="mi"><div class="mk">Reporting window</div><div class="mv">${esc(formatDateRange(campaign.startDate, campaign.endDate))}</div></div>
        <div class="mi"><div class="mk">Issued</div><div class="mv">${esc(formatGeneratedDate(generatedAt))}</div></div>
      </div>
    </div>
    <div class="cover__bot">
      <div>
        <div class="ml ml--faint">Channels activated</div>
        <div class="cover__plat" style="margin-top:10px">${platforms.map(renderPlatformIconBox).join("")}</div>
      </div>
      ${
        qrUrl
          ? `<div class="cover__qr"><div class="qb"><img src="${esc(qrUrl)}" alt="QR code to live dashboard"/></div><div class="ql">Live dashboard</div></div>`
          : ""
      }
    </div>
    <div class="cover__foot">
      <span>Confidential · Thinkway Platform</span>
      <span>Generated ${esc(formatGeneratedDate(generatedAt))}</span>
    </div>
  </div>
</section>`;
}

function renderPublicationPages(
  publications: Parameters<typeof renderPcard>[0][],
  opts: {
    sectionNum: string;
    sectionTitle: string;
    headRightPrefix: string;
    footLeft: string;
    pageOffset: number;
    totalPages: number;
    id?: string;
  }
): string[] {
  const pages = chunk(publications, CARDS_PER_PAGE);
  return pages.map((group, index) =>
    renderSheet({
      headLeft: `${opts.sectionNum} · ${opts.sectionTitle}`,
      headRight: `${opts.headRightPrefix} · ${index + 1} of ${pages.length}`,
      body: `<div class="pgrid">${
        group.map(renderPcard).join("") ||
        `<p class="note">No publications in this group.</p>`
      }</div>`,
      footLeft: opts.footLeft,
      pageLabel: pageLabel(opts.pageOffset + index, opts.totalPages),
      id: index === 0 ? opts.id : undefined,
    })
  );
}

function renderCombinedSheets(data: PerformanceReportDocumentData): string[] {
  const foot = campaignFootLabel(data);
  const shortName = campaignShortName(data);
  const { summary } = data.bundle;
  const { agreed, addedValue } = partitionPublicationsByValueScope(
    data.bundle.publications
  );
  const scopeRows = buildPlatformScopeRows(data);



  const pubPages = Math.max(1, Math.ceil(Math.max(agreed.length, 1) / CARDS_PER_PAGE));
  const addedPages =
    addedValue.length > 0
      ? Math.max(1, Math.ceil(addedValue.length / CARDS_PER_PAGE))
      : 0;
  const highlightPages = creatorHighlightPages(data);
  const totalPages = 2 + highlightPages.length + pubPages + addedPages;
  const sheets: string[] = [renderCover(data)];
  let page = 2;

  const addedCreators = data.addedValueCreatorCount;
  const creatorRoster = data.assignedCreatorCount || data.uniqueCreatorCount;
  const addedPct = addedValueCreatorPercent(addedCreators, creatorRoster);
  const addedCreatorNames = data.addedValueCreators.map((c) => c.name);
  const addedPosts = summary.added_value_publications;

  sheets.push(
    renderSheet({
      id: "section-executive-summary",
      headLeft: "01 · Executive Summary",
      headRight: shortName,
      body: `${renderSectionHeader("01", "Executive Summary", "Aggregate delivery across the full campaign — agreed assignment and added value combined.")}
<div class="hero">
  ${metricCoverage(data.bundle.publications, 'reach').available ? `<div class="h"><div class="hk">Reported reach</div><div class="hv">${esc(reportedTotal(data.bundle.publications, 'reach'))}</div><div class="hs">Sum of reported post reach; audiences may overlap</div></div>` : ""}
  ${metricCoverage(data.bundle.publications, 'impressions').available ? `<div class="h"><div class="hk">Reported impressions</div><div class="hv">${esc(reportedTotal(data.bundle.publications, 'impressions'))}</div><div class="hs">Reported impressions only; forecasts excluded</div></div>` : ""}
  ${metricCoverage(data.bundle.publications, 'views').available ? `<div class="h"><div class="hk">Collected views</div><div class="hv">${esc(reportedTotal(data.bundle.publications, 'views'))}</div><div class="hs">${esc(coverageLabel(data.bundle.publications, 'views'))}</div></div>` : ""}
</div>
<div class="stats">
  <div class="s"><div class="sk">Creators</div><div class="sv num">${data.uniqueCreatorCount}</div><div class="ss">Activated</div></div>
  <div class="s"><div class="sk">Agreed posts</div><div class="sv num">${summary.agreed_publications}</div><div class="ss">Contracted scope</div></div>
  <div class="s s--green"><div class="sk">AV creators</div><div class="sv num">${addedCreators}</div><div class="ss">No deliverables</div></div>
  <div class="s s--green"><div class="sk">AV posts</div><div class="sv num">${addedPosts}</div><div class="ss">Beyond scope</div></div>
  <div class="s s--accent"><div class="sk">Avg. ER</div><div class="sv num">${esc(formatPercent(summary.average_engagement_rate))}</div><div class="ss">All posts ÷ agreed</div></div>
</div>
${
  addedCreators > 0 && addedPct != null
    ? `<div class="callout" style="margin-top:6mm"><div><div class="ck">Added value by creator</div><div class="cv">${addedCreators} creator${addedCreators === 1 ? "" : "s"} with no contracted deliverables${
        addedCreatorNames.length
          ? ` — ${esc(addedCreatorNames.join(", "))}`
          : ""
      }</div></div><div class="cn">+${addedPct}%</div></div>`
    : ""
}
${
  addedPosts > 0
    ? `<div class="callout" style="margin-top:3mm"><div><div class="ck">Added value by posts</div><div class="cv">${addedPosts} publication${addedPosts === 1 ? "" : "s"} delivered beyond the contracted assignment mix</div></div></div>`
    : ""
}
<div class="chart__h" style="margin-top:7mm"><span class="chart__t">Scope delivered by platform</span><span class="chart__u">${esc(formatDateRange(data.campaign.startDate, data.campaign.endDate))}</span></div>
<table class="tbl">
  <thead><tr><th>Platform</th><th class="r">Agreed</th><th class="r">Added value</th><th class="r">Total posts</th><th class="r">Engagements</th></tr></thead>
  <tbody>${scopeRows
    .map(
      (r) => `<tr>
    <td><span class="pl">${renderPlatformDot(r.platform)}${esc(r.label)}</span></td>
    <td class="r num">${r.agreed}</td>
    <td class="r num" style="color:var(--green)">${r.added || "—"}</td>
    <td class="r num">${r.agreed + r.added}</td>
    <td class="r num">${esc(formatCompactCount(r.engagements))}</td>
  </tr>`
    )
    .join("")}</tbody>
  <tfoot><tr>
    <td>Total</td>
    <td class="r num">${summary.agreed_publications}</td>
    <td class="r num">${summary.added_value_publications}</td>
    <td class="r num">${summary.total_publications}</td>
    <td class="r num">${esc(formatCompactCount(summary.total_engagements))}</td>
  </tr></tfoot>
</table>
<div class="grow"></div>
`,
      footLeft: foot,
      pageLabel: pageLabel(page, totalPages),
    })
  );
  page += 1;

  for (const [index, creators] of highlightPages.entries()) {
    sheets.push(renderSheet({
      id: index === 0 ? "section-highlights" : undefined,
      headLeft: "02 · Campaign Highlights",
      headRight: shortName,
      body: renderSectionHeader("02", "Campaign Highlights", "Every creator’s contribution, with campaign leaders identified by metric.") + renderCreatorHighlights(data, creators),
      footLeft: foot,
      pageLabel: pageLabel(page, totalPages),
    }));
    page += 1;
  }

  const agreedSheets = renderPublicationPages(agreed, {
    sectionNum: "03",
    sectionTitle: "Campaign Publications",
    headRightPrefix: "Agreed assignment",
    footLeft: foot,
    pageOffset: page,
    totalPages,
  });
  sheets.push(...agreedSheets);
  page += agreedSheets.length;

  if (addedValue.length > 0) {
    const addedSheets = renderPublicationPages(addedValue, {
      sectionNum: "04",
      sectionTitle: "Added Value",
      headRightPrefix: "Beyond scope",
      footLeft: foot,
      pageOffset: page,
      totalPages,
      id: "section-added-value",
    });
    sheets.push(...addedSheets);
    page += addedSheets.length;
  }


  return sheets;
}

function renderInfluencerSheets(data: PerformanceReportDocumentData): string[] {
  const foot = campaignFootLabel(data);
  const { summary } = data.bundle;
  const sheets: string[] = [];

  const influencerPageEstimate = data.influencerSections.reduce((sum, section) => {
    return sum + Math.max(1, Math.ceil(section.publications.length / CARDS_PER_PAGE));
  }, 0);
  const totalPages = 2 + influencerPageEstimate;
  let page = 1;

  sheets.push(renderCover(data));
  page = 2;

  sheets.push(
    renderSheet({
      id: "section-executive-summary",
      headLeft: "01 · Executive Summary",
      body: `${renderSectionHeader("01", "Executive Summary", "Campaign roll-up for the influencer report pack.")}
<div class="hero">
  ${metricCoverage(data.bundle.publications, 'reach').available ? `<div class="h"><div class="hk">Reach</div><div class="hv">${esc(reportedTotal(data.bundle.publications, 'reach'))}</div><div class="hs">Reported post reach; not deduplicated</div></div>` : ""}
  ${metricCoverage(data.bundle.publications, 'views').available ? `<div class="h"><div class="hk">Collected views</div><div class="hv">${esc(reportedTotal(data.bundle.publications, 'views'))}</div><div class="hs">${esc(coverageLabel(data.bundle.publications, 'views'))}</div></div>` : ""}
  <div class="h"><div class="hk">Engagements</div><div class="hv">${esc(formatCompactCount(summary.total_engagements))}</div><div class="hs">Avg ER ${esc(formatPercent(summary.average_engagement_rate))}</div></div>
</div>
<div class="stats">
  <div class="s"><div class="sk">Creators</div><div class="sv num">${data.influencerSections.length}</div><div class="ss">In this report</div></div>
  <div class="s"><div class="sk">Publications</div><div class="sv num">${summary.total_publications}</div><div class="ss">All scopes</div></div>
  <div class="s s--green"><div class="sk">AV creators</div><div class="sv num">${data.addedValueCreatorCount}</div><div class="ss">No deliverables</div></div>
  <div class="s s--green"><div class="sk">AV posts</div><div class="sv num">${summary.added_value_publications}</div><div class="ss">Beyond scope</div></div>
  ${metricCoverage(data.bundle.publications, 'impressions').available ? `<div class="s"><div class="sk">Impressions</div><div class="sv num">${esc(reportedTotal(data.bundle.publications, 'impressions'))}</div><div class="ss">Served</div></div>` : ""}
  <div class="s s--accent"><div class="sk">Avg. ER</div><div class="sv num">${esc(formatPercent(summary.average_engagement_rate))}</div><div class="ss">All posts ÷ agreed</div></div>
</div>`,
      footLeft: foot,
      pageLabel: pageLabel(page, totalPages),
    })
  );
  page += 1;

  data.influencerSections.forEach((section, index) => {
    const num = String(index + 2).padStart(2, "0");
    const { agreed, addedValue } = partitionPublicationsByValueScope(section.publications);
    const all = [...agreed, ...addedValue];
    const pages = chunk(all, CARDS_PER_PAGE);

    pages.forEach((group, pageIndex) => {
      const body =
        pageIndex === 0
          ? `${renderSectionHeader(
              num,
              section.name,
              `${section.summary.publications} publications · ${esc(formatCompactCount(section.summary.engagements))} engagements · ER ${esc(formatPercent(section.summary.averageEr, 1))}`
            )}
<div class="stats" style="margin-bottom:5mm">
  ${metricCoverage(section.publications, 'views').available ? `<div class="s"><div class="sk">Views</div><div class="sv num">${esc(reportedTotal(section.publications, 'views'))}</div><div class="ss">Total</div></div>` : ""}
  ${metricCoverage(section.publications, 'reach').available ? `<div class="s"><div class="sk">Reach</div><div class="sv num">${esc(reportedTotal(section.publications, 'reach'))}</div><div class="ss">Total</div></div>` : ""}
  <div class="s"><div class="sk">Engagements</div><div class="sv num">${esc(formatCompactCount(section.summary.engagements))}</div><div class="ss">Total</div></div>
  <div class="s s--accent"><div class="sk">Avg. ER</div><div class="sv num">${esc(formatPercent(section.summary.averageEr, 1))}</div><div class="ss">All posts ÷ agreed</div></div>
  <div class="s s--green"><div class="sk">Added value</div><div class="sv num">${section.summary.addedValuePublications}</div><div class="ss">Posts</div></div>
</div>
<div class="pgrid">${group.map(renderPcard).join("")}</div>`
          : `<div class="pgrid">${group.map(renderPcard).join("")}</div>`;

      sheets.push(
        renderSheet({
          id: pageIndex === 0 ? `influencer-${section.influencerId}` : undefined,
          headLeft: `${num} · ${section.name}`,
          headRight: pages.length > 1 ? `${pageIndex + 1} of ${pages.length}` : undefined,
          body,
          footLeft: foot,
          pageLabel: pageLabel(page, totalPages),
        })
      );
      page += 1;
    });
  });


  return sheets;
}

/** Performance report HTML used by preview + PDF (Design System v2). */
export function renderPerformanceReportHtml(data: PerformanceReportDocumentData): string {
  const sheets =
    data.variant === "influencers" ? renderInfluencerSheets(data) : renderCombinedSheets(data);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(data.campaign.name)} — Performance Report — Thinkway</title>
<style>${PERFORMANCE_REPORT_DESIGN_V2_STYLES}</style>
</head>
<body>
${sheets.join("")}
</body>
</html>`;
}
