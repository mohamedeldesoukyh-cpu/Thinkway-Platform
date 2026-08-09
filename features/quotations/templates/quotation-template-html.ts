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
import { isCreatorDeckTemplate, isLumpSumPricingTemplate } from "@/features/quotations/export/quotation-template";
import { buildQuotationTemplatePayload } from "./quotation-template-payload";
import {
  MIX_CATEGORY_BLOCK_MM,
  paginateMixTiers,
  type MixCreatorUnit,
  type MixTierInput,
} from "./quotation-template-pagination";
import {
  QUOTATION_TEMPLATE_LOGO_SVG,
  QUOTATION_TEMPLATE_LOGO_SVG_DARK,
  QUOTATION_TEMPLATE_STYLES,
} from "./quotation-template-styles";
import type { QuotationTemplatePayload } from "./quotation-template-types";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { getReportPlatformIconTitle } from "@/lib/performance/report/report-platform-icons";

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

function platformBadgeHtml(platform: string): string {
  const key = canonicalPlatformKey(platform) || "other";
  const label = getReportPlatformIconTitle(platform);
  return `<span class="pf"><span class="pf-ico ${esc(key)}"></span>${esc(label)}</span>`;
}

function normalizeHandleKey(handle: string): string {
  return handle.replace(/^@/, "").trim().toLowerCase();
}

