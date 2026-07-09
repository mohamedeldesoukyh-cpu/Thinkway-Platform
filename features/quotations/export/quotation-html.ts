/**
 * Enterprise client quotation HTML — cover, commercial grid, summary, terms, signatures.
 * Preview / Word / PDF share this renderer (puppeteer via vendor-io-pdf).
 */
import { QUOTATION_CLIENT_LABELS } from "@/features/quotations/constants";
import type { CreatorTierLabel } from "@/lib/creators/creator-tier";
import {
  creatorAvatarBrowserDisplayUrl,
  initialsFromCreatorName,
} from "@/lib/performance/creator-avatar";
import { shouldProxyPublicationMediaUrl } from "@/lib/creators/recent-publication-thumb";
import { isAllowedPublicationPreviewSrcUrl } from "@/lib/creators/publication-preview-proxy";
import { resolveExportPublicationShotProxyUrl } from "@/features/quotations/export/quotation-export-publications";
import {
  getReportPlatformIconDataUri,
  getReportPlatformIconTitle,
} from "@/lib/performance/report/report-platform-icons";
import { renderThinkwayReportLogoHtml } from "@/lib/reports/document/thinkway-report-logo";
import { THINKWAY_REPORT_STYLES } from "@/lib/reports/document/thinkway-report-styles";
import type {
  QuotationDocCreatorGroup,
  QuotationDocPublicationShot,
  QuotationDocRow,
  QuotationDocument,
} from "./quotation-document";
import { buildQuotationDocumentStyles } from "./quotation-document-styles";
import {
  isLumpSumPricingTemplate,
  isShowcaseTemplate,
} from "./quotation-template";

export type BuildQuotationHtmlOptions = {
  siteOrigin?: string;
};

const TIER_BADGE_STYLE: Record<CreatorTierLabel, string> = {
  Celebrity: "background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);color:#92400e;",
  Macro: "background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.35);color:#3730a3;",
  "Mid-Tier": "background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.35);color:#5b21b6;",
  Micro: "background:rgba(29,158,117,.12);border:1px solid rgba(29,158,117,.35);color:#178f69;",
  Nano: "background:rgba(100,116,139,.12);border:1px solid rgba(148,163,184,.35);color:#334155;",
  Unknown: "background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;",
};

const CREATOR_GROUP_STYLES = `
  .creator-quote-block {
    margin-bottom: 18px;
    border: 1px solid var(--rule);
    border-radius: 6px;
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .creator-quote-block + .creator-quote-block { margin-top: 4px; }
  .creator-quote-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    background: #F1F5F9;
    border-bottom: 1px solid var(--rule);
  }
  .creator-quote-header .creator-cell {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .creator-cell-avatar {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: 50%;
    object-fit: cover;
    display: block;
    background: #EEF4FF;
  }
  .creator-cell-avatar--initials {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    color: #1D9E75;
  }
  .creator-quote-header .creator-name {
    font-size: 12px;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.3;
  }
  .creator-quote-header .creator-handle {
    font-size: 10px;
    color: var(--muted);
    margin-top: 1px;
  }
  .creator-profile-link {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    color: inherit;
    text-decoration: none;
  }
  .creator-profile-link:hover .creator-name {
    color: #1E5EFF;
  }
  .tier-badge {
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 8px;
    border-radius: 999px;
    font-size: 9px;
    font-weight: 700;
    white-space: nowrap;
    line-height: 1;
  }
  .platform-icons {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0;
  }
  .platform-link-icon {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: block;
    object-fit: cover;
    background: #fff;
    box-shadow: 0 0 0 2px #fff;
  }
  .platform-link-icon.overlap { margin-left: -10px; }
  .platform-all-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    max-width: 4.5rem;
    padding: 2px 6px;
    border-radius: 999px;
    background: #e2e8f0;
    color: #334155;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    line-height: 1.2;
    text-align: center;
  }
  .platform-text-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #334155;
    font-size: 9px;
    font-weight: 700;
  }
  .creator-quote-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 10px;
    color: var(--muted);
    white-space: nowrap;
  }
  .creator-quote-meta strong {
    color: var(--ink);
    font-weight: 600;
  }
  .creator-category-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }
  .creator-category-chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #475569;
    font-size: 9px;
    font-weight: 600;
    line-height: 1.3;
    text-transform: capitalize;
  }
  .creator-quote-block .data-table {
    border: none;
    border-radius: 0;
  }
  .creator-quote-block .data-table thead th:first-child,
  .creator-quote-block .data-table tbody td:first-child {
    padding-left: 12px;
  }
  .creator-quote-block .data-table thead th:last-child,
  .creator-quote-block .data-table tbody td:last-child {
    padding-right: 12px;
  }
`;

