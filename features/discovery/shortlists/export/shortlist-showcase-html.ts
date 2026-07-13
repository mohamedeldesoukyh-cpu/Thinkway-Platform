/**
 * Showcase shortlist HTML — creator deck pages with publication shots.
 */
import { initialsFromCreatorName } from "@/lib/performance/creator-avatar";
import {
  getReportPlatformIconDataUri,
  getReportPlatformIconTitle,
} from "@/lib/performance/report/report-platform-icons";
import { renderThinkwayReportLogoHtml } from "@/lib/reports/document/thinkway-report-logo";
import { THINKWAY_REPORT_STYLES } from "@/lib/reports/document/thinkway-report-styles";
import type { CreatorTierLabel } from "@/lib/creators/creator-tier";
import {
  isAllowedPublicationPreviewSrcUrl,
} from "@/lib/creators/publication-preview-proxy";
import {
  shouldProxyPublicationMediaUrl,
} from "@/lib/creators/recent-publication-thumb";

import type {
  ShortlistDocCreatorGroup,
  ShortlistDocPublicationShot,
  ShortlistDocument,
  ShortlistPlatformLink,
} from "./shortlist-document";
import { buildShortlistDocumentStyles } from "./shortlist-document-styles";
import { resolveExportPublicationShotProxyUrl } from "./shortlist-export-publications";

export type BuildShortlistHtmlOptions = {
  siteOrigin?: string;
};

const TIER_BADGE_STYLE: Record<CreatorTierLabel, string> = {
  Celebrity: "background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);color:#92400e;",
  Mega: "background:rgba(249,115,22,.12);border:1px solid rgba(249,115,22,.35);color:#c2410c;",
  Macro: "background:rgba(0,87,255,.12);border:1px solid rgba(0,87,255,.35);color:#003db8;",
  Mid: "background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.35);color:#5b21b6;",
  Micro: "background:rgba(12,157,87,.12);border:1px solid rgba(12,157,87,.35);color:#0a7a45;",
  Nano: "background:rgba(100,116,139,.12);border:1px solid rgba(148,163,184,.35);color:#334155;",
  Unknown: "background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;",
};

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
    border: 4px solid #E8EFFE;
    box-shadow: 0 4px 24px rgba(0,87,255,.15);
    background: #E8EFFE;
  }
  .showcase-avatar--initials {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 36px;
    font-weight: 700;
    color: #0057FF;
    background: #E8EFFE;
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
    background: #0057FF;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    margin-left: 6px;
    vertical-align: middle;
    line-height: 1;
  }
  .showcase-kpi-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 20px;
  }
  .showcase-kpi {
    border: 1px solid var(--rule);
    border-radius: 6px;
    padding: 12px 10px;
    text-align: center;
    background: #F5F8FF;
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
  .showcase-context-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--muted);
    margin-bottom: 8px;
  }
  .showcase-context-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-bottom: 20px;
  }
  .showcase-context-card {
    border: 1px solid var(--rule);
    border-radius: 6px;
    padding: 10px 12px;
    background: #FAFBFF;
    break-inside: avoid;
  }
  .showcase-context-card label {
    display: block;
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--muted);
    margin-bottom: 4px;
  }
  .showcase-context-card strong {
    font-size: 12px;
    color: var(--ink);
  }
  .showcase-pubs { margin: 0 0 22px; }
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
    background: #F5F8FF;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .showcase-pub-thumb-wrap { position: relative; display: block; }
  .showcase-pub-thumb {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    background: #E8EFFE;
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
    background: rgba(6, 8, 16, 0.58);
    border: 2px solid rgba(255, 255, 255, 0.92);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 14px rgba(6, 8, 16, 0.22);
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
    background: #F5F8FF;
  }
  .category-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    margin-top: 8px;
  }
  .category-chip {
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 999px;
    background: #E8EFFE;
    color: #003db8;
    border: 1px solid rgba(0,87,255,.15);
  }
  .platform-icons {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }
  .platform-link-icon {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: block;
  }
  .platform-link-icon.overlap { margin-left: -6px; }
  .tier-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    line-height: 1.4;
  }
  @media print {
    .shortlist-showcase .report-body { padding-top: 0; }
    .showcase-kpi-row { grid-template-columns: repeat(3, 1fr); }
    .showcase-pubs-grid { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 600px) {
    .showcase-kpi-row,
    .showcase-context-grid,
    .showcase-pubs-grid { grid-template-columns: repeat(2, 1fr); }
  }
`;

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sectionLabel(num: string, title: string): string {
  return `<div class="section-label"><div class="num">${escapeHtml(num)}</div><div class="title">${escapeHtml(title)}</div></div>`;
}

function renderTierBadge(tier: string): string {
  if (!tier || tier === "—") return "—";
  const style =
    TIER_BADGE_STYLE[tier as CreatorTierLabel] ?? TIER_BADGE_STYLE.Unknown;
  return `<span class="tier-badge" style="${style}">${escapeHtml(tier)}</span>`;
}

function renderVerifiedBadge(isVerified: boolean): string {
  return isVerified ? `<span class="verified-badge" title="Verified">✓</span>` : "";
}

function renderShowcaseAvatar(group: ShortlistDocCreatorGroup): string {
  const initials = escapeHtml(initialsFromCreatorName(group.creator));
  if (group.avatarUrl) {
    return `<img class="showcase-avatar" src="${escapeHtml(group.avatarUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'showcase-avatar showcase-avatar--initials',textContent:'${initials}'}))" />`;
  }
  return `<span class="showcase-avatar showcase-avatar--initials">${initials}</span>`;
}

function renderProfileLink(href: string | null, content: string): string {
  if (!href?.startsWith("http")) return content;
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${content}</a>`;
}