function parseFeeNumber(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatFeeDisplay(amount: number): string {
  return Math.round(amount).toLocaleString("en-US");
}

function resolveCreatorFee(
  handle: string,
  feeLines: QuotationTemplatePayload["feeLines"],
  group: QuotationDocument["creatorGroups"][number] | undefined,
  showFees: boolean
): string | null {
  if (!showFees) return null;
  const key = normalizeHandleKey(handle);
  const fromLines = feeLines
    .filter((line) => normalizeHandleKey(line.avatarGroupKey) === key)
    .map((line) => parseFeeNumber(line.grossFee ?? null))
    .filter((n): n is number => n != null);
  if (fromLines.length > 0) {
    return formatFeeDisplay(fromLines.reduce((a, b) => a + b, 0));
  }
  if (!group) return null;
  const fromRows = group.rows
    .filter((row) => !row.isCollapsePackageFollower)
    .map((row) => parseFeeNumber(row.clientCost.match(/([\d,.\s]+)/)?.[1] ?? null))
    .filter((n): n is number => n != null);
  if (fromRows.length === 0) return null;
  return formatFeeDisplay(fromRows.reduce((a, b) => a + b, 0));
}

function mixColumnFlags(payload: QuotationTemplatePayload): {
  showFees: boolean;
} {
  // Views / Avg views removed from all quotation templates (preview + export).
  return {
    showFees: payload.flags.showcaseCreators && payload.flags.showFees,
  };
}

function splitMoneyParts(full: string): { currency: string; amount: string } {
  const match = full.trim().match(/^([A-Z]{3})\s+(.+)$/);
  if (match) return { currency: match[1]!, amount: match[2]! };
  return { currency: "EGP", amount: full.trim() };
}

function renderPageHead(sectionLabel: string, title: string, continued = false): string {
  return `<div class="page-head">
    <div class="page-head-copy">
      <div class="sec-tick">${esc(sectionLabel)}</div>
      <h2 class="sec-title${continued ? " cont" : ""}">${esc(title)}</h2>
    </div>
    ${renderLogo("footer")}
  </div>`;
}

function buildMixTier(
  payload: QuotationTemplatePayload,
  creatorGroups: QuotationDocument["creatorGroups"]
): MixTierInput[] {
  const { showFees } = mixColumnFlags(payload);

  return payload.tiers.map((tier) => {
    const creators: MixCreatorUnit[] = tier.creators.map((creator) => {
      const group = creatorGroups.find(
        (entry) =>
          normalizeHandleKey(entry.handle) === normalizeHandleKey(creator.handle)
      );
      const metrics = group?.platformMetrics ?? [];
      const platforms =
        metrics.length > 0
          ? metrics.map((metric) => ({
              platform: metric.platform,
              followers: metric.followers,
              views: metric.views,
              engagement: metric.engagement,
            }))
          : [
              {
                platform: creator.platformIcons[0] || creator.platform || "instagram",
                followers: creator.followers,
                views: creator.views,
                engagement: creator.er,
              },
            ];
      return {
        handle: creator.handle.startsWith("@") ? creator.handle : `@${creator.handle}`,
        category: creator.category,
        fee: resolveCreatorFee(creator.handle, payload.feeLines, group, showFees),
        platforms,
      };
    });

    const feeSum = creators
      .map((c) => parseFeeNumber(c.fee))
      .filter((n): n is number => n != null)
      .reduce((a, b) => a + b, 0);
    const feeMeta = showFees && feeSum > 0 ? ` · EGP ${formatFeeDisplay(feeSum)}` : "";
    const creatorCount = `${tier.creators.length} creator${tier.creators.length === 1 ? "" : "s"}`;

    return {
      name: tier.name.toUpperCase(),
      slug: tier.slug,
      meta: `${creatorCount} · ${tier.followers} followers · Avg ER ${tier.avgER}${feeMeta}`,
      creators,
    };
  });
}

function renderMixTableRows(
  creators: MixCreatorUnit[],
  options: { showFees: boolean }
): string {
  return creators
    .flatMap((creator) =>
      creator.platforms.map((platform, index) => {
        const leadClass = index === 0 ? "lead" : "";
        const feeCell = options.showFees
          ? `<td class="r fee">${index === 0 ? esc(creator.fee ?? "—") : ""}</td>`
          : "";
        return `<tr class="${leadClass}"><td class="h">${index === 0 ? esc(creator.handle) : ""}</td><td>${platformBadgeHtml(platform.platform)}</td><td class="r">${esc(platform.followers)}</td><td>${index === 0 ? esc(creator.category) : ""}</td><td class="r">${esc(platform.engagement)}</td>${feeCell}</tr>`;
      })
    )
    .join("");
}

function renderMixTierSlice(
  slice: {
    name: string;
    slug: string;
    meta: string;
    continued: boolean;
    creators: MixCreatorUnit[];
  },
  options: { showFees: boolean }
): string {
  const headLabel = slice.continued ? `${slice.name} (cont.)` : slice.name;
  const cols = options.showFees
    ? `<th>Creator</th><th>Platform</th><th class="r">Followers</th><th>Category</th><th class="r">ER %</th><th class="r">Fees (EGP)</th>`
    : `<th>Creator</th><th>Platform</th><th class="r">Followers</th><th>Category</th><th class="r">ER %</th>`;
  return `<div class="tier tier-breakdown-block">
      <div class="tier-head tier-breakdown-header">
        <span class="tier-tag">${esc(headLabel)}</span>
        <span class="tier-meta">${esc(slice.meta)}</span>
      </div>
      <table class="tbl tier-breakdown-table">
        <thead><tr>${cols}</tr></thead>
        <tbody>${renderMixTableRows(slice.creators, options)}</tbody>
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
/** Deliverables kept with identity on first creator page; remainder continues cleanly. */
const SHOWCASE_CREATOR_DELIVERABLES_FIRST_PAGE = 4;
const SHOWCASE_CREATOR_DELIVERABLES_CONTINUATION = 7;

/** Kept for collapse packages that still need a light fit on fixed A4 landscape. */
function showcasePdfSlideStyle(scale: number): string {
  if (scale >= 0.999) return "";
  return ` style="zoom:${scale.toFixed(2)}"`;
}

function showcaseCollapSlideScale(creatorCount: number, showBundleIntro: boolean): number {
  // Prefer continuation over aggressive shrink — keep text readable.
  let scale = 0.96;
  if (creatorCount > 3) scale -= 0.03;
  if (creatorCount > 5) scale -= 0.03;
  if (showBundleIntro) scale -= 0.02;
  return Math.max(0.9, scale);
}

function chunkArray<T>(items: T[], firstSize: number, nextSize: number): T[][] {
  if (items.length === 0) return [[]];
  const chunks: T[][] = [];
  chunks.push(items.slice(0, firstSize));
  for (let i = firstSize; i < items.length; i += nextSize) {
    chunks.push(items.slice(i, i + nextSize));
  }
  return chunks;
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
  const showcase = payload.flags.showcaseCreators;
  const pitch = payload.flags.pitchCreators;
  const meta = pitch
    ? `<div class="metagrid">
      <div class="m"><p class="l">Client</p><p class="v">${esc(q.client)}</p></div>
      <div class="m"><p class="l">Brand</p><p class="v">${esc(q.brand)}</p></div>
      <div class="m"><p class="l">Issue Date</p><p class="v mono">${esc(q.issueDate)}</p></div>
      <div class="m"><p class="l">Valid Until</p><p class="v mono">${esc(q.validUntil)}</p></div>
    </div>`
    : showcase
      ? `<div class="metagrid">
      <div class="m"><p class="l">Quotation No.</p><p class="v mono">${esc(q.number)}</p></div>
      <div class="m"><p class="l">Client</p><p class="v">${esc(q.client)}</p></div>
      <div class="m"><p class="l">Brand</p><p class="v">${esc(q.brand)}</p></div>
      <div class="m"><p class="l">Issue · Valid</p><p class="v mono">${esc(q.issueDate)} · ${esc(q.validUntil)}</p></div>
    </div>`
      : `<div class="metagrid">
      <div class="m"><p class="l">Quotation No.</p><p class="v mono">${esc(q.number)}</p></div>
      <div class="m"><p class="l">Client</p><p class="v">${esc(q.client)}</p></div>
      <div class="m"><p class="l">Brand</p><p class="v">${esc(q.brand)}</p></div>
      <div class="m"><p class="l">Prepared By</p><p class="v">${esc(q.preparedBy)}</p></div>
      <div class="m"><p class="l">Issue Date</p><p class="v mono">${esc(q.issueDate)}</p></div>
      <div class="m"><p class="l">Valid Until</p><p class="v mono">${esc(q.validUntil)}</p></div>
      <div class="m"><p class="l">Version</p><p class="v mono">${esc(q.version)}</p></div>
      <div class="m"><p class="l">Status</p><p class="v">${esc(q.status)}</p></div>
    </div>`;

  return `<section class="cover cpage">
  <div class="glow glow-a"></div><div class="glow glow-b"></div>
  <div class="pad">
    <div class="cbar">
      ${renderLogo("cover")}
      ${showcase ? "" : `<div class="chip">${esc(q.version)} · ${esc(q.status)}</div>`}
    </div>
    <div class="kicker">${esc(c.kicker)}</div>
    <h1>${esc(q.title)}</h1>
    <p class="sub">${esc(c.subtitle)}</p>
    ${meta}
    <div class="statrow">
      <div class="stat"><p class="sl">Campaign Creators</p><p class="sv">${esc(camp.creatorCount)}${showcase ? ` <span style="font-size:16px;font-weight:600;opacity:.85">· ${esc(camp.tierSummary)}</span>` : ""}</p>${showcase ? "" : `<p class="su">${esc(camp.tierSummary)}</p>`}</div>
      <div class="stat"><p class="sl">${esc(c.stat3.label)}</p><p class="sv">${esc(c.stat3.value)}</p></div>
    </div>
  </div>
  <div class="foot">
    <span>Confidential · Thinkway Platform · ${esc(q.issueDate)}</span><span>Issued ${esc(q.issueDate)}</span>
  </div>
</section>`;
}

function renderCategoryTierPages(
  payload: QuotationTemplatePayload,
  creatorGroups: QuotationDocument["creatorGroups"]
): string {
  const cols = mixColumnFlags(payload);
  const tiers = buildMixTier(payload, creatorGroups);
  const showcase = payload.flags.showcaseCreators;
  const firstPageExtraMm = showcase ? 0 : MIX_CATEGORY_BLOCK_MM;
  const pages = paginateMixTiers(tiers, {
    firstPageExtraMm,
    includeBanner: true,
  });

  // Line-item: full-width category bars (matches Thinkway LineItem reference).
  const categories = payload.categories
    .map(
      (cat) =>
        `<div class="cat-bar"><span class="cn">${esc(cat.name)}</span><b>${esc(cat.count)}</b><span class="cs">${esc(cat.countLabel)} · ${esc(cat.share)}</span></div>`
    )
    .join("");

  const money = splitMoneyParts(payload.commercial.headlineValue || "EGP —");

  return pages
    .map((page) => {
      const sectionLabel = showcase ? "01 · Investment summary" : "01 · Creators by category";
      const title = showcase
        ? page.continued
          ? "Creators & fees (continued)"
          : "Creators & fees"
        : page.continued
          ? "Creator mix (continued)"
          : "Creator mix";
      const footRight = showcase
        ? `${payload.quotation.number} · Summary`
        : `${payload.quotation.number} · Creator mix`;
      const categoryBlock =
        page.showCategories && !showcase
          ? `<div class="cat-bars">${categories || `<div class="cat-bar"><span class="cn">—</span><b>0</b><span class="cs">No categories</span></div>`}</div>`
          : "";
      const banner = page.showBanner
        ? `<div class="banner tier-breakdown-grand-total"><div class="gl">TOTAL INVESTMENT · ${esc(payload.totals.creatorCount)} CREATORS · ${esc(money.currency)}</div><div class="gv">${esc(money.amount)}</div></div>`
        : "";

      return `<section class="cpage page summary-overview-page">
  <div class="cwrap pad">
    ${renderPageHead(sectionLabel, title, page.continued)}
    ${categoryBlock}
    ${page.tiers.map((slice) => renderMixTierSlice(slice, cols)).join("")}
    ${banner}
  </div>
  <div class="foot"><span>${esc(payload.footer.left)}</span><span class="mono">${esc(footRight)}</span></div>
</section>`;
    })
    .join("");
}

function renderClosingPage(payload: QuotationTemplatePayload): string {
  const q = payload.quotation;
  return `<section class="cpage grad closing">
  <div class="glow glow-a"></div><div class="glow glow-b"></div>
  <div class="pad">
    ${renderLogo("cover")}
    <div class="closing-rule"></div>
    <h1>Let's build something worth watching.</h1>
    <p class="sub">Thank you for reviewing this quotation. We're ready to bring the ${esc(q.client)} × ${esc(q.brand)} campaign to life.</p>
    <div class="closing-meta">
      <div>
        <p class="el">Email</p>
        <p class="ev">hello@thinkwaymedia.com</p>
        <p class="legal">${esc(payload.company.legalLine)}<br>${esc(payload.company.address)}</p>
      </div>
      <div class="mono" style="opacity:.75">${esc(q.number)}</div>
    </div>
  </div>
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
  const feeHead = payload.flags.showFees
    ? `<th class="r">${esc(showcaseFeeColumnLabel(true))}</th>`
    : "";
  const colSpan = payload.flags.showFees ? 5 : 4;

  const renderDeliverableRows = (
    rows: (typeof payload.showcaseCreators)[number]["deliverables"]
  ) =>
    rows
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

      const platformMetricCount = creator.platformMetrics.length;
      const publicationLimit = forPdf
        ? platformMetricCount > 2
          ? Math.min(3, SHOWCASE_PDF_PUBLICATION_SHOT_LIMIT)
          : SHOWCASE_PDF_PUBLICATION_SHOT_LIMIT
        : undefined;
      const publicationShots = (group?.publicationShots ?? []).slice(
        0,
        publicationLimit
      );
      const pubsHtml = renderPublicationShotsGrid(
        publicationShots,
        siteOrigin,
        "No publication screenshots available for this creator."
      );

      // Preview and PDF share the same fixed cpage box (scale only for screen chrome).
      const pageClass = `cpage page showcase-creator-page showcase-creator-slide showcase-slide${pitchPageClass}`;

      const creatorPlatformIcons = renderQuotationPlatformIconsHtml(creator.platformIcons);
      const metricRowsHtml =
        creator.platformMetrics.length > 0
          ? creator.platformMetrics
              .map(
                (row, metricIndex) => `<tr>
          <td class="r">${esc(row.followers)}</td>
          <td class="r">${esc(row.engagement)}</td>
          <td>${metricIndex === 0 ? `<span class="pill">${esc(creator.tier)}</span>` : ""}</td>
          <td class="categories-cell">${metricIndex === 0 ? esc(creator.categories) : ""}</td>
          <td class="platform-cell">${renderQuotationPlatformIconsHtml([row.platform]) || esc(row.platform)}</td>
        </tr>`
              )
              .join("")
          : `<tr>
          <td class="r">${esc(creator.followers)}</td>
          <td class="r">${esc(creator.engagement)}</td>
          <td><span class="pill">${esc(creator.tier)}</span></td>
          <td class="categories-cell">${esc(creator.categories)}</td>
          <td class="platform-cell">${creatorPlatformIcons || esc(creator.platforms)}</td>
        </tr>`;
      // One metrics row per linked platform — Followers / ER only (no Views).
      const metricsTable = `<div class="fees showcase-metrics-table">
      <table class="data-table">
        <thead><tr><th class="r">Followers</th><th class="r">Engagement</th><th>Tier</th><th>Category</th><th>Platforms</th></tr></thead>
        <tbody>${metricRowsHtml}</tbody>
      </table>
    </div>`;

      // Adaptive pagination: keep creator identity together; continue deliverables cleanly.
      // Preview and PDF share the same chunking so layouts match exactly.
      const firstPageDeliverables =
        platformMetricCount > 2
          ? Math.min(2, SHOWCASE_CREATOR_DELIVERABLES_FIRST_PAGE)
          : SHOWCASE_CREATOR_DELIVERABLES_FIRST_PAGE;
      const deliverableChunks = chunkArray(
        creator.deliverables,
        firstPageDeliverables,
        SHOWCASE_CREATOR_DELIVERABLES_CONTINUATION
      );

      return deliverableChunks
        .map((chunk, chunkIndex) => {
          const continued = chunkIndex > 0;
          const deliverableRows = renderDeliverableRows(chunk);
          const bodyRows =
            deliverableRows ||
            `<tr><td colspan="${colSpan}" class="pub-empty">No deliverables listed.</td></tr>`;

          if (continued) {
            return `<section class="${pageClass}">
  <div class="cwrap pad showcase-creator-sheet">
    ${renderPageHead(`${creator.sectionNo} · Creator ${creator.index} of ${payload.totals.creatorCount}`, `${creator.name} (continued)`)}
    <p class="sc-handle showcase-handle" style="margin:-6px 0 14px;">${esc(creator.handle)}</p>
    <p class="sc-sub showcase-deliverables-title">Proposed deliverables (continued)</p>
    <div class="fees showcase-deliverables-table">
      <table class="data-table">
        <thead><tr><th>Option</th><th>Service description</th><th>Platform</th><th>Type</th>${feeHead}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  </div>
  <div class="foot"><span>${esc(payload.footer.left)}</span><span class="mono">${esc(payload.quotation.number)} · ${esc(creator.handle)} · ${chunkIndex + 1}</span></div>
</section>`;
          }

          return `<section class="${pageClass}">
  <div class="cwrap pad showcase-creator-sheet">
    ${renderPageHead(`${creator.sectionNo} · Creator ${creator.index} of ${payload.totals.creatorCount}`, creator.name)}
    <div class="sc-top">
      ${profileLinkStart}${avatarHtml}${profileLinkEnd}
      <div class="sc-identity">
        ${profileLinkStart}<p class="sc-handle showcase-handle">${esc(creator.handle)}${creatorPlatformIcons ? ` <span class="sc-platform-icons">${creatorPlatformIcons}</span>` : ""}</p>${profileLinkEnd}
        ${metricsTable}
      </div>
    </div>
    <p class="sc-sub showcase-pubs-title">Recent publications</p>
    ${pubsHtml}
    <p class="sc-sub showcase-deliverables-title">Proposed deliverables</p>
    <div class="fees showcase-deliverables-table">
      <table class="data-table">
        <thead><tr><th>Option</th><th>Service description</th><th>Platform</th><th>Type</th>${feeHead}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  </div>
  <div class="foot"><span>${esc(payload.footer.left)}</span><span class="mono">${esc(payload.quotation.number)} · ${esc(creator.handle)}</span></div>
</section>`;
        })
        .join("");
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
      return `<tr><td class="name roster-creator">${avatar}<span>${esc(row.handle)}</span></td><td class="r">${esc(row.followers)}</td><td class="r">${esc(row.er)}</td><td><span class="pill">${esc(row.tier)}</span></td><td class="categories-cell">${esc(row.categories)}</td><td class="platform-cell">${platformCell}</td></tr>`;
    })
    .join("");

  return `<section class="cpage page roster-page">
  <div class="cwrap pad">
    ${renderPageHead(`${payload.roster.sectionNo} · Creator roster (${payload.totals.creatorCount})`, "At a glance")}
    <div class="fees">
      <table class="data-table">
        <thead><tr><th>Creator</th><th class="r">Followers</th><th class="r">Eng %</th><th>Tier</th><th>Category</th><th>Platforms</th></tr></thead>
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

  const commercialHeader = renderPageHead(
    `${c.sectionNo} · Commercial summary`,
    "Investment & deliverables"
  );

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

  return `<section class="cpage page commercial-page" id="section-commercial">
  <div class="cwrap pad">
    ${commercialHeader}
    ${commTop}
    ${itemizedTable}
    ${totalsBlock}
  </div>
  <div class="foot"><span>${esc(footLeft)}</span><span class="mono">${esc(footRight)}</span></div>