const SHOWCASE_STYLES = `
  .showcase-creator-page {
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid;
    break-inside: avoid;
    padding: 12px 0 20px;
    display: flex;
    flex-direction: column;
  }
  .showcase-creator-page + .showcase-creator-page {
    page-break-before: always;
    break-before: page;
  }
  .showcase-creator-page:last-of-type {
    page-break-after: auto;
    break-after: auto;
  }
  .showcase-creator-sheet {
    page-break-inside: avoid;
    break-inside: avoid;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .showcase-hero {
    text-align: center;
    margin: 8px 0 28px;
  }
  .showcase-avatar {
    width: 140px;
    height: 140px;
    border-radius: 50%;
    object-fit: cover;
    margin: 0 auto 16px;
    display: block;
    border: 4px solid #E8F5F0;
    box-shadow: 0 4px 24px rgba(29,158,117,.15);
    background: #EEF4FF;
  }
  .showcase-avatar--initials {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 36px;
    font-weight: 700;
    color: #1D9E75;
    background: #E8F5F0;
  }
  .showcase-name {
    font-size: 22px;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.25;
    margin: 0 0 4px;
  }
  .showcase-handle {
    font-size: 12px;
    color: var(--muted);
    margin-top: 2px;
  }
  .verified-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #1D9E75;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    margin-left: 6px;
    vertical-align: middle;
    line-height: 1;
  }
  .showcase-kpi-row {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
    margin-bottom: 20px;
  }
  .showcase-kpi {
    border: 1px solid var(--rule);
    border-radius: 6px;
    padding: 12px 10px;
    text-align: center;
    background: #F8FAFC;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .showcase-kpi label {
    display: block;
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--muted);
    margin-bottom: 4px;
  }
  .showcase-kpi strong {
    display: block;
    font-size: 14px;
    font-weight: 700;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .showcase-kpi .platform-icons {
    justify-content: center;
    margin-top: 2px;
  }
  .showcase-deliverables-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--muted);
    margin-bottom: 8px;
  }
  .showcase-pubs {
    margin: 0 0 22px;
  }
  .showcase-pubs-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--muted);
    margin-bottom: 10px;
  }
  .showcase-pubs-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .showcase-pub-card {
    border: 1px solid var(--rule);
    border-radius: 8px;
    overflow: hidden;
    background: #F8FAFC;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .showcase-pub-thumb-wrap {
    position: relative;
    display: block;
  }
  .showcase-pub-thumb {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    background: #EEF4FF;
  }
  .showcase-pub-play {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .showcase-pub-play-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(15, 23, 42, 0.58);
    border: 2px solid rgba(255, 255, 255, 0.92);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.22);
  }
  .showcase-pub-play-icon svg {
    width: 16px;
    height: 16px;
    fill: #fff;
    margin-left: 2px;
  }
  .showcase-pub-empty {
    border: 1px dashed var(--rule);
    border-radius: 8px;
    padding: 18px 14px;
    text-align: center;
    font-size: 11px;
    color: var(--muted);
    background: #F8FAFC;
  }
  @media print {
    .quotation-showcase .report-body {
      padding-top: 0;
      padding-bottom: 4px;
    }
    .showcase-creator-page {
      padding: 0 0 6px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .showcase-creator-page .section-label {
      margin-bottom: 6px;
    }
    .showcase-hero {
      margin: 0 0 10px;
    }
    .showcase-avatar {
      width: 88px;
      height: 88px;
      margin-bottom: 8px;
      border-width: 3px;
    }
    .showcase-avatar--initials {
      font-size: 24px;
    }
    .showcase-name {
      font-size: 18px;
      margin: 0 0 2px;
    }
    .showcase-handle {
      font-size: 10px;
    }
    .showcase-kpi-row {
      grid-template-columns: repeat(6, 1fr);
      gap: 4px;
      margin-bottom: 10px;
    }
    .showcase-kpi {
      padding: 6px 4px;
    }
    .showcase-kpi label {
      font-size: 7px;
      margin-bottom: 2px;
    }
    .showcase-kpi strong {
      font-size: 11px;
    }
    .showcase-pubs {
      margin: 0 0 10px;
    }
    .showcase-pubs-title {
      margin-bottom: 6px;
    }
    .showcase-pubs-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 5px;
    }
    .showcase-pub-card {
      max-height: 72px;
    }
    .showcase-pub-thumb {
      aspect-ratio: 1;
      max-height: 72px;
      object-fit: cover;
    }
    .showcase-pub-play-icon {
      width: 28px;
      height: 28px;
    }
    .showcase-pub-play-icon svg {
      width: 12px;
      height: 12px;
    }
    .showcase-deliverables-title {
      margin-bottom: 4px;
    }
    .showcase-creator-page .data-table {
      font-size: 10px;
    }
    .showcase-creator-page .data-table thead th,
    .showcase-creator-page .data-table tbody td {
      padding: 4px 6px;
    }
    .showcase-kpi-row { grid-template-columns: repeat(6, 1fr); }
    .showcase-pubs-grid { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 600px) {
    .showcase-kpi-row { grid-template-columns: repeat(2, 1fr); }
    .showcase-pubs-grid { grid-template-columns: repeat(2, 1fr); }
  }
`;