function renderShowcaseGroupPlatforms(group: ShortlistDocCreatorGroup): string {
  if (!group.platformLinks.length) return "—";
  return `<span class="platform-icons">${group.platformLinks
    .map((link, index) => {
      const icon = getReportPlatformIconDataUri(link.platform);
      const title = getReportPlatformIconTitle(link.platform);
      if (icon) {
        return `<img class="platform-link-icon${index > 0 ? " overlap" : ""}" src="${escapeHtml(icon)}" alt="${escapeHtml(title)}" title="${escapeHtml(title)}" />`;
      }
      return `<span>${escapeHtml(link.label)}</span>`;
    })
    .join("")}</span>`;
}

function renderCreatorCategoryChips(categories: string[]): string {
  if (!categories.length) return "";
  const chips = categories
    .map((category) => `<span class="category-chip">${escapeHtml(category)}</span>`)
    .join("");
  return `<div class="category-chips">${chips}</div>`;
}

function resolvePublicationShotSrc(
  shot: ShortlistDocPublicationShot,
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
    if (mustProxy) return proxyUrl;
    return rawImage;
  }

  return proxyUrl;
}

function renderShowcasePlayOverlay(): string {
  return `<span class="showcase-pub-play"><span class="showcase-pub-play-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span></span>`;
}

