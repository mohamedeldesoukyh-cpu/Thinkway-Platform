import {
  formatCompactCount,
  formatPercent,
} from "@/lib/campaigns/performance-calculations";
import { formatDateRange } from "@/lib/performance/report/performance-report-document-data";
import { PERFORMANCE_REPORT_DESIGN_V2_STYLES } from "@/lib/performance/report/performance-report-design-v2-styles";
import type { PerformanceReportDocumentData } from "@/lib/performance/report/performance-report-types";
import {
  getReportPlatformIconDataUri,
  getReportPlatformIconTitle,
} from "@/lib/performance/report/report-platform-icons";
import { buildQrCodeImageUrl } from "@/lib/performance/report/qr-code";
import {
  REACH_FORECAST_DISCLAIMER,
} from "@/lib/performance/reach-forecast-engine";
import {
  IMPRESSIONS_FORECAST_DISCLAIMER,
} from "@/lib/performance/impressions-forecast-engine";
import { partitionPublicationsByValueScope, resolvePublicationValueScope, addedValueCreatorPercent } from "@/lib/performance/publication-value-scope";
import {
  CARDS_PER_PAGE,
  chunk,
  esc,
  flightDays,
  formatGeneratedDate,
  pageLabel,
  platformColor,
  platformKey,
  renderBars,
  renderClosing,
  renderDividerPage,
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

function hlAccent(labelText: string): string {
  const lower = labelText.toLowerCase();
  if (lower.includes("tiktok")) return "hl__c--tt";
  if (lower.includes("facebook") || lower.includes(" fb")) return "hl__c--fb";
  if (lower.includes("youtube")) return "hl__c--yt";
  if (lower.includes("instagram") || lower.includes(" ig")) return "hl__c--ig";
  return "";
}

function renderCombinedSheets(data: PerformanceReportDocumentData): string[] {
  const foot = campaignFootLabel(data);
  const shortName = campaignShortName(data);
  const { summary, charts } = data.bundle;
  const { agreed, addedValue } = partitionPublicationsByValueScope(
    data.bundle.publications
  );
  const scopeRows = buildPlatformScopeRows(data);
  const days = flightDays(data.campaign.startDate, data.campaign.endDate);
  const platforms = data.highlights.platforms;

  const pubPages = Math.max(1, Math.ceil(Math.max(agreed.length, 1) / CARDS_PER_PAGE));
  const addedPages =
    addedValue.length > 0
      ? Math.max(1, Math.ceil(addedValue.length / CARDS_PER_PAGE))
      : 0;
  const totalPages =
    1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + pubPages + (addedValue.length > 0 ? 1 + addedPages : 0) + 1;

  const sheets: string[] = [];
  let page = 1;

  sheets.push(renderCover(data));
  page = 2;

  const tocEntries = [
    { num: "01", label: "Executive Summary", page: 3 },
    { num: "02", label: "Campaign Highlights", page: 4 },
    { num: "03", label: "Benchmark & Key Insights", page: 5 },
    { num: "04", label: "Platform Breakdown", page: 6 },
    { num: "05", label: "Performance Charts", page: 7 },
    { num: "06", label: "Campaign Publications", page: 8 },
  ];
  if (addedValue.length > 0) {
    tocEntries.push({ num: "07", label: "Added Value", page: 8 + pubPages + 1 });
  }
  tocEntries.push({ num: "—", label: "Thank You", page: totalPages });

  sheets.push(
    renderSheet({
      headLeft: "Contents",
      body: `<div class="toc__hd">
  <div class="ml ml--blue">Campaign performance report</div>
  <h2 class="toc__title" style="margin-top:8px">Contents</h2>
  <p class="toc__sub">Performance of ${esc(data.campaign.name)} across the agreed creator assignment${
    addedValue.length > 0
      ? " and the added-value publications delivered beyond scope"
      : ""
  }.</p>
</div>
<ol class="toc__list">${tocEntries
        .map(
          (e) => `<li class="toc__row">
  <span class="toc__n">${esc(e.num)}</span>
  <span class="toc__t">${esc(e.label)}</span>
  <span class="toc__d"></span>
  <span class="toc__p">${e.page}</span>
</li>`
        )
        .join("")}</ol>
<div class="grow"></div>
<div class="ml" style="margin-bottom:10px">Report at a glance</div>
<div class="strip">
  <div class="t"><div class="tk">Creators</div><div class="tv num">${data.uniqueCreatorCount}</div><div class="ts">Activated</div></div>
  <div class="t"><div class="tk">Publications</div><div class="tv num">${summary.total_publications}</div><div class="ts">${summary.agreed_publications} agreed${summary.added_value_publications ? ` · ${summary.added_value_publications} added value` : ""}</div></div>
  <div class="t"><div class="tk">Flight</div><div class="tv num">${days ?? "—"}</div><div class="ts">${days ? `days · ${esc(formatDateRange(data.campaign.startDate, data.campaign.endDate))}` : esc(formatDateRange(data.campaign.startDate, data.campaign.endDate))}</div></div>
  <div class="t"><div class="tk">Platforms</div><div class="tv num">${platforms.length || scopeRows.length}</div><div class="ts">${esc((platforms.length ? platforms : scopeRows.map((r) => r.platform)).map(getReportPlatformIconTitle).join(" · ") || "—")}</div></div>
</div>
<div class="toc__note"><strong>A note on measurement.</strong> Reach and impressions blend actual provider data with forecasted estimates where the platform did not expose a figure. The source is labelled on every publication card. Campaign Avg ER sums all publication ERs (including added value) and divides by agreed publications only.</div>`,
      footLeft: foot,
      pageLabel: pageLabel(page, totalPages),
    })
  );
  page += 1;

  const addedCreators = data.addedValueCreatorCount;
  const addedPct = addedValueCreatorPercent(addedCreators, data.uniqueCreatorCount);

  sheets.push(
    renderSheet({
      id: "section-executive-summary",
      headLeft: "01 · Executive Summary",
      headRight: shortName,
      body: `${renderSectionHeader("01", "Executive Summary", "Aggregate delivery across the full campaign — agreed assignment and added value combined.")}
<div class="hero">
  <div class="h"><div class="hk">Total reach</div><div class="hv">${esc(formatCompactCount(summary.total_reach))}</div><div class="hs">Unique accounts reached across activated platforms</div></div>
  <div class="h"><div class="hk">Impressions</div><div class="hv">${esc(formatCompactCount(summary.total_impressions))}</div><div class="hs">Total content served, including repeat views</div></div>
  <div class="h"><div class="hk">Views</div><div class="hv">${esc(formatCompactCount(summary.total_views))}</div><div class="hs">Video and reel plays across ${summary.total_publications} publications</div></div>
</div>
<div class="stats">
  <div class="s"><div class="sk">Creators</div><div class="sv num">${data.uniqueCreatorCount}</div><div class="ss">Activated</div></div>
  <div class="s"><div class="sk">Publications</div><div class="sv num">${summary.agreed_publications}</div><div class="ss">Agreed scope</div></div>
  <div class="s s--green"><div class="sk">Added value</div><div class="sv num">${addedCreators}</div><div class="ss">Creators beyond scope</div></div>
  <div class="s"><div class="sk">Engagements</div><div class="sv num">${esc(formatCompactCount(summary.total_engagements))}</div><div class="ss">Likes, comments, shares, saves</div></div>
  <div class="s s--accent"><div class="sk">Avg. ER</div><div class="sv num">${esc(formatPercent(summary.average_engagement_rate))}</div><div class="ss">All posts ÷ agreed</div></div>
</div>
${
  addedCreators > 0 && addedPct != null
    ? `<div class="callout" style="margin-top:6mm"><div><div class="ck">Delivery vs. scope</div><div class="cv">${addedCreators} creator${addedCreators === 1 ? "" : "s"} delivered beyond the contracted assignment mix</div></div><div class="cn">+${addedPct}%</div></div>`
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
<div class="notes">
  <p class="note"><strong>Reach methodology.</strong> ${esc(REACH_FORECAST_DISCLAIMER)} Actual reach: ${esc(formatCompactCount(summary.total_actual_reach))} · Forecasted: ${esc(formatCompactCount(summary.total_forecast_reach))}.</p>
  <p class="note"><strong>Impressions methodology.</strong> ${esc(IMPRESSIONS_FORECAST_DISCLAIMER)} Actual impressions: ${esc(formatCompactCount(summary.total_actual_impressions))} · Forecasted: ${esc(formatCompactCount(summary.total_forecast_impressions))}.</p>
</div>`,
      footLeft: foot,
      pageLabel: pageLabel(page, totalPages),
    })
  );
  page += 1;

  sheets.push(
    renderSheet({
      id: "section-highlights",
      headLeft: "02 · Campaign Highlights",
      headRight: shortName,
      body: `${renderSectionHeader("02", "Campaign Highlights", "The standout performers of the campaign, by total engagement, reach and efficiency.")}
<div class="hl">
  <div class="hl__c ${hlAccent(data.highlights.topCreatorName ?? "")}">
    <div class="hl__k"><span class="hl__t">Top creator by engagement</span></div>
    <div class="hl__n bidi">${esc(data.highlights.topCreatorName ?? "—")}</div>
    <div class="hl__v num">${esc(formatCompactCount(data.highlights.topCreatorEngagements))}</div>
    <div class="hl__s">Highest total engagements across all of their publications in this campaign.</div>
  </div>
  <div class="hl__c ${hlAccent(data.highlights.bestPostLabel ?? "")}">
    <div class="hl__k"><span class="hl__t">Best post by views</span></div>
    <div class="hl__n bidi">${esc(data.highlights.bestPostLabel ?? "—")}</div>
    <div class="hl__v num">${esc(formatCompactCount(data.highlights.bestPostViews))}</div>
    <div class="hl__s">Single highest-performing publication of the campaign by video views.</div>
  </div>
  <div class="hl__c ${hlAccent(data.highlights.highestErLabel ?? "")}">
    <div class="hl__k"><span class="hl__t">Highest engagement rate</span></div>
    <div class="hl__n bidi">${esc(data.highlights.highestErLabel ?? "—")}</div>
    <div class="hl__v num">${esc(formatPercent(data.highlights.highestEr, 1))}</div>
    <div class="hl__s">Strongest engagement rate against reach among campaign publications.</div>
  </div>
  <div class="hl__c hl__c--wide">
    <div>
      <div class="hl__k"><span class="hl__t">Total engagements</span></div>
      <div class="hl__n">Campaign-wide interactions</div>
      <div class="hl__s">Across ${summary.agreed_publications} agreed and ${summary.added_value_publications} added-value publication(s).</div>
    </div>
    <div class="hl__v num">${esc(formatCompactCount(data.highlights.totalEngagements))}</div>
  </div>
</div>`,
      footLeft: foot,
      pageLabel: pageLabel(page, totalPages),
    })
  );
  page += 1;

  sheets.push(
    renderSheet({
      id: "section-benchmark",
      headLeft: "03 · Benchmark & Key Insights",
      headRight: shortName,
      body: `${renderSectionHeader("03", "Benchmark & Key Insights", "Platform engagement rates and recommended actions for the next cycle.")}
<table class="tbl">
  <thead><tr><th>Platform</th><th class="r">Agreed posts</th><th class="r">Avg ER</th></tr></thead>
  <tbody>${data.platformBenchmarks
    .map(
      (b) =>
        `<tr><td><span class="pl">${renderPlatformDot(b.platform)}${esc(b.label)}</span></td><td class="r num">${b.publicationCount}</td><td class="r num">${esc(formatPercent(b.averageEr, 2))}</td></tr>`
    )
    .join("")}</tbody>
</table>
${
  data.bestCreatorErName
    ? `<div class="callout" style="margin-top:5mm"><div><div class="ck">Best creator ER</div><div class="cv">${esc(data.bestCreatorErName)}</div></div><div class="cn">${esc(formatPercent(data.bestCreatorEr, 2))}</div></div>`
    : ""
}
<div class="ins" style="margin-top:6mm">${data.recommendations
        .map(
          (r, i) =>
            `<div class="ins__i"><div class="ins__n">${i + 1}</div><div class="ins__x">${esc(r)}</div></div>`
        )
        .join("")}</div>`,
      footLeft: foot,
      pageLabel: pageLabel(page, totalPages),
    })
  );
  page += 1;

  const totalSplit = charts.platform_split.reduce((s, p) => s + p.count, 0) || 1;
  sheets.push(
    renderSheet({
      id: "section-platform-breakdown",
      headLeft: "04 · Platform Breakdown",
      headRight: shortName,
      body: `${renderSectionHeader("04", "Platform Breakdown", "How publications and engagements distribute across channels.")}
<div class="share">${charts.platform_split
        .map((p) => {
          const pct = Math.round((p.count / totalSplit) * 100);
          const uri = getReportPlatformIconDataUri(p.platform);
          return `<div class="share__r">
      <div class="share__i" style="background:${platformColor(p.platform)}">${
        uri
          ? `<img src="${uri}" alt="" style="width:13px;height:13px;filter:brightness(0) invert(1)" />`
          : ""
      }</div>
      <div class="share__n">${esc(p.label)}</div>
      <div class="share__t"><i class="share__f" style="width:${pct}%;background:${platformColor(p.platform)}"></i></div>
      <div class="share__v num">${p.count} <em>${pct}%</em></div>
    </div>`;
        })
        .join("")}</div>
<table class="tbl" style="margin-top:7mm">
  <thead><tr><th>Platform</th><th class="r">Posts</th><th class="r">Engagements</th></tr></thead>
  <tbody>${charts.platform_split
    .map(
      (p) =>
        `<tr><td><span class="pl">${renderPlatformDot(p.platform)}${esc(p.label)}</span></td><td class="r num">${p.count}</td><td class="r num">${esc(formatCompactCount(p.engagements))}</td></tr>`
    )
    .join("")}</tbody>
</table>`,
      footLeft: foot,
      pageLabel: pageLabel(page, totalPages),
    })
  );
  page += 1;

  const viewsItems = charts.views_by_publication.slice(0, 10).map((p) => ({
    label: p.label.length > 28 ? `${p.label.slice(0, 28)}…` : p.label,
    value: p.views,
  }));
  const creatorItems = charts.top_creators_by_engagement.slice(0, 8).map((c) => ({
    label: c.name.length > 28 ? `${c.name.slice(0, 28)}…` : c.name,
    value: c.engagements,
  }));
  sheets.push(
    renderSheet({
      id: "section-performance-charts",
      headLeft: "05 · Performance Charts",
      headRight: "Views & creators",
      body: `${renderSectionHeader("05", "Performance Charts", "Relative delivery across top publications and creators.")}
<div class="chart"><div class="chart__h"><span class="chart__t">Views by publication</span><span class="chart__u">Top ${viewsItems.length}</span></div>${renderBars(viewsItems)}</div>
<div class="chart"><div class="chart__h"><span class="chart__t">Top creators by engagement</span><span class="chart__u">Campaign</span></div>${renderBars(creatorItems)}</div>`,
      footLeft: foot,
      pageLabel: pageLabel(page, totalPages),
    })
  );
  page += 1;

  sheets.push(
    renderDividerPage({
      id: "section-publications",
      kicker: "Section 06",
      title: "Campaign Publications",
      count: `${agreed.length} agreed publication${agreed.length === 1 ? "" : "s"}`,
      text: `Every post delivered against the contracted assignment mix${
        data.campaign.startDate || data.campaign.endDate
          ? ` between ${formatDateRange(data.campaign.startDate, data.campaign.endDate)}`
          : ""
      }, with full platform metrics and the reach/impression source labelled per publication.`,
      footLeft: foot,
      pageLabel: pageLabel(page, totalPages),
    })
  );
  page += 1;

  const agreedSheets = renderPublicationPages(agreed, {
    sectionNum: "06",
    sectionTitle: "Campaign Publications",
    headRightPrefix: "Agreed assignment",
    footLeft: foot,
    pageOffset: page,
    totalPages,
  });
  sheets.push(...agreedSheets);
  page += agreedSheets.length;

  if (addedValue.length > 0) {
    sheets.push(
      renderDividerPage({
        id: "section-added-value-divider",
        kicker: "Section 07",
        title: "Added Value",
        count: `${addedValue.length} added-value publication${addedValue.length === 1 ? "" : "s"}`,
        text: "Extra publications delivered on platforms outside the contracted assignment mix — additional value delivered to the client.",
        footLeft: foot,
        pageLabel: pageLabel(page, totalPages),
      })
    );
    page += 1;

    const addedSheets = renderPublicationPages(addedValue, {
      sectionNum: "07",
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

  sheets.push(renderClosing(foot, pageLabel(page, totalPages)));
  return sheets;
}

function renderInfluencerSheets(data: PerformanceReportDocumentData): string[] {
  const foot = campaignFootLabel(data);
  const { summary } = data.bundle;
  const sheets: string[] = [];

  const influencerPageEstimate = data.influencerSections.reduce((sum, section) => {
    return sum + Math.max(1, Math.ceil(section.publications.length / CARDS_PER_PAGE));
  }, 0);
  const totalPages = 1 + 1 + 1 + influencerPageEstimate + 1;
  let page = 1;

  sheets.push(renderCover(data));
  page = 2;

  const tocRows = [
    { num: "01", label: "Executive Summary", page: 3 },
    ...data.influencerSections.map((s, i) => ({
      num: String(i + 2).padStart(2, "0"),
      label: s.name,
      page: 4 + i,
    })),
    { num: "—", label: "Thank You", page: totalPages },
  ];

  sheets.push(
    renderSheet({
      headLeft: "Contents",
      body: `<div class="toc__hd"><div class="ml ml--blue">Influencer performance report</div><h2 class="toc__title" style="margin-top:8px">Contents</h2></div>
<ol class="toc__list">${tocRows
        .map(
          (e) =>
            `<li class="toc__row"><span class="toc__n">${esc(e.num)}</span><span class="toc__t">${esc(e.label)}</span><span class="toc__d"></span><span class="toc__p">${e.page}</span></li>`
        )
        .join("")}</ol>`,
      footLeft: foot,
      pageLabel: pageLabel(page, totalPages),
    })
  );
  page += 1;

  sheets.push(
    renderSheet({
      id: "section-executive-summary",
      headLeft: "01 · Executive Summary",
      body: `${renderSectionHeader("01", "Executive Summary", "Campaign roll-up for the influencer report pack.")}
<div class="hero">
  <div class="h"><div class="hk">Reach</div><div class="hv">${esc(formatCompactCount(summary.total_reach))}</div><div class="hs">Across all creators in this pack</div></div>
  <div class="h"><div class="hk">Views</div><div class="hv">${esc(formatCompactCount(summary.total_views))}</div><div class="hs">Video and reel plays</div></div>
  <div class="h"><div class="hk">Engagements</div><div class="hv">${esc(formatCompactCount(summary.total_engagements))}</div><div class="hs">Avg ER ${esc(formatPercent(summary.average_engagement_rate))}</div></div>
</div>
<div class="stats">
  <div class="s"><div class="sk">Creators</div><div class="sv num">${data.influencerSections.length}</div><div class="ss">In this report</div></div>
  <div class="s"><div class="sk">Publications</div><div class="sv num">${summary.total_publications}</div><div class="ss">All scopes</div></div>
  <div class="s s--green"><div class="sk">Added value</div><div class="sv num">${data.addedValueCreatorCount}</div><div class="ss">Creators beyond scope</div></div>
  <div class="s"><div class="sk">Impressions</div><div class="sv num">${esc(formatCompactCount(summary.total_impressions))}</div><div class="ss">Served</div></div>
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
  <div class="s"><div class="sk">Views</div><div class="sv num">${esc(formatCompactCount(section.summary.views))}</div><div class="ss">Total</div></div>
  <div class="s"><div class="sk">Reach</div><div class="sv num">${esc(formatCompactCount(section.summary.reach))}</div><div class="ss">Total</div></div>
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

  sheets.push(renderClosing(foot, pageLabel(page, totalPages)));
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