function esc(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Inline amount + currency so EGP never wraps below the number. */
export function renderMoney(value: string): string {
  const dual = value.match(/^([\d,.\s]+)\s+(\w+)\s+\/\s+([\d,.\s]+)\s+(\w+)$/);
  if (dual) {
    return `<span class="money"><span class="money-primary">${esc(dual[1])} ${esc(dual[2])}</span><span class="money-sep">/</span><span class="money-amount">${esc(dual[3])}</span><span class="money-currency">${esc(dual[4])}</span></span>`;
  }
  const single = value.match(/^([\d,.\s]+)\s+(\w+)$/);
  if (single) {
    return `<span class="money"><span class="money-amount">${esc(single[1])}</span><span class="money-currency">${esc(single[2])}</span></span>`;
  }
  return esc(value);
}

function optionColumnCount(doc: QuotationDocument): number {
  return doc.audience === "internal" ? 14 : 6;
}

function lumpSumOptionColumnCount(doc: QuotationDocument): number {
  return doc.audience === "internal" ? 8 : 5;
}

function resolveCreatorAvatarSrc(
  group: QuotationDocCreatorGroup,
  siteOrigin?: string
): string | null {
  // Embedded data URIs render everywhere (preview iframe, puppeteer PDF).
  if (group.avatarUrl?.startsWith("data:")) return group.avatarUrl;

  const absoluteProxyUrl = (proxyPath: string | null | undefined): string | null => {
    if (!proxyPath) return null;
    if (siteOrigin) {
      return `${siteOrigin.replace(/\/$/, "")}${proxyPath}`;
    }
    return proxyPath.startsWith("/") ? proxyPath : null;
  };

  const proxyUrl =
    absoluteProxyUrl(group.avatarProxyUrl) ??
    absoluteProxyUrl(
      group.avatarUrl && group.profileUrl
        ? creatorAvatarBrowserDisplayUrl(group.avatarUrl, group.profileUrl)
        : null
    );

  const rawAvatar = group.avatarUrl?.trim() || null;
  if (rawAvatar) {
    if (shouldProxyPublicationMediaUrl(rawAvatar)) {
      return proxyUrl ?? rawAvatar;
    }
    return rawAvatar;
  }

  return proxyUrl;
}

function resolvePublicationShotSrc(
  shot: QuotationDocPublicationShot,
  siteOrigin?: string
): string | null {
  if (shot.imageUrl.startsWith("data:")) return shot.imageUrl;

  const absoluteProxyUrl = (proxyPath: string | null | undefined): string | null => {
    if (!proxyPath) return null;
    if (siteOrigin) {
      return `${siteOrigin.replace(/\/$/, "")}${proxyPath}`;
    }
    return proxyPath.startsWith("/") ? proxyPath : null;
  };

  const proxyUrl =
    absoluteProxyUrl(shot.imageProxyUrl) ??
    absoluteProxyUrl(resolveExportPublicationShotProxyUrl(shot));

  const rawImage = shot.imageUrl.trim();
  if (rawImage) {
    const mustProxy =
      shouldProxyPublicationMediaUrl(rawImage) || isAllowedPublicationPreviewSrcUrl(rawImage);
    if (mustProxy) {
      return proxyUrl;
    }
    return rawImage;
  }

  return proxyUrl;
}

function renderCreatorAvatar(
  group: QuotationDocCreatorGroup,
  siteOrigin?: string,
  size: "compact" | "hero" = "compact"
): string {
  const initials = esc(initialsFromCreatorName(group.creator));
  const src = resolveCreatorAvatarSrc(group, siteOrigin);
  if (size === "hero") {
    if (src) {
      return `<img class="showcase-avatar" src="${esc(src)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'showcase-avatar showcase-avatar--initials',textContent:'${initials}'}))" />`;
    }
    return `<span class="showcase-avatar showcase-avatar--initials">${initials}</span>`;
  }
  if (src) {
    return `<img class="creator-cell-avatar" src="${esc(src)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'creator-cell-avatar creator-cell-avatar--initials',textContent:'${initials}'}))" />`;
  }
  return `<span class="creator-cell-avatar creator-cell-avatar--initials">${initials}</span>`;
}

function renderProfileLink(
  href: string | null | undefined,
  content: string
): string {
  if (!href) return content;
  return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" class="creator-profile-link">${content}</a>`;
}

function renderCreatorCategoryChips(categories: string[]): string {
  const visible = categories.map((value) => value.trim()).filter(Boolean).slice(0, 3);
  if (!visible.length) return "";
  return `<div class="creator-category-chips">${visible
    .map((category) => `<span class="creator-category-chip">${esc(category)}</span>`)
    .join("")}</div>`;
}

function renderRosterCategoriesCell(categories: string[]): string {
  const chips = renderCreatorCategoryChips(categories);
  return chips || "—";
}

function renderShowcasePlayOverlay(): string {
  return `<span class="showcase-pub-play" aria-hidden="true"><span class="showcase-pub-play-icon"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M8 5v14l11-7z"/></svg></span></span>`;
}

function renderCreatorIdentityBlock(
  group: QuotationDocCreatorGroup,
  siteOrigin?: string
): string {
  const handleBlock =
    group.handle !== "—"
      ? `<div class="creator-handle">${esc(group.handle)}</div>`
      : "";
  const categoriesBlock = renderCreatorCategoryChips(group.categories);

  return renderProfileLink(
    group.profileUrl,
    `${renderCreatorAvatar(group, siteOrigin)}<div><div class="creator-name">${esc(group.creator)}</div>${handleBlock}${categoriesBlock}</div>`
  );
}

function renderCreatorGroupHeader(
  group: QuotationDocCreatorGroup,
  siteOrigin?: string
): string {
  const optionLabel =
    group.optionCount === 1 ? "Option 1" : `${group.optionCount} options`;

  return `<div class="creator-quote-header avoid-break">
    <div class="creator-cell">${renderCreatorIdentityBlock(group, siteOrigin)}</div>
    <div class="creator-quote-meta">
      ${group.followers !== "—" ? `<span>${esc(group.followers)} followers</span>` : ""}
      <strong>${esc(optionLabel)}</strong>
    </div>
  </div>`;
}

function renderTierBadge(tier: string): string {
  if (!tier || tier === "—") return "—";
  const style =
    TIER_BADGE_STYLE[tier as CreatorTierLabel] ?? TIER_BADGE_STYLE.Unknown;
  return `<span class="tier-badge" style="${style}">${esc(tier)}</span>`;
}

function renderPlatformIcons(row: QuotationDocRow): string {
  if (row.allPlatforms) {
    return `<span class="platform-all-badge">All Platform</span>`;
  }
  const icons = row.platformIcons ?? [];
  if (!icons.length) return "—";
  return `<span class="platform-icons">${icons
    .map((platform, index) => {
      const icon = getReportPlatformIconDataUri(platform);
      const title = getReportPlatformIconTitle(platform);
      if (icon) {
        return `<img class="platform-link-icon${index > 0 ? " overlap" : ""}" src="${esc(icon)}" alt="${esc(title)}" title="${esc(title)}" />`;
      }
      return `<span class="platform-text-badge">${esc(title)}</span>`;
    })
    .join("")}</span>`;
}

function renderOptionRows(
  group: QuotationDocCreatorGroup,
  doc: QuotationDocument
): string {
  return group.rows
    .map((r) => {
      if (doc.audience === "client") {
        return `
      <tr class="avoid-break">
        <td>${esc(r.option)}</td>
        <td>${esc(r.serviceDescription)}</td>
        <td class="platform-cell">${renderPlatformIcons(r)}</td>
        <td>${renderTierBadge(r.tier)}</td>
        <td>${esc(r.type)}</td>
        <td class="num">${renderMoney(r.clientCost)}</td>
      </tr>`;
      }

      return `
      <tr class="avoid-break">
        <td>${esc(r.option)}</td>
        <td class="num">${esc(r.followers)}</td>
        <td class="num">${esc(r.engagementRate)}</td>
        <td>${esc(r.country)}</td>
        <td>${esc(r.serviceDescription)}</td>
        <td class="platform-cell">${renderPlatformIcons(r)}</td>
        <td>${renderTierBadge(r.tier)}</td>
        <td>${esc(r.type)}</td>
        <td class="num">${renderMoney(r.unitCost ?? "—")}</td>
        <td class="num">${renderMoney(r.clientCost)}</td>
        <td class="num" style="color:${r.gpColor}">${esc(r.gp ?? "—")}</td>
        <td class="num" style="color:${r.gpColor}">${esc(r.gpPct ?? "—")}</td>
        <td class="num">${renderMoney(r.af)}</td>
        <td class="num">${esc(r.afPct)}</td>
      </tr>`;
    })
    .join("");
}

function renderTableHead(doc: QuotationDocument): string {
  if (doc.audience === "client") {
    return `
            <th>Option</th><th>Service description</th><th>Platform</th><th>Tier</th><th>Type</th>
            <th class="num">${esc(QUOTATION_CLIENT_LABELS.grossFees)}</th>`;
  }
  return `
            <th>Option</th><th class="num">Followers</th>
            <th class="num">ER</th><th>Country</th><th>Service description</th><th>Platform</th><th>Tier</th><th>Type</th>
            <th class="num">Unit Cost</th>
            <th class="num">${esc(QUOTATION_CLIENT_LABELS.clientCost)}</th>
            <th class="num">GP</th><th class="num">GP%</th>
            <th class="num">${esc(QUOTATION_CLIENT_LABELS.agencyFee)}</th>
            <th class="num">${esc(QUOTATION_CLIENT_LABELS.agencyFeePct)}</th>`;
}

function renderCreatorGroupBlock(
  group: QuotationDocCreatorGroup,
  doc: QuotationDocument,
  siteOrigin?: string
): string {
  return `<div class="creator-quote-block avoid-break">
    ${renderCreatorGroupHeader(group, siteOrigin)}
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>${renderTableHead(doc)}</tr>
        </thead>
        <tbody>${renderOptionRows(group, doc)}</tbody>
      </table>
    </div>
  </div>`;
}

function renderCreatorTables(doc: QuotationDocument, siteOrigin?: string): string {
  const colspan = optionColumnCount(doc);
  if (!doc.creatorGroups.length) {
    return `<div class="table-scroll"><table class="data-table"><tbody><tr><td colspan="${colspan}" class="muted" style="text-align:center;padding:24px">No creators added yet.</td></tr></tbody></table></div>`;
  }
  return doc.creatorGroups
    .map((group) => renderCreatorGroupBlock(group, doc, siteOrigin))
    .join("");
}

function renderDetailedSummaryRows(doc: QuotationDocument): string {
  const internalRows =
    doc.audience === "internal" && doc.summary.totalCost
      ? `<tr class="gp"><td>Total Cost</td><td class="num">${renderMoney(doc.summary.totalCost)}</td></tr>
          <tr class="gp"><td>Gross Profit</td><td class="num" style="color:${doc.summary.gpColor}">${esc(doc.summary.totalGpValue ?? "—")}</td></tr>
          <tr class="gp"><td>GP %</td><td class="num" style="color:${doc.summary.gpColor}">${esc(doc.summary.totalGpPct ?? "—")}</td></tr>`
      : "";
  return `${internalRows}
          <tr><td>${esc(QUOTATION_CLIENT_LABELS.totalClientCost)}</td><td class="num">${renderMoney(doc.summary.totalClientCost)}</td></tr>
          <tr><td>${esc(QUOTATION_CLIENT_LABELS.totalAgencyFee)}</td><td class="num">${renderMoney(doc.summary.totalAf)}</td></tr>
          <tr class="total"><td>${esc(QUOTATION_CLIENT_LABELS.totalCostIncludedAf)}</td><td class="num">${renderMoney(doc.summary.grandTotal)}</td></tr>`;
}

function renderLumpSumSummaryRows(doc: QuotationDocument): string {
  return `
          <tr><td>${esc(QUOTATION_CLIENT_LABELS.lumpSumCost)}</td><td class="num">${renderMoney(doc.summary.totalClientCost)}</td></tr>
          <tr><td>${esc(QUOTATION_CLIENT_LABELS.totalAgencyFee)}</td><td class="num">${renderMoney(doc.summary.totalAf)}</td></tr>
          <tr class="total"><td>${esc(QUOTATION_CLIENT_LABELS.totalCost)}</td><td class="num">${renderMoney(doc.summary.grandTotal)}</td></tr>`;
}

function renderLumpSumTableHead(doc: QuotationDocument): string {
  if (doc.audience === "client") {
    return `
            <th>Option</th><th>Service description</th><th>Platform</th><th>Tier</th><th>Type</th>`;
  }
  return `
            <th>Option</th><th class="num">Followers</th>
            <th class="num">ER</th><th>Country</th><th>Service description</th><th>Platform</th><th>Tier</th><th>Type</th>`;
}

function renderLumpSumOptionRows(
  group: QuotationDocCreatorGroup,
  doc: QuotationDocument
): string {
  return group.rows
    .map((r) => {
      if (doc.audience === "client") {
        return `
      <tr class="avoid-break">
        <td>${esc(r.option)}</td>
        <td>${esc(r.serviceDescription)}</td>
        <td class="platform-cell">${renderPlatformIcons(r)}</td>
        <td>${renderTierBadge(r.tier)}</td>
        <td>${esc(r.type)}</td>
      </tr>`;
      }

      return `
      <tr class="avoid-break">
        <td>${esc(r.option)}</td>
        <td class="num">${esc(r.followers)}</td>
        <td class="num">${esc(r.engagementRate)}</td>
        <td>${esc(r.country)}</td>
        <td>${esc(r.serviceDescription)}</td>
        <td class="platform-cell">${renderPlatformIcons(r)}</td>
        <td>${renderTierBadge(r.tier)}</td>
        <td>${esc(r.type)}</td>
      </tr>`;
    })
    .join("");
}

function renderLumpSumCreatorGroupBlock(
  group: QuotationDocCreatorGroup,
  doc: QuotationDocument,
  siteOrigin?: string
): string {
  return `<div class="creator-quote-block avoid-break">
    ${renderCreatorGroupHeader(group, siteOrigin)}
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>${renderLumpSumTableHead(doc)}</tr>
        </thead>
        <tbody>${renderLumpSumOptionRows(group, doc)}</tbody>
      </table>
    </div>
  </div>`;
}

function renderLumpSumCreatorTables(
  doc: QuotationDocument,
  siteOrigin?: string
): string {
  const colspan = lumpSumOptionColumnCount(doc);
  if (!doc.creatorGroups.length) {
    return `<div class="table-scroll"><table class="data-table"><tbody><tr><td colspan="${colspan}" class="muted" style="text-align:center;padding:24px">No creators added yet.</td></tr></tbody></table></div>`;
  }
  return doc.creatorGroups
    .map((group) => renderLumpSumCreatorGroupBlock(group, doc, siteOrigin))
    .join("");
}

function renderTerms(doc: QuotationDocument): string {
  return doc.termsSections
    .map(
      (t) => `
      <li class="avoid-break">
        <h4>${esc(t.title)}</h4>
        <p>${esc(t.body)}</p>
      </li>`
    )
    .join("");
}

function renderKpiGrid(kpis: QuotationDocument["commercialKpis"]): string {
  return `<div class="kpi-grid">${kpis
    .map(
      (k) => `
      <div class="kpi-card avoid-break">
        <label>${esc(k.label)}</label>
        <strong${k.valueColor ? ` style="color:${k.valueColor}"` : ""}>${renderMoney(k.value)}</strong>
      </div>`
    )
    .join("")}</div>`;
}

/**
 * Showcase cover/title prefix (same for showcase + showcase-lump-sum).
 * Export header never says "Lump Sum" — UI dropdown may still distinguish templates.
 * Detailed / lump-sum keep `doc.name`.
 */
function formatShowcaseQuotationTitle(name: string): string {
  const prefix = "Showcase Quotation — ";
  const rewritten = name.replace(/^Quotation\s+[—–-]\s*/i, prefix);
  if (rewritten !== name) return rewritten;
  return `${prefix}${name}`;
}

function renderCoverPage(doc: QuotationDocument): string {
  const statusClass = doc.isExpired ? "status-badge--expired" : "status-badge--active";
  const campaignDisplay =
    doc.campaignName === "—" ? doc.name : doc.campaignName;
  const isShowcase = isShowcaseTemplate(doc.template);
  const isShowcaseDeckOnly = doc.template === "showcase";
  const coverTitle = isShowcase ? formatShowcaseQuotationTitle(doc.name) : doc.name;
  const investmentLabel = isLumpSumPricingTemplate(doc.template)
    ? QUOTATION_CLIENT_LABELS.totalCost
    : QUOTATION_CLIENT_LABELS.clientInvestment;
  const investmentValue = isLumpSumPricingTemplate(doc.template)
    ? doc.summary.grandTotal
    : doc.summary.totalClientCost;
  const templateKicker =
    doc.template === "lump-sum"
      ? " · Lump Sum"
      : isShowcase
        ? " · Showcase"
        : "";

  const fourthKpi = isShowcaseDeckOnly
    ? `<div class="cover-kpi avoid-break"><span class="label">Est. Engagement</span><span class="value">${esc(doc.summary.estimatedEngagement)}</span></div>`
    : `<div class="cover-kpi avoid-break"><span class="label">${esc(investmentLabel)}</span><span class="value">${renderMoney(investmentValue)}</span></div>`;

  return `<section class="cover-page">
    <div class="cover-overlay">
      <div>
        ${renderThinkwayReportLogoHtml({ variant: "cover", theme: "dark" })}
        <div class="cover-kicker">Client Quotation${templateKicker}</div>
        <div class="cover-accent"></div>
        <h1 class="cover-title">${esc(coverTitle)}</h1>
        <p class="cover-subtitle">${esc(doc.preparedForLine)}</p>
        <div class="cover-meta">
          <div><strong>Quotation No.:</strong> ${esc(doc.serial)}</div>
          <div><strong>Client:</strong> ${esc(doc.clientName)}</div>
          <div><strong>Brand:</strong> ${esc(doc.brandName)}</div>
          <div><strong>Campaign:</strong> ${esc(doc.campaignName)}</div>
          <div><strong>Issue Date:</strong> ${esc(doc.issueDateLabel)}</div>
          <div><strong>Valid Until:</strong> ${esc(doc.validityDateLabel)}</div>
          <div><strong>Prepared By:</strong> ${esc(doc.preparedByName)}</div>
          <div><strong>Version:</strong> ${esc(doc.version)} · <span class="status-badge ${statusClass}">${esc(doc.isExpired ? "Expired" : doc.statusLabel)}</span></div>
        </div>
        <div class="cover-kpi-row">
          <div class="cover-kpi avoid-break"><span class="label">Campaign</span><span class="value">${esc(campaignDisplay)}</span></div>
          <div class="cover-kpi avoid-break"><span class="label">Creators</span><span class="value">${doc.summary.creatorCount}</span></div>
          <div class="cover-kpi avoid-break"><span class="label">Est. Reach</span><span class="value">${esc(doc.summary.estimatedReach)}</span></div>
          ${fourthKpi}
        </div>
      </div>
      <div class="cover-footer">
        <span>Confidential · Thinkway Platform</span>
        <span>Issued ${esc(doc.issueDateLabel)}</span>
      </div>
    </div>
  </section>`;
}

function sectionLabel(num: string, title: string): string {
  return `<div class="section-label"><div class="num">${esc(num)}</div><div class="title">${esc(title)}</div></div>`;
}

function renderDetailedCommercialSection(
  doc: QuotationDocument,
  sectionNum: number,
  siteOrigin?: string
): string {
  return `<div class="section avoid-break page-break" id="section-commercial">
      ${sectionLabel(String(sectionNum).padStart(2, "0"), "Commercial Summary")}
      ${renderKpiGrid(doc.commercialKpis.slice(0, 3))}
      ${doc.commercialKpis.length > 3 ? renderKpiGrid(doc.commercialKpis.slice(3)) : ""}
      ${renderCreatorTables(doc, siteOrigin)}
      <div class="summary-box avoid-break">
        <table>${renderDetailedSummaryRows(doc)}</table>
      </div>
    </div>`;
}

function renderLumpSumCommercialSection(
  doc: QuotationDocument,
  sectionNum: number
): string {
  return `<div class="section avoid-break page-break" id="section-commercial">
      ${sectionLabel(String(sectionNum).padStart(2, "0"), "Commercial Summary")}
      ${renderKpiGrid(doc.commercialKpis.slice(0, 3))}
      ${doc.commercialKpis.length > 3 ? renderKpiGrid(doc.commercialKpis.slice(3)) : ""}
      <div class="summary-box avoid-break">
        <table>${renderLumpSumSummaryRows(doc)}</table>
      </div>
    </div>`;
}

function renderLumpSumCreatorsSection(
  doc: QuotationDocument,
  sectionNum: number,
  siteOrigin?: string
): string {
  return `<div class="section page-break" id="section-creators">
      ${sectionLabel(String(sectionNum).padStart(2, "0"), `Included Creators (${doc.summary.creatorCount})`)}
      ${renderLumpSumCreatorTables(doc, siteOrigin)}
    </div>`;
}

function renderVerifiedBadge(isVerified: boolean): string {
  return isVerified ? `<span class="verified-badge" title="Verified">✓</span>` : "";
}

function renderShowcaseGroupPlatforms(group: QuotationDocCreatorGroup): string {
  const platforms = new Set<string>();
  let allPlatforms = false;
  for (const row of group.rows) {
    if (row.allPlatforms) {
      allPlatforms = true;
      break;
    }
    row.platformIcons.forEach((platform) => platforms.add(platform));
  }
  if (allPlatforms) {
    return `<span class="platform-all-badge">All Platform</span>`;
  }
  if (!platforms.size && group.platform) {
    platforms.add(group.platform);
  }
  if (!platforms.size) return "—";
  const icons = [...platforms];
  return `<span class="platform-icons">${icons
    .map((platform, index) => {
      const icon = getReportPlatformIconDataUri(platform);
      const title = getReportPlatformIconTitle(platform);
      if (icon) {
        return `<img class="platform-link-icon${index > 0 ? " overlap" : ""}" src="${esc(icon)}" alt="${esc(title)}" title="${esc(title)}" />`;
      }
      return `<span class="platform-text-badge">${esc(title)}</span>`;
    })
    .join("")}</span>`;
}

function renderShowcaseCreatorKpis(group: QuotationDocCreatorGroup): string {
  const tier = group.rows[0]?.tier ?? "—";
  const categoriesLabel =
    group.categories.length > 0 ? esc(group.categories.join(", ")) : "—";
  return `<div class="showcase-kpi-row">
    <div class="showcase-kpi avoid-break"><label>Followers</label><strong>${esc(group.followers)}</strong></div>
    <div class="showcase-kpi avoid-break"><label>Engagement</label><strong>${esc(group.engagementRate)}</strong></div>
    <div class="showcase-kpi avoid-break"><label>Tier</label><strong>${renderTierBadge(tier)}</strong></div>
    <div class="showcase-kpi avoid-break"><label>Categories</label><strong>${categoriesLabel}</strong></div>
    <div class="showcase-kpi avoid-break"><label>Market</label><strong>${esc(group.country)}</strong></div>
    <div class="showcase-kpi avoid-break"><label>Platforms</label><strong>${renderShowcaseGroupPlatforms(group)}</strong></div>
  </div>`;
}

function renderShowcasePublicationGrid(
  group: QuotationDocCreatorGroup,
  siteOrigin?: string
): string {
  const shots = group.publicationShots ?? [];
  if (!shots.length) {
    return `<div class="showcase-pubs avoid-break">
      <div class="showcase-pubs-title">Recent publications</div>
      <div class="showcase-pub-empty">No publication screenshots available for this creator.</div>
    </div>`;
  }

  const cards = shots
    .map((shot) => {
      const src = resolvePublicationShotSrc(shot, siteOrigin);
      if (!src) return "";
      const playOverlay = shot.isVideo ? renderShowcasePlayOverlay() : "";
      const img = `<span class="showcase-pub-thumb-wrap"><img class="showcase-pub-thumb" src="${esc(src)}" alt="" referrerpolicy="no-referrer" />${playOverlay}</span>`;
      const linked =
        shot.postUrl && /^https?:\/\//i.test(shot.postUrl)
          ? `<a href="${esc(shot.postUrl)}" target="_blank" rel="noopener noreferrer">${img}</a>`
          : img;
      return `<div class="showcase-pub-card avoid-break">${linked}</div>`;
    })
    .filter(Boolean)
    .join("");

  return `<div class="showcase-pubs">
    <div class="showcase-pubs-title">Recent publications</div>
    <div class="showcase-pubs-grid">${cards}</div>
  </div>`;
}

function renderShowcaseDeliverableRows(
  group: QuotationDocCreatorGroup,
  doc: QuotationDocument
): string {
  return group.rows
    .map(
      (row) => `
      <tr class="avoid-break">
        <td>${esc(row.option)}</td>
        <td>${esc(row.serviceDescription)}</td>
        <td class="platform-cell">${renderPlatformIcons(row)}</td>
        <td>${esc(row.type)}</td>
        ${doc.audience === "internal" ? `<td>${esc(row.deliverables)}</td>` : ""}
      </tr>`
    )
    .join("");
}

function renderShowcaseCreatorPage(
  group: QuotationDocCreatorGroup,
  doc: QuotationDocument,
  index: number,
  total: number,
  siteOrigin?: string
): string {
  const handleBlock =
    group.handle !== "—"
      ? `<div class="showcase-handle">${esc(group.handle)}</div>`
      : "";
  const categoriesBlock = renderCreatorCategoryChips(group.categories);
  const heroContent = `${renderCreatorAvatar(group, siteOrigin, "hero")}
      <h2 class="showcase-name">${esc(group.creator)}${renderVerifiedBadge(group.isVerified)}</h2>
      ${handleBlock}${categoriesBlock}`;
  const hero = renderProfileLink(
    group.profileUrl,
    `<div class="showcase-hero">${heroContent}</div>`
  );
  const colspan = doc.audience === "internal" ? 5 : 4;
  const internalHead =
    doc.audience === "internal" ? "<th>Deliverables</th>" : "";

  return `<section class="showcase-creator-page avoid-break" id="showcase-creator-${index}">
      ${sectionLabel(String(index + 1).padStart(2, "0"), `Creator ${index + 1} of ${total}`)}
      <div class="showcase-creator-sheet avoid-break">
      ${hero}
      ${renderShowcaseCreatorKpis(group)}
      ${renderShowcasePublicationGrid(group, siteOrigin)}
      <div class="showcase-deliverables-title">Proposed deliverables</div>
      <div class="table-scroll avoid-break">
        <table class="data-table">
          <thead>
            <tr>
              <th>Option</th>
              <th>Service description</th>
              <th>Platform</th>
              <th>Type</th>
              ${internalHead}
            </tr>
          </thead>
          <tbody>
            ${
              group.rows.length
                ? renderShowcaseDeliverableRows(group, doc)
                : `<tr><td colspan="${colspan}" class="muted" style="text-align:center;padding:20px">No deliverables listed.</td></tr>`
            }
          </tbody>
        </table>
      </div>
      </div>
    </section>`;
}

function renderShowcaseCreatorPages(
  doc: QuotationDocument,
  siteOrigin?: string
): string {
  if (!doc.creatorGroups.length) {
    return `<section class="showcase-creator-page avoid-break">
      ${sectionLabel("01", "Creators")}
      <p class="report-note">No creators added yet.</p>
    </section>`;
  }
  const total = doc.creatorGroups.length;
  return doc.creatorGroups
    .map((group, index) =>
      renderShowcaseCreatorPage(group, doc, index, total, siteOrigin)
    )
    .join("");
}

function renderShowcaseRosterSection(doc: QuotationDocument): string {
  if (!doc.creatorGroups.length) return "";
  const rows = doc.creatorGroups
    .map(
      (group) => `
      <tr class="avoid-break">
        <td>${esc(group.creator)}</td>
        <td>${esc(group.handle)}</td>
        <td class="num">${esc(group.followers)}</td>
        <td class="num">${esc(group.engagementRate)}</td>
        <td>${renderTierBadge(group.rows[0]?.tier ?? "—")}</td>
        <td class="categories-cell">${renderRosterCategoriesCell(group.categories)}</td>
        <td class="platform-cell">${renderShowcaseGroupPlatforms(group)}</td>
      </tr>`
    )
    .join("");

  return `<div class="section page-break" id="section-roster">
      ${sectionLabel(String(doc.creatorGroups.length + 1).padStart(2, "0"), `Creator Roster (${doc.summary.creatorCount})`)}
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Creator</th>
              <th>Handle</th>
              <th class="num">Followers</th>
              <th class="num">ER</th>
              <th>Tier</th>
              <th>Categories</th>
              <th>Platforms</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function buildShowcaseQuotationHtml(
  doc: QuotationDocument,
  options?: BuildQuotationHtmlOptions
): string {
  const generatedLabel = doc.issueDateLabel;
  const siteOrigin = options?.siteOrigin;
  const baseTag = siteOrigin
    ? `<base href="${esc(siteOrigin.replace(/\/$/, ""))}/" />`
    : "";
  const showcaseTitle = formatShowcaseQuotationTitle(doc.name);
  const includeLumpSumTotals = doc.template === "showcase-lump-sum";
  const commercialSectionNum = doc.creatorGroups.length + 2;
  const commercialSection = includeLumpSumTotals
    ? renderLumpSumCommercialSection(doc, commercialSectionNum)
    : "";
  const footerBadge = "Creator Showcase";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
${baseTag}
<title>${esc(doc.serial)} — ${esc(showcaseTitle)} — Thinkway Showcase</title>
<style>${THINKWAY_REPORT_STYLES}${buildQuotationDocumentStyles(generatedLabel)}${CREATOR_GROUP_STYLES}${SHOWCASE_STYLES}</style>
</head>
<body class="quotation-report quotation-showcase">
  <div class="page">
    ${renderCoverPage(doc)}
    <div class="report-body">
      ${renderShowcaseCreatorPages(doc, siteOrigin)}
      ${renderShowcaseRosterSection(doc)}
      ${commercialSection}
    </div>
    <div class="screen-footer">
      <div class="left">Confidential · <strong>Thinkway Platform</strong> · Issued ${esc(doc.issueDateLabel)}</div>
      <div class="badge">${esc(doc.serial)} · ${footerBadge}</div>
    </div>
  </div>
</body>
</html>`;
}

export function buildQuotationHtml(
  doc: QuotationDocument,
  options?: BuildQuotationHtmlOptions
): string {
  if (isShowcaseTemplate(doc.template)) {
    return buildShowcaseQuotationHtml(doc, options);
  }

  const generatedLabel = doc.issueDateLabel;
  const siteOrigin = options?.siteOrigin;
  const baseTag = siteOrigin
    ? `<base href="${esc(siteOrigin.replace(/\/$/, ""))}/" />`
    : "";
  let sectionNum = 1;

  const commercialSection =
    doc.template === "lump-sum"
      ? renderLumpSumCommercialSection(doc, sectionNum++)
      : renderDetailedCommercialSection(doc, sectionNum++, siteOrigin);

  const lumpSumCreatorsSection =
    doc.template === "lump-sum"
      ? renderLumpSumCreatorsSection(doc, sectionNum++, siteOrigin)
      : "";

  const notesSection = doc.notes
    ? `<div class="section avoid-break page-break" id="section-notes">
      ${sectionLabel(String(sectionNum++).padStart(2, "0"), "Notes")}
      <p class="report-note">${esc(doc.notes)}</p>
    </div>`
    : "";

  const termsSection = `<div class="section page-break" id="section-terms">
      ${sectionLabel(String(sectionNum++).padStart(2, "0"), "Terms & Conditions")}
      <ul class="terms-list">${renderTerms(doc)}</ul>
    </div>`;

  const acceptanceSection = `<div class="section page-break avoid-break" id="section-acceptance">
      ${sectionLabel(String(sectionNum).padStart(2, "0"), "Acceptance")}
      <div class="sign-grid">
        <div class="sign-slot">
          <div class="role">Prepared By — Thinkway</div>
          <div class="hint">Name: ${esc(doc.preparedByNameSignature ?? "_________________________")}<br/>Date: ${esc(doc.issueDateLabel)}</div>
        </div>
        <div class="sign-slot">
          <div class="role">Approved By Client</div>
          <div class="hint">Name: ${esc(doc.clientSignatureName ?? "_________________________")}<br/>Date: _________________________</div>
        </div>
      </div>
      <div class="revision-foot">${esc(doc.revisionLine)}</div>
    </div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
${baseTag}
<title>${esc(doc.serial)} — ${esc(doc.name)} — Thinkway</title>
<style>${THINKWAY_REPORT_STYLES}${buildQuotationDocumentStyles(generatedLabel)}${CREATOR_GROUP_STYLES}</style>
</head>
<body class="quotation-report">
  <div class="page">
    ${renderCoverPage(doc)}
    <div class="report-body">
      ${commercialSection}
      ${notesSection}
      ${lumpSumCreatorsSection}
      ${termsSection}
      ${acceptanceSection}
    </div>
    <div class="screen-footer">
      <div class="left">Confidential · <strong>Thinkway Platform</strong> · Issued ${esc(doc.issueDateLabel)}</div>
      <div class="badge">${esc(doc.serial)} · Client Quotation</div>
    </div>
  </div>
</body>
</html>`;
}