function renderShowcasePublicationGrid(
  group: ShortlistDocCreatorGroup,
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
      const img = `<span class="showcase-pub-thumb-wrap"><img class="showcase-pub-thumb" src="${escapeHtml(src)}" alt="" referrerpolicy="no-referrer" />${playOverlay}</span>`;
      const linked =
        shot.postUrl && /^https?:\/\//i.test(shot.postUrl)
          ? `<a href="${escapeHtml(shot.postUrl)}" target="_blank" rel="noopener noreferrer">${img}</a>`
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

function renderShowcaseCreatorKpis(group: ShortlistDocCreatorGroup): string {
  const categoriesLabel =
    group.categories.length > 0 ? escapeHtml(group.categories.join(", ")) : "—";
  return `<div class="showcase-kpi-row">
    <div class="showcase-kpi avoid-break"><label>Followers</label><strong>${escapeHtml(group.followers)}</strong></div>
    <div class="showcase-kpi avoid-break"><label>Engagement</label><strong>${escapeHtml(group.engagementRate)}</strong></div>
    <div class="showcase-kpi avoid-break"><label>Tier</label><strong>${renderTierBadge(group.tier)}</strong></div>
    <div class="showcase-kpi avoid-break"><label>Categories</label><strong>${categoriesLabel}</strong></div>
    <div class="showcase-kpi avoid-break"><label>Market</label><strong>${escapeHtml(group.country)}</strong></div>
    <div class="showcase-kpi avoid-break"><label>Platforms</label><strong>${renderShowcaseGroupPlatforms(group)}</strong></div>
  </div>`;
}

function renderShowcaseContextCards(group: ShortlistDocCreatorGroup): string {
  return `<div class="showcase-context-title">Shortlist context</div>
  <div class="showcase-context-grid">
    <div class="showcase-context-card avoid-break"><label>Match score</label><strong>${escapeHtml(group.matchScore)}</strong></div>
    <div class="showcase-context-card avoid-break"><label>Brand safety</label><strong>${escapeHtml(group.brandSafety)}</strong></div>
    <div class="showcase-context-card avoid-break"><label>Review status</label><strong>${escapeHtml(group.status)}</strong></div>
    <div class="showcase-context-card avoid-break"><label>Notes</label><strong>${escapeHtml(group.notes)}</strong></div>
  </div>`;
}

function renderShowcaseCoverPage(doc: ShortlistDocument): string {
  const preparedFor =
    doc.brandName !== "—" && doc.clientName !== "—"
      ? `${doc.brandName} · ${doc.clientName}`
      : doc.brandName !== "—"
        ? doc.brandName
        : doc.clientName !== "—"
          ? doc.clientName
          : "Discovery roster";

  return `<section class="cover-page">
    <div class="cover-overlay">
      <div>
        ${renderThinkwayReportLogoHtml({ variant: "cover", theme: "dark" })}
        <div class="cover-kicker">Discovery Shortlist · Showcase</div>
        <div class="cover-accent"></div>
        <h1 class="cover-title">${escapeHtml(doc.name)}</h1>
        <p class="cover-subtitle">${escapeHtml(preparedFor)}</p>
        <div class="cover-meta">
          <div><strong>Shortlist No.:</strong> ${escapeHtml(doc.serial)}</div>
          <div><strong>Legal entity:</strong> ${escapeHtml(doc.clientName)}</div>
          <div><strong>Brand:</strong> ${escapeHtml(doc.brandName)}</div>
          <div><strong>Status:</strong> ${escapeHtml(doc.statusLabel)} · ${escapeHtml(doc.visibilityLabel)}</div>
          <div><strong>Owner:</strong> ${escapeHtml(doc.ownerName)}</div>
          <div><strong>Generated:</strong> ${escapeHtml(doc.generatedDateLabel)}</div>
        </div>
        <div class="cover-kpi-row">
          <div class="cover-kpi avoid-break"><span class="label">Creators</span><span class="value">${doc.summary.creatorCount}</span></div>
          <div class="cover-kpi avoid-break"><span class="label">Total reach</span><span class="value">${escapeHtml(doc.summary.totalFollowersLabel)}</span></div>
          <div class="cover-kpi avoid-break"><span class="label">Avg ER</span><span class="value">${escapeHtml(doc.summary.avgEngagementRateLabel)}</span></div>
          <div class="cover-kpi avoid-break"><span class="label">Countries</span><span class="value">${doc.summary.countryBreakdown.length}</span></div>
        </div>
      </div>
      <div class="cover-footer">
        <span>Confidential · Thinkway Platform</span>
        <span>Generated ${escapeHtml(doc.generatedDateLabel)}</span>
      </div>
    </div>
  </section>`;
}

function renderShowcaseCreatorPage(
  group: ShortlistDocCreatorGroup,
  index: number,
  total: number,
  siteOrigin?: string
): string {
  const handleBlock =
    group.handle !== "—"
      ? `<div class="showcase-handle">${escapeHtml(group.handle)}</div>`
      : "";
  const heroContent = `${renderShowcaseAvatar(group)}
      <h2 class="showcase-name">${escapeHtml(group.creator)}${renderVerifiedBadge(group.isVerified)}</h2>
      ${handleBlock}${renderCreatorCategoryChips(group.categories)}`;
  const hero = renderProfileLink(
    group.profileUrl,
    `<div class="showcase-hero">${heroContent}</div>`
  );

  return `<section class="showcase-creator-page avoid-break" id="showcase-creator-${index}">
      ${sectionLabel(String(index + 2).padStart(2, "0"), `Creator ${index + 1} of ${total}`)}
      <div class="showcase-creator-sheet avoid-break">
      ${hero}
      ${renderShowcaseCreatorKpis(group)}
      ${renderShowcasePublicationGrid(group, siteOrigin)}
      ${renderShowcaseContextCards(group)}
      </div>
    </section>`;
}

function renderShowcaseCreatorPages(doc: ShortlistDocument, siteOrigin?: string): string {
  if (!doc.creatorGroups.length) {
    return `<section class="showcase-creator-page avoid-break">
      ${sectionLabel("02", "Creators")}
      <p class="report-note">No creators on this shortlist yet.</p>
    </section>`;
  }
  const total = doc.creatorGroups.length;
  return doc.creatorGroups
    .map((group, index) => renderShowcaseCreatorPage(group, index, total, siteOrigin))
    .join("");
}

function renderShowcaseRosterSection(doc: ShortlistDocument): string {
  if (!doc.creatorGroups.length) return "";
  const rows = doc.creatorGroups
    .map(
      (group) => `
      <tr class="avoid-break">
        <td>${escapeHtml(group.creator)}</td>
        <td>${escapeHtml(group.handle)}</td>
        <td class="num">${escapeHtml(group.followers)}</td>
        <td class="num">${escapeHtml(group.engagementRate)}</td>
        <td>${renderTierBadge(group.tier)}</td>
        <td>${escapeHtml(group.categories.join(", ") || "—")}</td>
        <td>${escapeHtml(group.matchScore)}</td>
      </tr>`
    )
    .join("");

  return `<div class="section page-break" id="section-roster">
      ${sectionLabel(String(doc.creatorGroups.length + 2).padStart(2, "0"), `Creator Roster (${doc.summary.creatorCount})`)}
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
              <th class="num">Match</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function renderShowcaseClosingPage(doc: ShortlistDocument): string {
  const clientLine =
    doc.clientName !== "—" || doc.brandName !== "—"
      ? `Prepared for ${doc.brandName !== "—" ? doc.brandName : doc.clientName}${doc.clientName !== "—" && doc.brandName !== "—" ? ` (${doc.clientName})` : ""}.`
      : "Prepared for your review.";

  return `<section class="closing-page">
    <div class="closing-overlay">
      <div>
        ${renderThinkwayReportLogoHtml({ variant: "closing", theme: "dark" })}
        <h2 class="closing-title">Thank you</h2>
        <div class="closing-copy">
          <p>${escapeHtml(clientLine)}</p>
          <p>This showcase shortlist report (${escapeHtml(doc.serial)}) is confidential and intended solely for authorized Thinkway stakeholders and the named client.</p>
          <p>Creator metrics reflect data available at generation time and may change as profiles are refreshed in Discovery.</p>
        </div>
        <div class="closing-contact">
          <div>Thinkway · Influencer Marketing Agency</div>
          <div>Hello@thinkwaymedia.com</div>
          <div>Account owner: ${escapeHtml(doc.ownerName)}</div>
        </div>
      </div>
      <div class="closing-footer">
        <span>${escapeHtml(doc.serial)} · Creator Showcase</span>
        <span>Generated ${escapeHtml(doc.generatedDateLabel)}</span>
      </div>
    </div>
  </section>`;
}

function renderCategorySummarySection(doc: ShortlistDocument): string {
  const topCategories = doc.summary.categoryBreakdown
    .slice(0, 5)
    .map((item) => `${item.label} (${item.count})`)
    .join(", ");

  return `<div class="section avoid-break" id="section-overview">
    ${sectionLabel("01", "Roster Overview")}
    <p class="report-note">Client-facing creator showcase — metrics, tiers, and recent publications without commercial pricing.</p>
    <div class="analysis-box avoid-break">
      <h4>Category focus</h4>
      <p>${escapeHtml(topCategories || "No category breakdown available yet.")}</p>
    </div>
  </div>`;
}

export function buildShowcaseShortlistHtml(
  doc: ShortlistDocument,
  options?: BuildShortlistHtmlOptions
): string {
  const siteOrigin = options?.siteOrigin;
  const baseTag = siteOrigin
    ? `<base href="${escapeHtml(siteOrigin.replace(/\/$/, ""))}/" />`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${baseTag}
<title>${escapeHtml(doc.serial)} — ${escapeHtml(doc.name)} — Thinkway Showcase</title>
<style>${THINKWAY_REPORT_STYLES}${buildShortlistDocumentStyles(doc.generatedDateLabel)}${SHOWCASE_STYLES}</style>
</head>
<body class="shortlist-report shortlist-showcase">
<div class="page">
  ${renderShowcaseCoverPage(doc)}
  <div class="report-body">
    ${renderCategorySummarySection(doc)}
    ${renderShowcaseCreatorPages(doc, siteOrigin)}
    ${renderShowcaseRosterSection(doc)}
  </div>
  ${renderShowcaseClosingPage(doc)}
  <div class="screen-footer">
    <div class="left">Confidential · <strong>Thinkway Platform</strong> · Generated ${escapeHtml(doc.generatedDateLabel)}</div>
    <div class="badge">${escapeHtml(doc.serial)} · Creator Showcase</div>
  </div>
</div>
</body>
</html>`;
}
