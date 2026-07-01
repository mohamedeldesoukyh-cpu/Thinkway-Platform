/**
 * Enterprise shortlist HTML — cover, executive summary, roster, totals, closing.
 * Preview / Word / PDF share this renderer (puppeteer via vendor-io-pdf).
 */
import { renderThinkwayReportLogoHtml } from "@/lib/reports/document/thinkway-report-logo";
import { THINKWAY_REPORT_STYLES } from "@/lib/reports/document/thinkway-report-styles";
import { initialsFromCreatorName } from "@/lib/performance/creator-avatar";
import {
  getReportPlatformIconDataUri,
  getReportPlatformIconTitle,
} from "@/lib/performance/report/report-platform-icons";

import type {
  ShortlistDocRow,
  ShortlistDocument,
  ShortlistPlatformLink,
  ShortlistSummaryBreakdownItem,
} from "./shortlist-document";
import { buildShortlistDocumentStyles } from "./shortlist-document-styles";

const CREATOR_CELL_STYLES = `
  .creator-cell { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .creator-cell-avatar {
    width: 32px; height: 32px; flex-shrink: 0; border-radius: 50%;
    object-fit: cover; display: block; background: #EEF4FF;
  }
  .creator-cell-avatar--initials {
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: #1D9E75;
  }
  .creator-cell-text { min-width: 0; }
  .platform-links { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .platform-link { display: inline-flex; align-items: center; text-decoration: none; line-height: 0; }
  .platform-link:hover { opacity: 0.85; }
  .platform-link-icon { width: 22px; height: 22px; border-radius: 50%; display: block; }
  .platform-link-badge {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 28px; height: 22px; padding: 0 6px; border-radius: 999px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.02em;
  }
`;

const PLATFORM_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  instagram: { label: "IG", bg: "#FDF2F8", color: "#BE185D" },
  tiktok: { label: "TT", bg: "#F3F4F6", color: "#111827" },
  youtube: { label: "YT", bg: "#FEF2F2", color: "#B91C1C" },
  snapchat: { label: "SC", bg: "#FEFCE8", color: "#A16207" },
  twitter: { label: "X", bg: "#F3F4F6", color: "#111827" },
  x: { label: "X", bg: "#F3F4F6", color: "#111827" },
  facebook: { label: "FB", bg: "#EFF6FF", color: "#1D4ED8" },
  linkedin: { label: "IN", bg: "#EFF6FF", color: "#1D4ED8" },
};

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

