/**
 * Thinkway quotation HTML — landscape brand template for preview + export.
 * Port of `templates/quotation-template.html` (Handlebars → TypeScript).
 */
import type {
  QuotationDocCollapsePackageCreator,
  QuotationDocument,
} from "@/features/quotations/export/quotation-document";
import type { ThinkwayReportLogoSrcs } from "@/lib/reports/document/thinkway-report-logo";
import {
  renderQuotationTemplateAvatarHtml,
  resolveQuotationTemplatePublicationSrc,
} from "./quotation-template-avatars";
import { renderQuotationPlatformIconsHtml } from "./quotation-template-platform-icons";
import { buildCollapsePackageMixFeed } from "@/features/quotations/export/quotation-export-mix-feed";
import { isCreatorDeckTemplate, isLumpSumPricingTemplate, isShowcaseTemplate } from "@/features/quotations/export/quotation-template";
import { buildQuotationTemplatePayload } from "./quotation-template-payload";
import {
  QUOTATION_TEMPLATE_LOGO_SVG,
  QUOTATION_TEMPLATE_LOGO_SVG_DARK,
  QUOTATION_TEMPLATE_STYLES,
} from "./quotation-template-styles";
import type { QuotationTemplatePayload } from "./quotation-template-types";

export type BuildQuotationTemplateHtmlOptions = {
  siteOrigin?: string;
  logoSrcs?: ThinkwayReportLogoSrcs;
  /** When true, emit one physical page per section and landscape print styles for Puppeteer. */
  forPdf?: boolean;
};