</section>`;
}

function renderNotesPage(doc: QuotationDocument, payload: QuotationTemplatePayload): string {
  const notes = doc.notes?.trim();
  if (!notes) return "";
  // Keep notes as one continuous block — wrap fully; never truncate commercial explanations.
  return `<section class="cpage page commercial-notes-page" id="section-notes">
  <div class="cwrap pad">
    ${renderPageHead("Notes · Commercial notes", "Notes & recommendations")}
    <div class="quotation-notes-block insight" style="margin-top:8px;">
      <p style="margin:0; white-space:pre-wrap; overflow-wrap:break-word; word-break:normal; line-height:1.55;">${esc(notes)}</p>
    </div>
  </div>
  <div class="foot"><span>${esc(payload.footer.left)}</span><span class="mono">${esc(payload.quotation.number)} · Notes</span></div>
</section>`;
}

function renderTermsPage(payload: QuotationTemplatePayload): string {
  const items = payload.terms.items
    .map(
      (term) =>
        `<div class="term"><h4>${esc(term.heading)}</h4><p style="white-space:pre-wrap; overflow-wrap:break-word; word-break:normal;">${esc(term.body)}</p></div>`
    )
    .join("");
  return `<section class="cpage page" id="section-terms">
  <div class="cwrap pad">
    ${renderPageHead(`${payload.terms.sectionNo} · Terms & conditions`, "The agreement")}
    <div class="terms-grid">${items}</div>
  </div>
  <div class="foot"><span>${esc(payload.footer.left)}</span><span class="mono">${esc(payload.quotation.number)} · Terms</span></div>