function renderExternalLink(
  href: string,
  content: string,
  className: string
): string {
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="${className}">${content}</a>`;
}

function renderCreatorAvatar(row: ShortlistDocRow): string {
  const initials = escapeHtml(initialsFromCreatorName(row.creator));
  if (row.avatarUrl) {
    return `<img class="creator-cell-avatar" src="${escapeHtml(row.avatarUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'creator-cell-avatar creator-cell-avatar--initials',textContent:'${initials}'}))" />`;
  }
  return `<span class="creator-cell-avatar creator-cell-avatar--initials">${initials}</span>`;
}

function renderCreatorCell(row: ShortlistDocRow): string {
  const nameNode = escapeHtml(row.creator);
  const handleBlock =
    row.handle !== "—"
      ? `<div class="muted" style="font-size:11px;margin-top:2px">${escapeHtml(row.handle)}</div>`
      : "";

  return `<div class="creator-cell">${renderCreatorAvatar(row)}<div class="creator-cell-text"><div>${nameNode}</div>${handleBlock}</div></div>`;
}

function renderPlatformLinkContent(link: ShortlistPlatformLink): string {
  const iconDataUri = getReportPlatformIconDataUri(link.platform);
  if (iconDataUri) {
    const title = getReportPlatformIconTitle(link.platform);
    return `<img class="platform-link-icon" src="${escapeHtml(iconDataUri)}" alt="${escapeHtml(title)}" title="${escapeHtml(title)}" />`;
  }

  const key = link.platform.toLowerCase();
  const badge = PLATFORM_BADGE[key] ?? {
    label: link.label.slice(0, 2).toUpperCase(),
    bg: "#F3F4F6",
    color: "#6B7280",
  };
  return `<span class="platform-link-badge" style="background:${badge.bg};color:${badge.color}">${escapeHtml(badge.label)}</span>`;
}

function renderPlatformCell(row: ShortlistDocRow): string {
  if (row.platformLinks.length === 0) {
    return escapeHtml(row.platform);
  }

  const links = row.platformLinks
    .map((link) => renderExternalLink(link.url, renderPlatformLinkContent(link), "platform-link"))
    .join("");

  return `<div class="platform-links">${links}</div>`;
}

function renderBreakdownList(items: ShortlistSummaryBreakdownItem[]): string {
  if (items.length === 0) {
    return `<li><span>—</span><span class="count">0</span></li>`;
  }
  return items
    .map(
      (item) =>
        `<li><span>${escapeHtml(item.label)}</span><span class="count">${item.count}</span></li>`
    )
    .join("");
}

function renderBreakdownCard(title: string, items: ShortlistSummaryBreakdownItem[]): string {
  return `<div class="breakdown-card avoid-break">
    <h4>${escapeHtml(title)}</h4>
    <ul class="breakdown-list">${renderBreakdownList(items)}</ul>
  </div>`;
}

function renderKpiGrid(doc: ShortlistDocument): string {
  const s = doc.summary;
  const topPlatform = s.platformBreakdown[0]?.label ?? "—";
  const countryCount = s.countryBreakdown.length;
  const kpis = [
    { label: "Creators", value: String(s.creatorCount) },
    { label: "Total reach", value: s.totalFollowersLabel },
    { label: "Avg engagement", value: s.avgEngagementRateLabel },
    { label: "Top platform", value: topPlatform },
    { label: "Countries", value: String(countryCount) },
    {
      label: "Top category",
      value: s.categoryBreakdown[0]?.label ?? "—",
    },
  ];

  if (doc.template === "detailed") {
    kpis.push({ label: "Avg match score", value: s.avgMatchScoreLabel });
  }

  return `<div class="kpi-grid">${kpis
    .map(
      (kpi) =>
        `<div class="kpi-card avoid-break"><label>${escapeHtml(kpi.label)}</label><strong>${escapeHtml(kpi.value)}</strong></div>`
    )
    .join("")}</div>`;
}

function buildExecutiveNarrative(doc: ShortlistDocument): string {
  const s = doc.summary;
  if (s.creatorCount === 0) {
    return "This shortlist does not contain any creators yet. Add creators in Discovery to populate roster metrics and analysis.";
  }

  const parts: string[] = [];
  parts.push(
    `This shortlist presents ${s.creatorCount} creator${s.creatorCount === 1 ? "" : "s"} with a combined reach of ${s.totalFollowersLabel} followers.`
  );

  if (s.avgEngagementRate != null) {
    parts.push(`Average engagement rate across the roster is ${s.avgEngagementRateLabel}.`);
  }

  if (s.countryBreakdown.length > 0) {
    const topCountries = s.countryBreakdown
      .slice(0, 3)
      .map((item) => `${item.label} (${item.count})`)
      .join(", ");
    parts.push(`Primary audience geographies: ${topCountries}.`);
  }

  if (s.platformBreakdown.length > 0) {
    const topPlatforms = s.platformBreakdown
      .slice(0, 3)
      .map((item) => `${item.label} (${item.count})`)
      .join(", ");
    parts.push(`Platform distribution: ${topPlatforms}.`);
  }

  if (s.categoryBreakdown.length > 0) {
    const topCategories = s.categoryBreakdown
      .slice(0, 3)
      .map((item) => item.label)
      .join(", ");
    parts.push(`Dominant content categories include ${topCategories}.`);
  }

  if (doc.template === "detailed" && s.avgMatchScore != null) {
    parts.push(`Average Thinkway match score for this roster is ${s.avgMatchScoreLabel}.`);
  }

  return parts.join(" ");
}

function renderCoverPage(doc: ShortlistDocument): string {
  const templateLabel = doc.template === "detailed" ? "Detailed" : "Summary";
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
        <div class="cover-kicker">Discovery Shortlist · ${escapeHtml(templateLabel)}</div>
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

function renderExecutiveSummarySection(doc: ShortlistDocument): string {
  const note =
    doc.template === "summary"
      ? "Client-facing creator summary without internal review fields."
      : "Internal roster including review status, notes, and match scores.";

  const detailedBreakdown =
    doc.template === "detailed"
      ? `${renderBreakdownCard("Brand safety", doc.summary.brandSafetyBreakdown)}${renderBreakdownCard("Review status", doc.summary.statusBreakdown)}`
      : "";

  return `<div class="section page-break avoid-break" id="section-summary">
    ${sectionLabel("01", "Executive Summary")}
    <p class="report-note">${escapeHtml(note)}</p>
    ${renderKpiGrid(doc)}
    <div class="analysis-box avoid-break">
      <h4>Summary analysis</h4>
      <p>${escapeHtml(buildExecutiveNarrative(doc))}</p>
    </div>
    <div class="breakdown-grid">
      ${renderBreakdownCard("Platforms", doc.summary.platformBreakdown)}
      ${renderBreakdownCard("Countries", doc.summary.countryBreakdown)}
      ${renderBreakdownCard("Categories", doc.summary.categoryBreakdown)}
      ${detailedBreakdown}
    </div>
  </div>`;
}

function renderSummaryTable(doc: ShortlistDocument): string {
  const bodyRows = doc.rows
    .map(
      (row) => `
      <tr class="avoid-break">
        <td class="num">${row.rank}</td>
        <td>${renderCreatorCell(row)}</td>
        <td>${renderPlatformCell(row)}</td>
        <td class="num">${escapeHtml(row.followers)}</td>
        <td class="num">${escapeHtml(row.engagementRate)}</td>
        <td>${escapeHtml(row.country)}</td>
      </tr>`
    )
    .join("");

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Creator</th>
          <th>Platform</th>
          <th class="num">Followers</th>
          <th class="num">Avg ER</th>
          <th>Country</th>
        </tr>
      </thead>
      <tbody>${bodyRows || `<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">No creators on this shortlist.</td></tr>`}</tbody>
    </table>`;
}

function renderDetailedTable(doc: ShortlistDocument): string {
  const bodyRows = doc.rows
    .map(
      (row) => `
      <tr class="avoid-break">
        <td class="num">${row.rank}</td>
        <td>${renderCreatorCell(row)}</td>
        <td>${renderPlatformCell(row)}</td>
        <td class="num">${escapeHtml(row.followers)}</td>
        <td class="num">${escapeHtml(row.engagementRate)}</td>
        <td>${escapeHtml(row.country)}</td>
        <td>${escapeHtml(row.interests)}</td>
        <td>${escapeHtml(row.brandSafety)}</td>
        <td>${escapeHtml(row.status)}</td>
        <td>${escapeHtml(row.notes)}</td>
        <td class="num">${escapeHtml(row.matchScore)}</td>
      </tr>`
    )
    .join("");

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Creator</th>
          <th>Platform</th>
          <th class="num">Followers</th>
          <th class="num">Avg ER</th>
          <th>Country</th>
          <th>Audience interests</th>
          <th>Brand safety</th>
          <th>Status</th>
          <th>Notes</th>
          <th class="num">Match</th>
        </tr>
      </thead>
      <tbody>${bodyRows || `<tr><td colspan="11" class="muted" style="text-align:center;padding:24px">No creators on this shortlist.</td></tr>`}</tbody>
    </table>`;
}