function esc(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderTierBlock(tier: QuotationTemplatePayload["tiers"][number]): string {
  const rows = tier.creators
    .map(
      (creator) =>
        `<tr><td class="h">${esc(creator.handle)}</td><td>${esc(creator.platform)}</td><td class="r">${esc(creator.followers)}</td><td>${esc(creator.category)}</td><td class="r">${esc(creator.er)}</td></tr>`
    )
    .join("");
  return `<div class="tier tier-breakdown-block">
      <div class="tier-head tier-breakdown-header">
        <span class="tier-tag ${esc(tier.slug)}">${esc(tier.name)}</span>
        <span class="tier-meta"><b>${esc(tier.profileCount)}</b> · ${esc(tier.followers)} followers · Avg ER <b>${esc(tier.avgER)}</b></span>
      </div>
      <table>
        <thead class="tr tier-breakdown-table"><tr><th>Handle</th><th>Platform</th><th class="r">Followers</th><th>Category</th><th class="r">ER %</th></tr></thead>
        <tbody class="tb">${rows}</tbody>
      </table>
    </div>`;
}

function renderPublicationShotsGrid(
  shots: QuotationDocument["creatorGroups"][number]["publicationShots"],
  siteOrigin: string | undefined,
  emptyLabel: string,
  gridClass = "pubs showcase-pubs-grid"
): string {
  if (!shots.length) {
    return `<div class="${gridClass}"><div class="pub-empty">${esc(emptyLabel)}</div></div>`;
  }

  const cards = shots
    .map((shot) => {
      const src = resolveQuotationTemplatePublicationSrc(shot, siteOrigin);
      if (!src) return "";
      const play = shot.isVideo
        ? `<span class="pub-play showcase-pub-play" aria-hidden="true"><span class="pub-play-icon showcase-pub-play-icon"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span></span>`
        : "";
      const img = `<img class="showcase-pub-thumb" src="${esc(src)}" alt="" referrerpolicy="no-referrer" />${play}`;
      const linked =
        shot.postUrl && /^https?:\/\//i.test(shot.postUrl)
          ? `<a href="${esc(shot.postUrl)}" target="_blank" rel="noopener noreferrer">${img}</a>`
          : img;
      return `<div class="pub showcase-pub-card">${linked}</div>`;
    })
    .filter(Boolean)
    .join("");

  return `<div class="${gridClass}">${cards || `<div class="pub-empty">${esc(emptyLabel)}</div>`}</div>`;
}

function showcaseFeeColumnLabel(showFees: boolean): string {
  return showFees ? "Influencer price (EGP)" : "";
}

/** One landscape row of publication thumbs per creator slide in PDF. */
const SHOWCASE_PDF_PUBLICATION_SHOT_LIMIT = 4;

/** Uniform PDF slide scale — applied on the section so layout height matches the page. */
function showcasePdfSlideStyle(scale: number): string {
  if (scale >= 0.999) return "";
  return ` style="zoom:${scale.toFixed(2)}"`;
}

function showcaseCreatorSlideScale(deliverableCount: number): number {
  const base = 0.94;
  if (deliverableCount <= 4) return base;
  if (deliverableCount <= 6) return base * 0.92;
  if (deliverableCount <= 8) return base * 0.84;
  return base * 0.76;
}

function showcaseCollapSlideScale(creatorCount: number, showBundleIntro: boolean): number {
  let scale = 0.92;
  if (creatorCount > 2) scale -= 0.05;
  if (creatorCount > 4) scale -= 0.05;
  if (showBundleIntro) scale -= 0.04;
  return Math.max(0.78, scale);
}

function renderLogo(variant: "cover" | "footer"): string {
  if (variant === "cover") {
    return `<div class="logo rev">${QUOTATION_TEMPLATE_LOGO_SVG}<span class="wm">THINK<b>WAY</b></span></div>`;
  }
  return `<div class="logo">${QUOTATION_TEMPLATE_LOGO_SVG_DARK}<span class="wm">THINK<b>WAY</b></span></div>`;
}

function renderCoverPage(payload: QuotationTemplatePayload): string {
  const q = payload.quotation;
  const c = payload.cover;
  const camp = payload.campaign;
  return `<section class="page cover">
  <div class="pad">
    <div class="cbar">
      ${renderLogo("cover")}
      <div class="chip">${esc(q.version)} · ${esc(q.status)}</div>
    </div>
    <div class="kicker">${esc(c.kicker)}</div>
    <h1>${esc(q.title)}</h1>
    <div class="accentbar"></div>
    <p class="sub">${esc(c.subtitle)}</p>
    <div class="metagrid">
      ${
        payload.flags.pitchCreators
          ? ""
          : `<div class="m"><p class="l">Quotation No.</p><p class="v mono">${esc(q.number)}</p></div>`
      }
      <div class="m"><p class="l">Client</p><p class="v">${esc(q.client)}</p></div>
      <div class="m"><p class="l">Brand</p><p class="v">${esc(q.brand)}</p></div>
      <div class="m"><p class="l">Prepared By</p><p class="v">${esc(q.preparedBy)}</p></div>
      <div class="m"><p class="l">Issue Date</p><p class="v mono">${esc(q.issueDate)}</p></div>
      <div class="m"><p class="l">Valid Until</p><p class="v mono">${esc(q.validUntil)}</p></div>
      <div class="m"><p class="l">Version</p><p class="v mono">${esc(q.version)}</p></div>
      <div class="m"><p class="l">Status</p><p class="v">${esc(q.status)}</p></div>
    </div>
    <div class="statrow">
      <div class="stat"><p class="sl">Campaign Creators</p><p class="sv">${esc(camp.creatorCount)}</p><p class="su">${esc(camp.tierSummary)}</p></div>
      <div class="stat"><p class="sl">${esc(c.stat3.label)}</p><p class="sv">${esc(c.stat3.value)}</p><p class="su">${esc(c.stat3.valueShort)}</p></div>
    </div>
  </div>
  <div class="foot" style="border-top-color:rgba(205,216,245,.18); color:#7f8bb0;">
    <span>${esc(payload.footer.left)}</span><span>Issued ${esc(q.issueDate)}</span>
  </div>
</section>`;
}

function renderCategoryTierPage(payload: QuotationTemplatePayload): string {
  const categories = payload.categories
    .map(
      (cat) =>
        `<div class="cat"><p class="cn">${esc(cat.name)}</p><p class="cv">${esc(cat.count)}</p><p class="cs">${esc(cat.countLabel)} · ${esc(cat.share)}</p></div>`
    )
    .join("");

  const tierBlocks = payload.tiers.map((tier) => renderTierBlock(tier));

  const insightParts = [payload.insight.categoryMix, payload.insight.tierMix, payload.insight.scale]
    .filter(Boolean)
    .join(" ");

  const grandTotalBlock = `<div class="grand tier-breakdown-grand-total">
      <div class="gl">Grand total · ${esc(payload.totals.creatorCount)} influencers</div>
      <div class="gm">
        <span>Followers<b>${esc(payload.totals.followers)}</b></span>
        <span>Avg ER<b>${esc(payload.totals.avgER)}</b></span>
      </div>
    </div>`;

  const insightBlock = insightParts
    ? `<div class="insight"><p><b>Campaign mix insight.</b> ${esc(insightParts)}</p></div>`
    : "";

  const footLeft = payload.footer.left;
  const footRight = `${payload.quotation.number} · Creator mix`;

  return `<section class="page summary-overview-page">
  <div class="pad">
    <div class="sec-row"><span class="sec-badge">01</span><span class="lbl">Creators by category</span></div>
    <h2 class="sec-title">Creator mix</h2>
    <div class="cat-grid">${categories || `<div class="cat"><p class="cn">—</p><p class="cv">0</p><p class="cs">No categories</p></div>`}</div>
    <div class="kicker" style="color:var(--muted);">Full influencer breakdown by tier</div>
    <div style="height:12px;"></div>
    ${tierBlocks.join("")}
    ${grandTotalBlock}
    ${insightBlock}
  </div>
  <div class="foot"><span>${esc(footLeft)}</span><span class="mono">${esc(footRight)}</span></div>
</section>`;
}

function renderShowcaseCreatorPages(
  payload: QuotationTemplatePayload,
  doc: QuotationDocument,
  siteOrigin?: string,
  forPdf = false
): string {
  const pitch = payload.flags.pitchCreators;
  const avatarVariant = pitch ? "pitch" : "showcase";
  const pitchPageClass = pitch ? " pitch-creator-page" : "";

  return payload.showcaseCreators
    .map((creator, index) => {
      const group = doc.creatorGroups[index];
      const avatarHtml = group
        ? renderQuotationTemplateAvatarHtml(group, siteOrigin, avatarVariant)
        : pitch
          ? `<span class="pitch-avatar pitch-avatar--initials">${esc(creator.initials)}</span>`
          : `<span class="sc-avatar sc-avatar--initials">${esc(creator.initials)}</span>`;

      const profileLinkStart =
        creator.profileUrl && /^https?:\/\//i.test(creator.profileUrl)
          ? `<a class="sc-profile-link" href="${esc(creator.profileUrl)}" target="_blank" rel="noopener noreferrer">`
          : "";
      const profileLinkEnd = profileLinkStart ? "</a>" : "";

      const publicationShots = (group?.publicationShots ?? []).slice(
        0,
        forPdf ? SHOWCASE_PDF_PUBLICATION_SHOT_LIMIT : undefined
      );
      const pubsHtml = renderPublicationShotsGrid(
        publicationShots,
        siteOrigin,
        "No publication screenshots available for this creator."
      );

      const deliverableRows = creator.deliverables
        .map((row) => {
          const feeCell = payload.flags.showFees
            ? `<td class="r">${esc(row.grossFee ?? "—")}</td>`
            : "";
          const platformCell = row.platformIcons.length
            ? `<td class="platform-cell">${renderQuotationPlatformIconsHtml(row.platformIcons)}<span class="platform-cell-label">${esc(row.platform)}</span></td>`
            : `<td class="platform-cell">${esc(row.platform)}</td>`;
          return `<tr><td class="name">${esc(row.option)}</td><td>${esc(row.service)}</td>${platformCell}<td>${esc(row.type)}</td>${feeCell}</tr>`;
        })
        .join("");

      const feeHead = payload.flags.showFees
        ? `<th class="r">${esc(showcaseFeeColumnLabel(true))}</th>`
        : "";

      const denseTableClass =
        forPdf && creator.deliverables.length > 4 ? " showcase-deliverables-table--dense" : "";
      const slideScale = forPdf ? showcaseCreatorSlideScale(creator.deliverables.length) : 1;
      const pageClass = forPdf
        ? `page showcase-creator-page showcase-creator-slide showcase-slide avoid-break${pitchPageClass}`
        : `page showcase-creator-page${pitchPageClass}`;

      const creatorPlatformIcons = renderQuotationPlatformIconsHtml(creator.platformIcons);
      const pitchMetricRows =
        creator.platformMetrics.length > 0
          ? creator.platformMetrics
              .map(
                (row, index) => `<tr>
          <td class="r">${esc(row.followers)}</td>
          <td class="r">${esc(row.engagement)}</td>
          <td class="r">${esc(row.views)}</td>
          <td>${index === 0 ? `<span class="pill">${esc(creator.tier)}</span>` : ""}</td>
          <td class="categories-cell">${index === 0 ? esc(creator.categories) : ""}</td>
          <td class="platform-cell">${renderQuotationPlatformIconsHtml([row.platform]) || esc(row.platform)}</td>
        </tr>`
              )
              .join("")
          : `<tr>
          <td class="r">${esc(creator.followers)}</td>
          <td class="r">${esc(creator.engagement)}</td>
          <td class="r">${esc(creator.views)}</td>
          <td><span class="pill">${esc(creator.tier)}</span></td>
          <td class="categories-cell">${esc(creator.categories)}</td>
          <td class="platform-cell">${creatorPlatformIcons || esc(creator.platforms)}</td>
        </tr>`;
      const metricsTable = pitch
        ? `<div class="fees showcase-metrics-table">
      <table class="data-table">
        <thead><tr><th class="r">Followers</th><th class="r">Engagement</th><th class="r">Views</th><th>Tier</th><th>Category</th><th>Platforms</th></tr></thead>
        <tbody>${pitchMetricRows}</tbody>
      </table>
    </div>`
        : `<div class="sc-stats showcase-kpi-row">
      <div class="sc-stat showcase-kpi"><p class="l">Followers</p><p class="v">${esc(creator.followers)}</p></div>
      <div class="sc-stat showcase-kpi"><p class="l">Engagement</p><p class="v">${esc(creator.engagement)}</p></div>
      <div class="sc-stat showcase-kpi"><p class="l">Views</p><p class="v">${esc(creator.views)}</p></div>
      <div class="sc-stat showcase-kpi"><p class="l">Tier</p><p class="v">${esc(creator.tier)}</p></div>
      <div class="sc-stat showcase-kpi"><p class="l">Categories</p><p class="v" style="font-size:13px;">${esc(creator.categories)}</p></div>
    </div>`;

      return `<section class="${pageClass}"${forPdf ? showcasePdfSlideStyle(slideScale) : ""}>
  <div class="pad showcase-creator-sheet">
    <div class="sec-row"><span class="sec-badge">${esc(creator.sectionNo)}</span><span class="lbl">Creator ${creator.index} of ${esc(payload.totals.creatorCount)}</span></div>
    <div class="sc-top">
      ${profileLinkStart}${avatarHtml}${profileLinkEnd}
      <div class="sc-identity">
        ${profileLinkStart}<p class="sc-name showcase-name">${esc(creator.name)}</p>
        <p class="sc-handle showcase-handle">${esc(creator.handle)}</p>${profileLinkEnd}
        ${pitch ? metricsTable : ""}
      </div>
    </div>
    ${pitch ? "" : metricsTable}
    <p class="sc-sub showcase-pubs-title">Recent publications</p>
    ${pubsHtml}
    <p class="sc-sub showcase-deliverables-title">Proposed deliverables</p>
    <div class="fees showcase-deliverables-table${denseTableClass}">
      <table class="data-table">
        <thead><tr><th>Option</th><th>Service description</th><th>Platform</th><th>Type</th>${feeHead}</tr></thead>
        <tbody>${deliverableRows || `<tr><td colspan="${payload.flags.showFees ? 5 : 4}" class="pub-empty">No deliverables listed.</td></tr>`}</tbody>
      </table>
    </div>
  </div>
  <div class="foot"><span>${esc(payload.footer.left)}</span><span class="mono">${esc(payload.quotation.number)} · ${esc(creator.handle)}</span></div>
</section>`;
    })
    .join("");
}

function renderRosterPage(payload: QuotationTemplatePayload): string {
  const rows = payload.roster.rows
    .map((row) => {
      const platformCell = row.platformIcons.length
        ? `${renderQuotationPlatformIconsHtml(row.platformIcons)}<span class="platform-cell-label">${esc(row.platforms)}</span>`
        : esc(row.platforms);
      const avatar = row.avatarUrl
        ? `<img class="roster-avatar" src="${esc(row.avatarUrl)}" alt="" width="22" height="22" />`
        : `<span class="roster-avatar roster-avatar--fallback">${esc(row.initials)}</span>`;
      return `<tr><td class="name roster-creator">${avatar}<span>${esc(row.handle)}</span></td><td class="r">${esc(row.followers)}</td><td class="r">${esc(row.er)}</td><td class="r">${esc(row.views)}</td><td><span class="pill">${esc(row.tier)}</span></td><td class="categories-cell">${esc(row.categories)}</td><td class="platform-cell">${platformCell}</td></tr>`;
    })
    .join("");

  return `<section class="page roster-page">
  <div class="pad">
    <div class="sec-row"><span class="sec-badge">${esc(payload.roster.sectionNo)}</span><span class="lbl">Creator roster (${esc(payload.totals.creatorCount)})</span></div>
    <h2 class="sec-title">At a glance</h2>
    <div class="fees">
      <table class="data-table">
        <thead><tr><th>Creator</th><th class="r">Followers</th><th class="r">Eng %</th><th class="r">Avg views</th><th>Tier</th><th>Category</th><th>Platforms</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
  <div class="foot"><span>${esc(payload.footer.left)}</span><span class="mono">${esc(payload.quotation.number)} · Roster</span></div>
</section>`;
}

function renderCommercialPage(
  payload: QuotationTemplatePayload,
  doc: QuotationDocument,
  siteOrigin?: string
): string {
  const c = payload.commercial;
  const camp = payload.campaign;

  const avatarByCreatorKey = new Map(
    doc.creatorGroups.map((group) => [
      group.handle !== "—" ? group.handle.replace(/^@/, "") : group.creator,
      group,
    ])
  );

  const feeLineAvatarHtml = (line: (typeof payload.feeLines)[number]) => {
    const group = avatarByCreatorKey.get(line.avatarGroupKey);
    return group
      ? renderQuotationTemplateAvatarHtml(group, siteOrigin, "fee")
      : `<span class="fee-avatar fee-avatar--initials">${esc(line.avatarInitials ?? "??")}</span>`;
  };

  const renderFeeRow = (line: (typeof payload.feeLines)[number]) => {
    const avatarHtml = feeLineAvatarHtml(line);
    const feeCell = payload.flags.itemizedPricing
      ? `<td class="r">${esc(line.grossFee ?? "—")}</td>`
      : "";
    return `<tr>
        <td class="name"><div class="creator-name-cell">${avatarHtml}<span class="creator-name">${esc(line.creator)}</span></div></td>
        <td><span class="pill">${esc(line.tier)}</span></td>
        <td class="platform-cell">${esc(line.platform)}</td>
        <td>${esc(line.deliverable)}</td>
        ${feeCell}
      </tr>`;
  };

  const feeTableHead = payload.flags.itemizedPricing
    ? `<thead><tr><th style="width:22%;">Creator</th><th>Tier</th><th>Platform</th><th>Deliverable</th><th class="r">${esc("Gross fees (EGP)")}</th></tr></thead>`
    : `<thead><tr><th style="width:26%;">Creator</th><th>Tier</th><th>Platform</th><th>Deliverable</th></tr></thead>`;

  const commTop = `<div class="comm-top">
      <div class="kpi"><p class="kl">Creators</p><p class="kv">${esc(camp.creatorCount)}</p></div>
      <div class="kpi"><p class="kl">Est. engagement</p><p class="kv">${esc(camp.estEngagement)}</p></div>
      <div class="kpi invest"><p class="kl">${esc(c.headlineLabel)}</p><p class="kv">${esc(c.headlineValue)}</p></div>
    </div>`;

  const totalsBlock = `<div class="totals summary-box">
      <div class="tot"><p class="tl">${esc(c.subtotalLabel)}</p><p class="tv">${esc(c.subtotalValue)}</p></div>
      <div class="tot"><p class="tl">Total agency fee</p><p class="tv">${esc(c.agencyFee)}</p></div>
      <div class="tot final"><p class="tl">Total cost incl. AF</p><p class="tv">${esc(c.totalInclAF)}</p></div>
    </div>`;

  const lumpSumNote = !payload.flags.itemizedPricing
    ? `<div class="insight" style="border-left-color:var(--blue400);">
      <p><b>Lump-sum engagement.</b> ${esc(c.lumpSumNote)}</p>
    </div>`
    : "";

  const commercialHeader = `<div class="sec-row"><span class="sec-badge">${esc(c.sectionNo)}</span><span class="lbl">Commercial summary</span></div>
    <h2 class="sec-title">Investment &amp; deliverables</h2>`;

  const footLeft = payload.footer.left;
  const footRight = `${payload.quotation.number} · Commercial`;

  const feeRows = payload.feeLines.map((line) => renderFeeRow(line)).join("");

  const itemizedTable = payload.flags.itemizedPricing
    ? `<div class="fees">
      <table class="data-table commercial-fee-table">
        ${feeTableHead}
        <tbody>${feeRows}</tbody>
      </table>
    </div>`
    : `${lumpSumNote}
    <div class="fees" style="margin-top:16px;">
      <table class="data-table commercial-fee-table">
        ${feeTableHead}
        <tbody>${feeRows}</tbody>
      </table>
    </div>`;

  return `<section class="page commercial-page" id="section-commercial">
  <div class="pad">
    ${commercialHeader}
    ${commTop}
    ${itemizedTable}
    ${totalsBlock}
  </div>
  <div class="foot"><span>${esc(footLeft)}</span><span class="mono">${esc(footRight)}</span></div>
</section>`;
}

function renderTermsPage(payload: QuotationTemplatePayload): string {
  const items = payload.terms.items
    .map((term) => `<div class="term"><h4>${esc(term.heading)}</h4><p>${esc(term.body)}</p></div>`)
    .join("");
  return `<section class="page" id="section-terms">
  <div class="pad">
    <div class="sec-row"><span class="sec-badge">${esc(payload.terms.sectionNo)}</span><span class="lbl">Terms &amp; conditions</span></div>
    <h2 class="sec-title">The agreement</h2>
    <div class="terms-grid">${items}</div>
  </div>
  <div class="foot"><span>${esc(payload.footer.left)}</span><span class="mono">${esc(payload.quotation.number)} · Terms</span></div>
</section>`;
}

function renderAcceptancePage(payload: QuotationTemplatePayload): string {
  const q = payload.quotation;
  return `<section class="page avoid-break" id="section-acceptance">
  <div class="pad">
    <div class="sec-row"><span class="sec-badge">${esc(payload.acceptance.sectionNo)}</span><span class="lbl">Acceptance</span></div>
    <h2 class="sec-title">Sign &amp; approve</h2>
    <p style="font-size:14px; color:var(--muted); max-width:72ch; margin:0 0 8px;">By signing below, both parties agree to the scope, pricing, and terms set out in this quotation.</p>
    <div class="accept-grid">
      <div class="sigbox">
        <h4>Prepared by — Thinkway</h4>
        <div class="sigline">
          <div class="row"><span class="l">Name · ${esc(payload.acceptance.preparedByName)}</span><div class="line"></div></div>
          <div class="row"><span class="l">Signature</span><div class="line"></div></div>
          <div class="row"><span class="l">Date · ${esc(q.issueDate)}</span><div class="line"></div></div>
        </div>
      </div>
      <div class="sigbox">
        <h4>Approved by — Client</h4>
        <div class="sigline">
          <div class="row"><span class="l">Name</span><div class="line"></div></div>
          <div class="row"><span class="l">Signature</span><div class="line"></div></div>
          <div class="row"><span class="l">Date</span><div class="line"></div></div>
        </div>
      </div>
    </div>
    <div class="revnote">Revision history — <span class="mono">${esc(payload.acceptance.revision)}</span></div>
    <div class="company">
      ${renderLogo("footer")}
      <div class="addr">${esc(payload.company.legalLine)}<br>${esc(payload.company.address)}</div>
    </div>
  </div>
  <div class="foot"><span>${esc(payload.footer.left)}</span><span class="mono">${esc(q.number)} · Acceptance</span></div>
</section>`;
}

function renderCollapseCreatorCard(
  creator: QuotationDocCollapsePackageCreator,
  siteOrigin?: string
): string {
  const avatarHtml = renderQuotationTemplateAvatarHtml(creator, siteOrigin, "collap");
  const platformIconsHtml = renderQuotationPlatformIconsHtml(
    creator.platformIcons,
    "collap-platform-icons"
  );

  return `<div class="collap-creator-card avoid-break">
          <div class="collap-creator-head">
            ${avatarHtml}
            <div class="collap-creator-identity">
              <p class="collap-creator-name">${esc(creator.creator)}</p>
              <p class="collap-creator-handle">${esc(creator.handle)}</p>
              ${platformIconsHtml ? `<div class="collap-creator-platforms">${platformIconsHtml}</div>` : ""}
            </div>
          </div>
          <div class="collap-creator-meta">
            <span class="collap-tier-pill">${esc(creator.tier)}</span>
            <span>${esc(creator.followers)} followers</span>
            <span>${esc(creator.engagementRate)} ER</span>
          </div>
        </div>`;
}

function renderCollapsePackageCard(
  bundle: QuotationDocument["collapseContentGroups"][number],
  pkg: QuotationDocument["collapseContentGroups"][number]["packages"][number],
  doc: QuotationDocument,
  siteOrigin?: string
): string {
  const creatorBlocks = pkg.creators
    .map((creator) => renderCollapseCreatorCard(creator, siteOrigin))
    .join("");

  const packagePlatformIcons = renderQuotationPlatformIconsHtml(
    pkg.platformIcons,
    "collap-package-platform-icons"
  );

  const mixFeedSection =
    isCreatorDeckTemplate(doc.template)
      ? (() => {
          const mixFeedShots = buildCollapsePackageMixFeed(doc, pkg.creators);
          if (!mixFeedShots.length) return "";
          return `<div class="collap-mix-feed-section">
          <p class="collap-mix-feed-title">Mix feed</p>
          ${renderPublicationShotsGrid(
            mixFeedShots,
            siteOrigin,
            "No publication screenshots available for this package.",
            "pubs showcase-pubs-grid collap-mix-feed-grid"
          )}
        </div>`;
        })()
      : "";

  return `<article class="collap-package-card avoid-break">
        <div class="collap-package-head">
          <div>
            <p class="collap-package-kicker">${esc(bundle.previewLabel)}</p>
            <h3 class="collap-package-title">${esc(pkg.optionLabel)}</h3>
          </div>
          <div class="collap-package-cost">
            <span class="collap-package-cost-label">${isCreatorDeckTemplate(doc.template) && !isLumpSumPricingTemplate(doc.template) ? "Influencer price" : "Client cost"}</span>
            <span class="collap-package-cost-value">${esc(pkg.clientCost)}</span>
          </div>
        </div>
        <div class="collap-package-meta">
          <div class="collap-package-field">
            <span class="collap-field-label">Service</span>
            <span class="collap-field-value">${esc(pkg.serviceDescription)}</span>
          </div>
          <div class="collap-package-field">
            <span class="collap-field-label">Type</span>
            <span class="collap-field-value">${esc(pkg.type)}</span>
          </div>
          <div class="collap-package-field">
            <span class="collap-field-label">Platforms</span>
            <span class="collap-field-value">${packagePlatformIcons || esc(pkg.platforms)}</span>
          </div>
          <div class="collap-package-field collap-package-field--wide">
            <span class="collap-field-label">Deliverables</span>
            <span class="collap-field-value">${esc(pkg.deliverables)}</span>
          </div>
        </div>
        <div class="collap-creator-section">
          <p class="collap-creator-section-title">Creators in this package</p>
          <div class="collap-creator-grid">${creatorBlocks}</div>
          ${mixFeedSection}
        </div>
      </article>`;
}

function renderCollapseContentPages(
  doc: QuotationDocument,
  siteOrigin?: string,
  forPdf = false
): string {
  if (!doc.collapseContentGroups.length) return "";

  if (forPdf) {
    return doc.collapseContentGroups
      .flatMap((bundle) => {
        const optionSummary =
          bundle.optionCount > 1
            ? `${bundle.optionCount} package options`
            : "Single package option";

        return bundle.packages.map((pkg, packageIndex) => {
          const showBundleIntro = packageIndex === 0;
          const slideScale = showcaseCollapSlideScale(pkg.creators.length, showBundleIntro);
          return `<section class="page collapse-content-page collapse-content-slide showcase-slide avoid-break"${showcasePdfSlideStyle(slideScale)}>
  <div class="pad">
    <div class="sec-row"><span class="sec-badge">CC</span><span class="lbl">${esc(bundle.previewLabel)}</span></div>
    <h2 class="sec-title">${esc(bundle.label)}</h2>
    ${
      showBundleIntro
        ? `<p class="collap-bundle-intro">${esc(bundle.previewLabel)} — ${esc(optionSummary)} with shared creator bundles and independent pricing per option.</p>`
        : ""
    }
    ${renderCollapsePackageCard(bundle, pkg, doc, siteOrigin)}
  </div>
  <div class="foot"><span>Confidential · Thinkway Platform</span><span class="mono">${esc(bundle.label)} · ${esc(doc.serial)}</span></div>
</section>`;
        });
      })
      .join("");
  }

  return doc.collapseContentGroups
    .map((bundle) => {
      const optionSummary =
        bundle.optionCount > 1
          ? `${bundle.optionCount} package options`
          : "Single package option";

      return `<section class="page collapse-content-page">
  <div class="pad">
    <div class="sec-row"><span class="sec-badge">CC</span><span class="lbl">${esc(bundle.previewLabel)}</span></div>
    <h2 class="sec-title">${esc(bundle.label)}</h2>
    <p class="collap-bundle-intro">${esc(bundle.previewLabel)} — ${esc(optionSummary)} with shared creator bundles and independent pricing per option.</p>
    <div class="collap-package-stack">${bundle.packages
      .map((pkg) => renderCollapsePackageCard(bundle, pkg, doc, siteOrigin))
      .join("")}</div>
  </div>
  <div class="foot"><span>Confidential · Thinkway Platform</span><span class="mono">${esc(bundle.label)} · ${esc(doc.serial)}</span></div>
</section>`;
    })
    .join("");
}

export function buildQuotationTemplateHtml(
  doc: QuotationDocument,
  options?: BuildQuotationTemplateHtmlOptions
): string {
  const payload = buildQuotationTemplatePayload(doc);
  const siteOrigin = options?.siteOrigin;
  const forPdf = options?.forPdf ?? false;
  const baseTag = siteOrigin
    ? `<base href="${esc(siteOrigin.replace(/\/$/, ""))}/" />`
    : "";

  const bodyClass = [
    forPdf ? "quotation-export-print" : "quotation-export-preview",
    payload.flags.showcaseCreators ? "quotation-showcase" : "",
    payload.flags.pitchCreators ? "quotation-pitch" : "",
    "quotation-report",
  ]
    .filter(Boolean)
    .join(" ");

  const sections = [
    renderCoverPage(payload),
    renderCategoryTierPage(payload),
    renderCollapseContentPages(doc, siteOrigin, forPdf),
    ...(payload.flags.showcaseCreators
      ? [renderShowcaseCreatorPages(payload, doc, siteOrigin, forPdf), renderRosterPage(payload)]
      : []),
    ...(payload.flags.showCommercialSummary
      ? [renderCommercialPage(payload, doc, siteOrigin)]
      : []),
    ...(payload.flags.includeTerms ? [renderTermsPage(payload)] : []),
    ...(payload.flags.includeAcceptance ? [renderAcceptancePage(payload)] : []),
  ].join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${baseTag}
<title>${esc(doc.serial)} — ${esc(payload.quotation.title)} — Thinkway</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>${QUOTATION_TEMPLATE_STYLES}</style>
</head>
<body class="${bodyClass}">
${sections}
</body>
</html>`;
}