</section>`;
}

function renderAcceptancePage(payload: QuotationTemplatePayload): string {
  const q = payload.quotation;
  return `<section class="cpage page" id="section-acceptance">
  <div class="cwrap pad">
    ${renderPageHead(`${payload.acceptance.sectionNo} · Acceptance`, "Sign & approve")}
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
          return `<section class="cpage page collapse-content-page collapse-content-slide showcase-slide"${showcasePdfSlideStyle(slideScale)}>
  <div class="cwrap pad">
    <div class="sec-tick">CC · ${esc(bundle.previewLabel)}</div>
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

      return bundle.packages
        .map((pkg, packageIndex) => {
          const showBundleIntro = packageIndex === 0;
          return `<section class="cpage page collapse-content-page">
  <div class="cwrap pad">
    <div class="sec-tick">CC · ${esc(bundle.previewLabel)}</div>
    <h2 class="sec-title">${esc(bundle.label)}${showBundleIntro ? "" : " (continued)"}</h2>
    ${
      showBundleIntro
        ? `<p class="collap-bundle-intro">${esc(bundle.previewLabel)} — ${esc(optionSummary)} with shared creator bundles and independent pricing per option.</p>`
        : ""
    }
    ${renderCollapsePackageCard(bundle, pkg, doc, siteOrigin)}
  </div>
  <div class="foot"><span>Thinkway · hello@thinkwaymedia.com</span><span class="mono">${esc(bundle.label)} · ${esc(doc.serial)}</span></div>
</section>`;
        })
        .join("");
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
    renderCategoryTierPages(payload, doc.creatorGroups),
    renderCollapseContentPages(doc, siteOrigin, forPdf),
    ...(payload.flags.showcaseCreators
      ? [renderShowcaseCreatorPages(payload, doc, siteOrigin, forPdf), renderRosterPage(payload)]
      : []),
    ...(payload.flags.showCommercialSummary
      ? [renderCommercialPage(payload, doc, siteOrigin)]
      : []),
    renderNotesPage(doc, payload),
    ...(payload.flags.includeTerms ? [renderTermsPage(payload)] : []),
    ...(payload.flags.includeAcceptance ? [renderAcceptancePage(payload)] : []),
    ...(payload.flags.showcaseCreators ? [renderClosingPage(payload)] : []),
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
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>${QUOTATION_TEMPLATE_STYLES}</style>
</head>
<body class="${bodyClass}">
${sections}
</body>
</html>`;
}