function renderRosterSection(doc: ShortlistDocument): string {
  const templateLabel = doc.template === "detailed" ? "Detailed roster" : "Summary roster";
  const tableHtml =
    doc.template === "detailed" ? renderDetailedTable(doc) : renderSummaryTable(doc);

  return `<div class="section page-break" id="section-roster">
    ${sectionLabel("02", templateLabel)}
    <div class="table-scroll">${tableHtml}</div>
  </div>`;
}

function renderTotalsSection(doc: ShortlistDocument): string {
  const s = doc.summary;
  const topPlatform = s.platformBreakdown[0];
  const topCountry = s.countryBreakdown[0];
  const topCategory = s.categoryBreakdown[0];

  const detailedRows =
    doc.template === "detailed"
      ? `<tr><td>Avg match score</td><td class="num">${escapeHtml(s.avgMatchScoreLabel)}</td></tr>`
      : "";

  return `<div class="section page-break avoid-break" id="section-totals">
    ${sectionLabel("03", "Totals & Aggregates")}
    <div class="summary-box avoid-break">
      <table>
        <tr><td>Total creators</td><td class="num">${s.creatorCount}</td></tr>
        <tr><td>Combined followers</td><td class="num">${escapeHtml(s.totalFollowersLabel)}</td></tr>
        <tr><td>Average engagement rate</td><td class="num">${escapeHtml(s.avgEngagementRateLabel)}</td></tr>
        <tr><td>Leading platform</td><td class="num">${escapeHtml(topPlatform ? `${topPlatform.label} (${topPlatform.count})` : "—")}</td></tr>
        <tr><td>Leading country</td><td class="num">${escapeHtml(topCountry ? `${topCountry.label} (${topCountry.count})` : "—")}</td></tr>
        <tr><td>Leading category</td><td class="num">${escapeHtml(topCategory ? `${topCategory.label} (${topCategory.count})` : "—")}</td></tr>
        ${detailedRows}
        <tr class="total"><td>Roster total</td><td class="num">${s.creatorCount} creator${s.creatorCount === 1 ? "" : "s"}</td></tr>
      </table>
    </div>
  </div>`;
}

function renderClosingPage(doc: ShortlistDocument): string {
  const templateLabel = doc.template === "detailed" ? "Detailed" : "Summary";
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
          <p>This ${escapeHtml(templateLabel.toLowerCase())} shortlist report (${escapeHtml(doc.serial)}) is confidential and intended solely for authorized Thinkway stakeholders and the named client.</p>
          <p>Creator metrics reflect data available at generation time and may change as profiles are refreshed in Discovery.</p>
        </div>
        <div class="closing-contact">
          <div>Thinkway · Influencer Marketing Agency</div>
          <div>Hello@thinkwaymedia.com</div>
          <div>Account owner: ${escapeHtml(doc.ownerName)}</div>
        </div>
      </div>
      <div class="closing-footer">
        <span>${escapeHtml(doc.serial)} · ${escapeHtml(templateLabel)} Shortlist</span>
        <span>Generated ${escapeHtml(doc.generatedDateLabel)}</span>
      </div>
    </div>
  </section>`;
}

export function buildShortlistHtml(doc: ShortlistDocument): string {
  const templateLabel = doc.template === "detailed" ? "Detailed" : "Summary";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(doc.serial)} — ${escapeHtml(doc.name)} — Thinkway</title>
<style>${THINKWAY_REPORT_STYLES}${buildShortlistDocumentStyles(doc.generatedDateLabel)}${CREATOR_CELL_STYLES}</style>
</head>
<body class="shortlist-report">
<div class="page">
  ${renderCoverPage(doc)}
  <div class="report-body">
    ${renderExecutiveSummarySection(doc)}
    ${renderRosterSection(doc)}
    ${renderTotalsSection(doc)}
  </div>
  ${renderClosingPage(doc)}
  <div class="screen-footer">
    <div class="left">Confidential · <strong>Thinkway Platform</strong> · Generated ${escapeHtml(doc.generatedDateLabel)}</div>
    <div class="badge">${escapeHtml(doc.serial)} · ${escapeHtml(templateLabel)} Shortlist</div>
  </div>
</div>
</body>
</html>`;
}
