import type { CampaignPublicationRow } from "@/lib/domains/campaign/types";
import {
  formatCompactCount,
  formatMoneyValue,
  formatPercent,
} from "@/lib/campaigns/performance-calculations";
import { resolvePublicationContentPreviewUrl } from "@/lib/performance/publication-preview";
import {
  initialsFromCreatorName,
  resolveCreatorAvatarDisplay,
} from "@/lib/performance/creator-avatar";
import { formatDateRange } from "@/lib/performance/report/performance-report-document-data";
import type {
  InfluencerReportSection,
  PerformanceReportDocumentData,
} from "@/lib/performance/report/performance-report-types";
import {
  getReportPlatformIconDataUri,
  getReportPlatformIconTitle,
} from "@/lib/performance/report/report-platform-icons";
import { buildOptionalCostMetricKpiRows } from "@/lib/performance/report/performance-report-cost-metrics";
import {
  REACH_FORECAST_DISCLAIMER,
  REACH_SOURCE_LABELS,
  type ReachSource,
} from "@/lib/performance/reach-forecast-engine";
import {
  IMPRESSIONS_FORECAST_DISCLAIMER,
  IMPRESSIONS_SOURCE_LABELS,
  type ImpressionsSource,
} from "@/lib/performance/impressions-forecast-engine";
import { buildQrCodeImageUrl } from "@/lib/performance/report/qr-code";
import {
  renderThinkwayReportLogoHtml,
  THINKWAY_REPORT_LOGO_STYLES,
} from "@/lib/reports/document/thinkway-report-logo";
import { THINKWAY_REPORT_STYLES } from "@/lib/reports/document/thinkway-report-styles";
import {
  partitionPublicationsByValueScope,
  resolvePublicationValueScope,
} from "@/lib/performance/publication-value-scope";

/** IO-aligned document palette (Client/Vendor IO / Invoice). */
const PALETTE = {
  primary: "#020B26",
  secondary: "#0B1E59",
  accent: "#1E5EFF",
  text: "#FFFFFF",
  card: "#F8FAFC",
  ink: "#1A1F36",
  muted: "#6B7280",
  rule: "#E2E8F0",
} as const;

const PLATFORM_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  instagram: { label: "IG", bg: "#FDF2F8", color: "#BE185D" },
  tiktok: { label: "TT", bg: "#F3F4F6", color: "#111827" },
  youtube: { label: "YT", bg: "#FEF2F2", color: "#B91C1C" },
  snapchat: { label: "SC", bg: "#FEFCE8", color: "#A16207" },
  twitter: { label: "X", bg: "#F3F4F6", color: "#111827" },
  x: { label: "X", bg: "#F3F4F6", color: "#111827" },
  facebook: { label: "FB", bg: "#EFF6FF", color: "#1D4ED8" },
};

function buildPerformanceReportStyles(generatedLabel: string): string {
  const footerText = `Confidential · Thinkway Platform · Generated ${generatedLabel}`;
  return `
  @page {
    size: A4 portrait;
    margin: 14mm 12mm 18mm 12mm;
    @bottom-left {
      content: "${footerText}";
      font-family: 'Inter', sans-serif;
      font-size: 7.5pt;
      color: ${PALETTE.muted};
      vertical-align: top;
    }
    @bottom-right {
      content: "Page " counter(page);
      font-family: 'Inter', sans-serif;
      font-size: 7.5pt;
      font-weight: 600;
      color: ${PALETTE.ink};
      vertical-align: top;
    }
  }
  @page :first { margin: 0; @bottom-left { content: none; } @bottom-right { content: none; } }
  @page closing { margin: 0; @bottom-left { content: none; } @bottom-right { content: none; } }

  body.perf-report { font-size: 12px; background: #fff; }
  body.perf-report .page { max-width: 210mm; margin: 0 auto; box-shadow: none; border-radius: 0; }

  .cover-page {
    min-height: 297mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 0;
    background: ${PALETTE.primary};
    color: ${PALETTE.text};
    page-break-after: always;
    break-after: page;
    position: relative;
    overflow: hidden;
  }
  .cover-hero {
    position: absolute;
    inset: 0;
    opacity: 0.22;
    object-fit: cover;
    width: 100%;
    height: 100%;
    z-index: 0;
  }
  .cover-overlay {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 36px 40px 32px;
    background: linear-gradient(180deg, rgba(2,11,38,.72) 0%, rgba(2,11,38,.92) 55%, ${PALETTE.primary} 100%);
  }
  ${THINKWAY_REPORT_LOGO_STYLES}
  .cover-kicker { font-size: 10px; letter-spacing: 2.2px; text-transform: uppercase; color: #8899BB; margin-top: 6px; }
  .cover-title { font-size: 26px; font-weight: 700; line-height: 1.15; margin: 24px 0 10px; max-width: 88%; }
  .cover-meta { font-size: 12px; color: #C8D6F5; line-height: 1.65; display: grid; gap: 2px; }
  .cover-meta strong { color: #fff; font-weight: 600; }
  .cover-accent { width: 48px; height: 3px; background: ${PALETTE.accent}; border-radius: 2px; margin: 18px 0 14px; }
  .cover-footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid rgba(255,255,255,.12); padding-top: 16px; font-size: 10px; color: #8899BB; }
  .cover-side { display: flex; gap: 20px; align-items: flex-end; margin-top: 20px; flex-wrap: wrap; }
  .cover-qr { background: #fff; padding: 8px; border-radius: 8px; }
  .cover-qr img { display: block; width: 88px; height: 88px; }
  .cover-qr-label { font-size: 9px; color: #8899BB; margin-top: 6px; text-align: center; }
  .cover-platforms { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px; }
  .cover-brand-logo { max-height: 48px; max-width: 140px; object-fit: contain; margin-bottom: 12px; }

  .toc-page { padding: 28px 32px 20px; page-break-after: always; break-after: page; }
  .toc-page .toc-heading { font-size: 18px; font-weight: 700; color: var(--ink); margin-bottom: 4px; }
  .toc-page .toc-sub { font-size: 11px; color: var(--muted); margin-bottom: 18px; }
  .toc-list { list-style: none; }
  .toc-item { display: flex; align-items: baseline; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--rule); font-size: 12px; break-inside: avoid; }
  .toc-item:last-child { border-bottom: none; }
  .toc-item a { color: var(--ink); text-decoration: none; font-weight: 500; flex: 1; }
  .toc-item .toc-num { font-size: 10px; font-weight: 700; color: ${PALETTE.accent}; width: 18px; flex-shrink: 0; }
  .toc-item.toc-subitem { padding-left: 26px; font-size: 11px; }

  .report-body { padding: 24px 32px 16px; }
  .report-body .section { margin-bottom: 22px; }
  .report-body .section--compact { break-inside: avoid; page-break-inside: avoid; }
  .report-body .section-label { break-after: avoid; margin-bottom: 10px; }
  .report-body .section-label .num { background: ${PALETTE.secondary}; }
  .report-body .section-label .title { font-size: 11px; color: var(--ink); letter-spacing: 1px; }

  .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 14px; }
  .kpi-card { border: 1px solid var(--rule); border-radius: 6px; padding: 10px 12px; background: ${PALETTE.card}; min-height: 58px; display: flex; flex-direction: column; justify-content: center; }
  .kpi-card label { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.7px; color: var(--muted); margin-bottom: 4px; }
  .kpi-card strong { font-size: 16px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
  .kpi-card--added { border-color: #1D9E75; background: #F0FDF4; }
  .kpi-card--added label { color: #047857; }

  .highlights-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 14px; }
  .highlight-card { background: ${PALETTE.card}; border: 1px solid var(--rule); border-radius: 6px; padding: 12px 14px; }
  .highlight-card label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.7px; color: var(--muted); display: block; margin-bottom: 4px; }
  .highlight-card strong { font-size: 14px; color: var(--ink); display: block; }
  .highlight-card span { font-size: 10px; color: var(--muted); }

  .insights-list { margin: 0; padding-left: 18px; font-size: 11px; line-height: 1.6; color: var(--ink); }
  .insights-list li { margin-bottom: 6px; }

  .benchmark-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
  .benchmark-table th, .benchmark-table td { padding: 8px 10px; border-bottom: 1px solid var(--rule); text-align: left; }
  .benchmark-table th { background: ${PALETTE.secondary}; color: #fff; font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; }
  .benchmark-table td.num { text-align: right; font-variant-numeric: tabular-nums; }

  .chart-block { break-inside: avoid; page-break-inside: avoid; margin-bottom: 14px; }
  .chart-subheading { font-size: 10px; font-weight: 700; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.9px; color: var(--muted); }
  .bar-chart { margin: 0 0 10px; }
  .bar-row { display: grid; grid-template-columns: 108px 1fr 56px; gap: 8px; align-items: center; margin-bottom: 5px; }
  .bar-label { font-size: 10px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar-track { height: 8px; background: #EEF4FF; border-radius: 999px; overflow: hidden; }
  .bar-fill { height: 100%; background: ${PALETTE.accent}; border-radius: 999px; }

  .pub-grid { display: grid; grid-template-columns: 1fr; gap: 14px; align-items: stretch; }
  .pub-grid--gallery { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .pub-card { border: 1px solid var(--rule); border-radius: 6px; overflow: hidden; background: #fff; display: flex; flex-direction: column; break-inside: avoid; page-break-inside: avoid; }
  .pub-card--full .pub-preview { aspect-ratio: 16 / 7; }
  .pub-scope-badge { display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 999px; font-size: 8px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; background: #ECFDF3; color: #047857; vertical-align: middle; }
  .pub-preview { width: 100%; aspect-ratio: 16 / 9; background: #F3F4F6; overflow: hidden; }
  .pub-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pub-body { padding: 12px 14px 14px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
  .pub-creator { font-size: 12px; font-weight: 700; color: var(--ink); }
  .pub-creator-inner { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
  .creator-avatar-inline { width: 28px; height: 28px; flex-shrink: 0; border-radius: 50%; object-fit: cover; display: block; }
  .creator-avatar-inline--platform { border-radius: 0; object-fit: contain; }
  .creator-avatar-inline--initials { display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 10px; font-weight: 700; }
  .pub-meta { font-size: 9px; color: var(--muted); line-height: 1.4; }
  .pub-caption { font-size: 10px; color: var(--ink); line-height: 1.5; margin: 4px 0; }
  .pub-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 9px; margin-top: auto; }
  .pub-metrics span { display: block; color: var(--muted); text-transform: uppercase; letter-spacing: 0.4px; font-size: 8px; }
  .pub-metrics strong { font-size: 11px; color: var(--ink); font-variant-numeric: tabular-nums; }

  .platform-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 18px; padding: 0 5px; border-radius: 4px; font-size: 9px; font-weight: 700; }
  .platform-icon { display: block; width: 28px; height: 28px; object-fit: contain; }
  .cover-platforms .platform-icon { width: 32px; height: 32px; }

  .influencer-section { break-before: page; page-break-before: always; padding-top: 4px; }
  .influencer-cover {
    background: linear-gradient(135deg, ${PALETTE.primary} 0%, ${PALETTE.secondary} 100%);
    color: #fff;
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 18px;
    break-inside: avoid;
  }
  .influencer-cover-inner { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
  .influencer-avatar { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; background: rgba(255,255,255,.15); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 22px; flex-shrink: 0; border: 3px solid rgba(255,255,255,.25); }
  .influencer-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
  .influencer-name { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
  .influencer-handles { font-size: 10px; color: #C8D6F5; margin: 0 0 6px; }
  .influencer-role { font-size: 10px; color: #8899BB; text-transform: uppercase; letter-spacing: 1px; }
  .influencer-kpi-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-top: 16px; }
  .influencer-kpi { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); border-radius: 6px; padding: 10px; text-align: center; }
  .influencer-kpi label { display: block; font-size: 8px; text-transform: uppercase; letter-spacing: 0.6px; color: #8899BB; margin-bottom: 4px; }
  .influencer-kpi strong { font-size: 15px; font-weight: 700; color: #fff; }

  .audience-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
  .audience-card { background: ${PALETTE.card}; border: 1px solid var(--rule); border-radius: 6px; padding: 10px 12px; font-size: 11px; }
  .audience-card label { font-size: 9px; text-transform: uppercase; color: var(--muted); display: block; margin-bottom: 4px; }

  .closing-page {
    min-height: 297mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    background: ${PALETTE.primary};
    color: ${PALETTE.text};
    page: closing;
    page-break-before: always;
    break-before: page;
    padding: 48px 32px;
  }
  .closing-title { font-size: 28px; font-weight: 700; letter-spacing: 4px; margin-bottom: 16px; }
  .closing-text { font-size: 14px; color: #C8D6F5; margin-bottom: 24px; max-width: 420px; line-height: 1.6; }
  .closing-contact { font-size: 12px; color: #8899BB; line-height: 1.8; }
  .closing-contact a { color: ${PALETTE.accent}; text-decoration: none; }
  .closing-footer { margin-top: auto; padding-top: 32px; font-size: 10px; color: #8899BB; letter-spacing: 0.5px; }

  .added-value-separator-page {
    min-height: 297mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    background: linear-gradient(160deg, #042f1e 0%, #0b3d2c 45%, ${PALETTE.primary} 100%);
    color: ${PALETTE.text};
    page-break-before: always;
    break-before: page;
    page-break-after: always;
    break-after: page;
    padding: 48px 32px;
    margin: 0 -32px 22px;
    width: calc(100% + 64px);
    box-sizing: border-box;
  }
  .added-value-separator-kicker {
    font-size: 11px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #86efac;
    margin-bottom: 18px;
  }
  .added-value-separator-title {
    font-size: 42px;
    font-weight: 700;
    letter-spacing: 2px;
    margin: 0 0 14px;
  }
  .added-value-separator-text {
    font-size: 13px;
    color: #bbf7d0;
    max-width: 420px;
    line-height: 1.6;
    margin: 0;
  }
  .added-value-separator-count {
    margin-top: 22px;
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    letter-spacing: 0.4px;
  }

  .screen-footer { display: none; }
  @media screen {
    body.perf-report { background: var(--bg); }
    body.perf-report .page { margin: 24px auto; box-shadow: 0 1px 3px rgba(0,0,0,.07), 0 8px 32px rgba(0,0,0,.05); border-radius: 8px; overflow: hidden; }
    .screen-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; background: var(--bg); border-top: 1px solid var(--rule); padding: 12px 32px; font-size: 10px; color: var(--muted); }
    .screen-footer .badge { color: ${PALETTE.accent}; font-weight: 600; }
    .toc-item a::after { content: none; }
    .added-value-separator-page { min-height: 70vh; border-radius: 0; }
  }
  @media print {
    body.perf-report { background: white; }
    body.perf-report .page { margin: 0; max-width: none; }
    .cover-page { min-height: 100vh; }
    .added-value-separator-page {
      min-height: 100vh;
      margin: 0;
      width: 100%;
    }
    .report-body { padding: 20px 0 8px; }
    .pub-grid--gallery { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .kpi-grid { grid-template-columns: repeat(5, 1fr); }
    .influencer-kpi-row { grid-template-columns: repeat(6, 1fr); }
  }
  @media (max-width: 600px) {
    .kpi-grid, .influencer-kpi-row { grid-template-columns: repeat(2, 1fr); }
    .highlights-grid, .pub-grid--gallery { grid-template-columns: 1fr; }
    .bar-row { grid-template-columns: 80px 1fr 48px; }
  }
`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatGeneratedDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function renderPlatformBadge(platform: string): string {
  const key = platform.toLowerCase();
  const iconDataUri = getReportPlatformIconDataUri(platform);
  if (iconDataUri) {
    const title = getReportPlatformIconTitle(platform);
    return `<img class="platform-icon" src="${iconDataUri}" alt="${esc(title)}" title="${esc(title)}" />`;
  }

  const badge = PLATFORM_BADGE[key] ?? {
    label: platform.slice(0, 2).toUpperCase(),
    bg: "#F3F4F6",
    color: "#6B7280",
  };
  return `<span class="platform-badge" style="background:${badge.bg};color:${badge.color}">${esc(badge.label)}</span>`;
}

function renderCreatorAvatarInline(pub: CampaignPublicationRow): string {
  const display = resolveCreatorAvatarDisplay({
    platform: pub.platform,
    publication_type: pub.publication_type,
    content_url: pub.content_url,
    creator_profile_image_url: pub.creator_profile_image_url,
    influencer_avatar_url: pub.influencer_avatar_url,
    social_profile_picture_url: pub.social_profile_picture_url,
    apify_author_avatar_url: pub.apify_author_avatar_url,
    influencer_name: pub.influencer_name,
  });

  if (display.kind === "image") {
    return `<img class="creator-avatar-inline" src="${esc(display.url)}" alt="" />`;
  }

  if (display.kind === "initials") {
    return `<span class="creator-avatar-inline creator-avatar-inline--initials">${esc(initialsFromCreatorName(display.name))}</span>`;
  }

  return `<span class="creator-avatar-inline creator-avatar-inline--placeholder">?</span>`;
}

function renderCreatorNameWithAvatar(pub: CampaignPublicationRow): string {
  const name = esc(pub.influencer_name ?? "Creator");
  return `<div class="pub-creator"><span class="pub-creator-inner">${renderCreatorAvatarInline(pub)}<span>${name}</span></span></div>`;
}

function renderPlatformIcons(platforms: string[]): string {
  if (platforms.length === 0) return "";
  return `<div class="cover-platforms">${platforms.map((p) => renderPlatformBadge(p)).join("")}</div>`;
}

function renderBarChart(
  items: Array<{ label: string; value: number; display?: string }>
): string {
  const max = Math.max(...items.map((i) => i.value), 1);
  return `<div class="bar-chart">${items
    .map((item) => {
      const pct = Math.round((item.value / max) * 100);
      return `<div class="bar-row">
        <div class="bar-label">${esc(item.label)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <div class="bar-value">${esc(item.display ?? formatCompactCount(item.value))}</div>
      </div>`;
    })
    .join("")}</div>`;
}

function captionExcerpt(caption: string | null, max = 120): string {
  const text = caption?.trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function renderPublicationCard(
  pub: CampaignPublicationRow,
  fullWidth = false
): string {
  const imageUrl = resolvePublicationContentPreviewUrl(pub);
  const preview = imageUrl
    ? `<div class="pub-preview"><img src="${esc(imageUrl)}" alt="" /></div>`
    : `<div class="pub-preview" style="display:flex;align-items:center;justify-content:center;background:${PALETTE.card};"><span style="font-size:10px;color:${PALETTE.muted};">Preview unavailable</span></div>`;

  const excerpt = captionExcerpt(pub.caption);
  const addedValueBadge =
    resolvePublicationValueScope(pub) === "added_value"
      ? `<span class="pub-scope-badge">Added value</span>`
      : "";

  return `<article class="pub-card${fullWidth ? " pub-card--full" : ""}">
    ${preview}
    <div class="pub-body">
      ${renderCreatorNameWithAvatar(pub)}
      <div class="pub-meta">${esc(pub.platform_label)} · ${esc(pub.publication_type_label)} · ${esc(pub.publication_date ?? "—")}${addedValueBadge}</div>
      ${excerpt ? `<p class="pub-caption">${esc(excerpt)}</p>` : ""}
      ${pub.hashtags?.trim() ? `<p class="pub-meta"><strong>Hashtags:</strong> ${esc(pub.hashtags)}</p>` : ""}
      ${pub.mentions?.trim() ? `<p class="pub-meta"><strong>Mentions:</strong> ${esc(pub.mentions)}</p>` : ""}
      ${pub.content_url ? `<div class="pub-meta"><a href="${esc(pub.content_url)}" style="color:${PALETTE.accent};font-size:9px;">${esc(pub.content_url.length > 48 ? `${pub.content_url.slice(0, 48)}…` : pub.content_url)}</a></div>` : ""}
      <div class="pub-metrics">
        <div><span>Views</span><strong>${esc(formatCompactCount(pub.views))}</strong></div>
        <div><span>Reach</span><strong>${esc(formatCompactCount(pub.reach))}</strong></div>
        <div><span>Reach source</span><strong>${esc(pub.reach_source ? REACH_SOURCE_LABELS[(pub.reach_source as ReachSource) ?? "actual"] ?? pub.reach_source : "—")}</strong></div>
        <div><span>Impressions</span><strong>${esc(formatCompactCount(pub.impressions))}</strong></div>
        <div><span>Impressions source</span><strong>${esc(pub.impressions_source ? IMPRESSIONS_SOURCE_LABELS[(pub.impressions_source as ImpressionsSource) ?? "actual"] ?? pub.impressions_source : "—")}</strong></div>
        <div><span>Likes</span><strong>${esc(formatCompactCount(pub.likes))}</strong></div>
        <div><span>Comments</span><strong>${esc(formatCompactCount(pub.comments))}</strong></div>
        <div><span>Shares</span><strong>${esc(formatCompactCount(pub.shares))}</strong></div>
        <div><span>Saves</span><strong>${esc(formatCompactCount(pub.saves))}</strong></div>
        <div><span>Engagements</span><strong>${esc(formatCompactCount(pub.total_engagements))}</strong></div>
        <div><span>ER</span><strong>${esc(formatPercent(pub.engagement_rate, 1))}</strong></div>
      </div>
    </div>
  </article>`;
}

function renderCoverPage(data: PerformanceReportDocumentData): string {
  const { campaign, generatedAt, highlights } = data;
  const variantLabel =
    data.variant === "influencers" ? "Influencer Performance Report" : "Campaign Performance Report";
  const hero = campaign.coverImageUrl
    ? `<img class="cover-hero" src="${esc(campaign.coverImageUrl)}" alt="" />`
    : "";
  const brandLogo = campaign.brandLogoUrl
    ? `<img class="cover-brand-logo" src="${esc(campaign.brandLogoUrl)}" alt="${esc(campaign.brandName ?? "Brand")}" />`
    : "";
  const qrUrl =
    campaign.qrCodeImageUrl?.trim() ||
    buildQrCodeImageUrl(campaign.dashboardUrl, 120);
  const qrBlock = qrUrl
    ? `<div>
          <div class="cover-qr"><img src="${esc(qrUrl)}" alt="Campaign dashboard QR code" /></div>
          <div class="cover-qr-label">Scan for live dashboard</div>
        </div>`
    : "";

  return `<section class="cover-page">
    ${hero}
    <div class="cover-overlay">
      <div>
        ${renderThinkwayReportLogoHtml({ variant: "cover", theme: "dark" })}
        <div class="cover-kicker">${esc(variantLabel)}</div>
        ${brandLogo}
        <div class="cover-accent"></div>
        <h1 class="cover-title">${esc(campaign.name)}</h1>
        <div class="cover-meta">
          <div><strong>Client:</strong> ${esc(campaign.clientName)}</div>
          ${campaign.brandName ? `<div><strong>Brand:</strong> ${esc(campaign.brandName)}</div>` : ""}
          <div><strong>Campaign:</strong> ${esc(campaign.documentNumber)}</div>
          <div><strong>Dates:</strong> ${esc(formatDateRange(campaign.startDate, campaign.endDate))}</div>
          ${campaign.country ? `<div><strong>Country:</strong> ${esc(campaign.country)}</div>` : ""}
        </div>
        ${renderPlatformIcons(highlights.platforms)}
      </div>
      <div class="cover-side">
        ${qrBlock}
      </div>
      <div class="cover-footer">
        <span>Confidential · Thinkway Platform</span>
        <span>Generated ${esc(formatGeneratedDate(generatedAt))}</span>
      </div>
    </div>
  </section>`;
}

function renderClosingPage(): string {
  return `<section class="closing-page" id="section-thank-you">
    ${renderThinkwayReportLogoHtml({ variant: "closing", theme: "dark" })}
    <h2 class="closing-title">THANK YOU</h2>
    <p class="closing-text">Thank you for partnering with Thinkway.</p>
    <div class="closing-contact">
      <div><a href="mailto:hello@thinkwaymedia.com">hello@thinkwaymedia.com</a></div>
      <div><a href="https://www.thinkwaymedia.com">www.thinkwaymedia.com</a></div>
    </div>
    <div class="closing-footer">Confidential · Thinkway Platform</div>
  </section>`;
}

/** Full-page divider before Added Value publications in preview/PDF. */
function renderAddedValueSeparatorPage(publicationCount: number): string {
  const countLabel =
    publicationCount === 1
      ? "1 added-value publication"
      : `${publicationCount} added-value publications`;

  return `<section class="added-value-separator-page" id="section-added-value-divider" aria-label="Added Value">
    <div class="added-value-separator-kicker">Beyond the assignment</div>
    <h2 class="added-value-separator-title">Added Value</h2>
    <p class="added-value-separator-text">
      Extra publications delivered on platforms outside the contracted assignment mix.
    </p>
    <div class="added-value-separator-count">${esc(countLabel)}</div>
  </section>`;
}

type TocEntry = { num: string; label: string; href: string; sub?: boolean };

function renderTableOfContents(entries: TocEntry[]): string {
  return `<section class="toc-page">
    <h2 class="toc-heading">Contents</h2>
    <p class="toc-sub">Campaign performance report overview</p>
    <ol class="toc-list">${entries
      .map(
        (entry) =>
          `<li class="toc-item${entry.sub ? " toc-subitem" : ""}">
            <span class="toc-num">${esc(entry.num)}</span>
            <a href="${esc(entry.href)}">${esc(entry.label)}</a>
          </li>`
      )
      .join("")}</ol>
  </section>`;
}

function buildTocEntries(data: PerformanceReportDocumentData): TocEntry[] {
  if (data.variant === "influencers") {
    const entries: TocEntry[] = [
      { num: "01", label: "Executive Summary", href: "#section-executive-summary" },
    ];
    data.influencerSections.forEach((section, index) => {
      entries.push({
        num: String(index + 2).padStart(2, "0"),
        label: section.name,
        href: `#influencer-${section.influencerId}`,
        sub: true,
      });
    });
    entries.push({ num: "—", label: "Thank You", href: "#section-thank-you" });
    return entries;
  }

  const { addedValue } = partitionPublicationsByValueScope(data.bundle.publications);
  const entries: TocEntry[] = [
    { num: "01", label: "Executive Summary", href: "#section-executive-summary" },
    { num: "02", label: "Campaign Highlights", href: "#section-highlights" },
    { num: "03", label: "Benchmark & Insights", href: "#section-benchmark" },
    { num: "04", label: "Platform Breakdown", href: "#section-platform-breakdown" },
    { num: "05", label: "Performance Charts", href: "#section-performance-charts" },
    { num: "06", label: "Campaign Publications", href: "#section-publications" },
  ];
  if (addedValue.length > 0) {
    entries.push({ num: "07", label: "Added Value", href: "#section-added-value-divider" });
  }
  entries.push({ num: "—", label: "Thank You", href: "#section-thank-you" });
  return entries;
}

function renderExecutiveSummary(data: PerformanceReportDocumentData): string {
  const { summary } = data.bundle;
  const cpeValues = data.bundle.publications
    .map((p) => p.cpe)
    .filter((v): v is number => v != null);
  const averageCpe =
    cpeValues.length > 0 ? cpeValues.reduce((a, b) => a + b, 0) / cpeValues.length : null;

  const kpis = [
    ["Creators", String(data.uniqueCreatorCount)],
    ["Publications", String(summary.agreed_publications)],
    ["Added value", String(summary.added_value_publications)],
    ["Reach", formatCompactCount(summary.total_reach)],
    ["Impressions", formatCompactCount(summary.total_impressions)],
    ["Views", formatCompactCount(summary.total_views)],
    ["Engagements", formatCompactCount(summary.total_engagements)],
    ["Avg ER", formatPercent(summary.average_engagement_rate)],
    ...buildOptionalCostMetricKpiRows([
      { label: "CPM", value: summary.average_cpm, formatted: formatMoneyValue(summary.average_cpm, summary.currency) },
      { label: "CPV", value: summary.average_cpv, formatted: formatMoneyValue(summary.average_cpv, summary.currency) },
      { label: "CPE", value: averageCpe, formatted: formatMoneyValue(averageCpe, summary.currency) },
    ]),
  ];

  return `<div class="section section--compact" id="section-executive-summary">
    <div class="section-label"><div class="num">1</div><div class="title">Executive Summary</div></div>
    <div class="kpi-grid">${kpis
      .map(
        ([label, value]) =>
          `<div class="kpi-card${label === "Added value" ? " kpi-card--added" : ""}"><label>${esc(label)}</label><strong>${esc(value)}</strong></div>`
      )
      .join("")}</div>
    <p class="reach-disclaimer" style="margin-top:12px;font-size:10px;color:${PALETTE.muted};line-height:1.45;">${esc(REACH_FORECAST_DISCLAIMER)} Actual reach: ${esc(formatCompactCount(summary.total_actual_reach))} · Forecasted: ${esc(formatCompactCount(summary.total_forecast_reach))}.</p>
    <p class="impressions-disclaimer" style="margin-top:8px;font-size:10px;color:${PALETTE.muted};line-height:1.45;">${esc(IMPRESSIONS_FORECAST_DISCLAIMER)} Actual impressions: ${esc(formatCompactCount(summary.total_actual_impressions))} · Forecasted: ${esc(formatCompactCount(summary.total_forecast_impressions))}.</p>
  </div>`;
}

function renderCampaignHighlights(data: PerformanceReportDocumentData): string {
  const { highlights } = data;
  return `<div class="section section--compact" id="section-highlights">
    <div class="section-label"><div class="num">2</div><div class="title">Campaign Highlights</div></div>
    <div class="highlights-grid">
      <div class="highlight-card">
        <label>Top Creator</label>
        <strong>${esc(highlights.topCreatorName ?? "—")}</strong>
        <span>${esc(formatCompactCount(highlights.topCreatorEngagements))} engagements</span>
      </div>
      <div class="highlight-card">
        <label>Best Post (Views)</label>
        <strong>${esc(highlights.bestPostLabel ?? "—")}</strong>
        <span>${esc(formatCompactCount(highlights.bestPostViews))} views</span>
      </div>
      <div class="highlight-card">
        <label>Highest ER</label>
        <strong>${esc(highlights.highestErLabel ?? "—")}</strong>
        <span>${esc(formatPercent(highlights.highestEr, 1))}</span>
      </div>
      <div class="highlight-card">
        <label>Total Engagements</label>
        <strong>${esc(formatCompactCount(highlights.totalEngagements))}</strong>
        <span>Across ${data.bundle.summary.agreed_publications} agreed and ${data.bundle.summary.added_value_publications} added-value publication(s)</span>
      </div>
    </div>
  </div>`;
}

function renderBenchmarkSection(data: PerformanceReportDocumentData): string {
  const rows = data.platformBenchmarks
    .map(
      (b) =>
        `<tr><td>${esc(b.label)}</td><td class="num">${b.publicationCount}</td><td class="num">${esc(formatPercent(b.averageEr, 2))}</td></tr>`
    )
    .join("");

  return `<div class="section section--compact" id="section-benchmark">
    <div class="section-label"><div class="num">3</div><div class="title">Benchmark & Key Insights</div></div>
    <table class="benchmark-table">
      <thead><tr><th>Platform</th><th class="num">Posts</th><th class="num">Avg ER</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${data.bestCreatorErName ? `<p class="report-note" style="margin-top:10px;">Best creator ER: <strong>${esc(data.bestCreatorErName)}</strong> at ${esc(formatPercent(data.bestCreatorEr, 2))}</p>` : ""}
    <div style="margin-top:14px;">
      <h3 class="chart-subheading">Recommendations</h3>
      <ul class="insights-list">${data.recommendations.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
    </div>
  </div>`;
}

function renderPlatformBreakdown(data: PerformanceReportDocumentData): string {
  const { charts } = data.bundle;
  const total = charts.platform_split.reduce((s, p) => s + p.count, 0) || 1;
  const bars = charts.platform_split.map((p) => ({
    label: p.label,
    value: p.count,
    display: `${p.count} (${Math.round((p.count / total) * 100)}%)`,
  }));
  const num = data.variant === "influencers" ? "2" : "4";

  return `<div class="section section--compact" id="section-platform-breakdown">
    <div class="section-label"><div class="num">${num}</div><div class="title">Platform Breakdown</div></div>
    ${renderBarChart(bars)}
    <table class="data-table">
      <thead><tr><th>Platform</th><th class="num">Posts</th><th class="num">Engagements</th></tr></thead>
      <tbody>${charts.platform_split
        .map(
          (p) =>
            `<tr><td>${esc(p.label)}</td><td class="num">${p.count}</td><td class="num">${esc(formatCompactCount(p.engagements))}</td></tr>`
        )
        .join("")}</tbody>
    </table>
  </div>`;
}

function renderPerformanceCharts(data: PerformanceReportDocumentData): string {
  const { charts } = data.bundle;
  const num = data.variant === "influencers" ? "3" : "5";

  const chartBlocks = [
    ["Views by publication", renderBarChart(charts.views_by_publication.map((p) => ({ label: p.label.length > 24 ? `${p.label.slice(0, 24)}…` : p.label, value: p.views })))],
    ["Engagement by publication", renderBarChart(charts.performance_over_time.slice(-12).map((row) => ({ label: row.date, value: row.engagements })))],
    ["Top creators", renderBarChart(charts.top_creators_by_engagement.map((c) => ({ label: c.name, value: c.engagements })))],
  ];

  return `<div class="section" id="section-performance-charts">
    <div class="section-label"><div class="num">${num}</div><div class="title">Performance Charts</div></div>
    ${chartBlocks
      .map(([title, chart]) => `<div class="chart-block"><h3 class="chart-subheading">${esc(title)}</h3>${chart}</div>`)
      .join("")}
  </div>`;
}

function renderAudienceSnapshot(section: InfluencerReportSection): string {
  const { audience } = section;
  const genderText = audience.genderSplit
    ? Object.entries(audience.genderSplit)
        .map(([k, v]) => `${k}: ${v}%`)
        .join(" · ")
    : "—";

  return `<div class="audience-grid">
    <div class="audience-card"><label>Followers</label>${esc(formatCompactCount(audience.followerCount))}</div>
    <div class="audience-card"><label>Gender Split</label>${esc(genderText)}</div>
    <div class="audience-card"><label>Top Location</label>${esc(audience.topLocation ?? "—")}</div>
  </div>`;
}

function renderInfluencerSection(section: InfluencerReportSection): string {
  const { agreed: agreedPublications, addedValue: addedValuePublications } =
    partitionPublicationsByValueScope(section.publications);
  const avatar = section.avatarUrl
    ? `<div class="influencer-avatar"><img src="${esc(section.avatarUrl)}" alt="" /></div>`
    : `<div class="influencer-avatar">${esc(initials(section.name))}</div>`;

  const viewsChart = renderBarChart(
    section.publications.map((p, i) => ({
      label: `#${i + 1} ${p.platform_label}`,
      value: p.views ?? 0,
    }))
  );
  const engagementChart = renderBarChart(
    section.publications.map((p, i) => ({
      label: `#${i + 1} ${p.platform_label}`,
      value: p.total_engagements,
    }))
  );

  return `<section class="influencer-section" id="influencer-${esc(section.influencerId)}">
    <div class="influencer-cover">
      <div class="influencer-cover-inner">
        ${avatar}
        <div>
          <h2 class="influencer-name">${esc(section.name)}</h2>
          <p class="influencer-handles">${esc(section.platformHandles.join(" · ") || "Creator")}</p>
          <p class="influencer-role">${esc(section.role ?? "Campaign Creator")}${section.followerCount ? ` · ${esc(formatCompactCount(section.followerCount))} followers` : ""}</p>
        </div>
      </div>
      <div class="influencer-kpi-row">
        <div class="influencer-kpi"><label>Posts</label><strong>${section.summary.agreedPublications}</strong></div>
        ${
          section.summary.addedValuePublications > 0
            ? `<div class="influencer-kpi"><label>Added value</label><strong>${section.summary.addedValuePublications}</strong></div>`
            : ""
        }
        <div class="influencer-kpi"><label>Views</label><strong>${esc(formatCompactCount(section.summary.views))}</strong></div>
        <div class="influencer-kpi"><label>Reach</label><strong>${esc(formatCompactCount(section.summary.reach))}</strong></div>
        <div class="influencer-kpi"><label>Impressions</label><strong>${esc(formatCompactCount(section.summary.impressions))}</strong></div>
        <div class="influencer-kpi"><label>Engagements</label><strong>${esc(formatCompactCount(section.summary.engagements))}</strong></div>
        <div class="influencer-kpi"><label>ER</label><strong>${esc(formatPercent(section.summary.averageEr, 1))}</strong></div>
      </div>
    </div>

    <div class="section section--compact">
      <div class="section-label"><div class="num">▸</div><div class="title">Performance Summary</div></div>
      <div class="chart-block"><h3 class="chart-subheading">Views by publication</h3>${viewsChart}</div>
      <div class="chart-block"><h3 class="chart-subheading">Engagement by publication</h3>${engagementChart}</div>
    </div>

    <div class="section">
      <div class="section-label"><div class="num">▸</div><div class="title">Publications</div></div>
      <div class="pub-grid">${agreedPublications.map((pub) => renderPublicationCard(pub, true)).join("") || `<p class="report-note">No agreed publications for this creator.</p>`}</div>
    </div>
    ${
      addedValuePublications.length > 0
        ? `${renderAddedValueSeparatorPage(addedValuePublications.length)}
    <div class="section" id="influencer-${esc(section.influencerId)}-added-value">
      <div class="section-label"><div class="num">▸</div><div class="title">Added Value</div></div>
      <p class="report-note" style="margin-bottom:10px;">Extra publications beyond the assignment platforms.</p>
      <div class="pub-grid">${addedValuePublications.map((pub) => renderPublicationCard(pub, true)).join("")}</div>
    </div>`
        : ""
    }

    <div class="section section--compact">
      <div class="section-label"><div class="num">▸</div><div class="title">Insights</div></div>
      <ul class="insights-list">${section.insights.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
    </div>

    <div class="section section--compact">
      <div class="section-label"><div class="num">▸</div><div class="title">Audience Snapshot</div></div>
      ${renderAudienceSnapshot(section)}
    </div>
  </section>`;
}

function renderInfluencerSections(data: PerformanceReportDocumentData): string {
  return data.influencerSections.map((section) => renderInfluencerSection(section)).join("");
}

function renderPublicationsGallery(
  publications: CampaignPublicationRow[],
  options: { id: string; num: string; title: string; subtitle?: string }
): string {
  return `<div class="section" id="${esc(options.id)}">
    <div class="section-label"><div class="num">${esc(options.num)}</div><div class="title">${esc(options.title)}</div></div>
    ${options.subtitle ? `<p class="report-note" style="margin-bottom:10px;">${esc(options.subtitle)}</p>` : ""}
    <div class="pub-grid pub-grid--gallery">${
      publications.length > 0
        ? publications.map((pub) => renderPublicationCard(pub)).join("")
        : `<p class="report-note">No publications in this group.</p>`
    }</div>
  </div>`;
}

export function renderPerformanceReportHtml(data: PerformanceReportDocumentData): string {
  const badge =
    data.variant === "influencers"
      ? `${data.campaign.documentNumber} · Influencer Reports`
      : `${data.campaign.documentNumber} · Performance`;

  const generatedLabel = formatGeneratedDate(data.generatedAt);
  const toc = renderTableOfContents(buildTocEntries(data));

  const { agreed: agreedPublications, addedValue: addedValuePublications } =
    partitionPublicationsByValueScope(data.bundle.publications);

  const reportSections =
    data.variant === "influencers"
      ? [renderExecutiveSummary(data), renderInfluencerSections(data)].join("")
      : [
          renderExecutiveSummary(data),
          renderCampaignHighlights(data),
          renderBenchmarkSection(data),
          renderPlatformBreakdown(data),
          renderPerformanceCharts(data),
          renderPublicationsGallery(agreedPublications, {
            id: "section-publications",
            num: "6",
            title: "Campaign Publications",
            subtitle: "Posts matching the agreed assignment platforms.",
          }),
          ...(addedValuePublications.length > 0
            ? [
                renderAddedValueSeparatorPage(addedValuePublications.length),
                renderPublicationsGallery(addedValuePublications, {
                  id: "section-added-value",
                  num: "7",
                  title: "Added Value Publications",
                  subtitle:
                    "Extra publications beyond the assignment — additional value delivered to the client.",
                }),
              ]
            : []),
        ].join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(data.campaign.name)} — Performance Report — Thinkway</title>
<style>${THINKWAY_REPORT_STYLES}${buildPerformanceReportStyles(generatedLabel)}</style>
</head>
<body class="perf-report">
<div class="page">
  ${renderCoverPage(data)}
  ${toc}
  <div class="report-body">
    ${reportSections}
  </div>
  ${renderClosingPage()}
  <div class="screen-footer">
    <div class="left">Confidential · <strong>Thinkway Platform</strong> · Generated ${esc(generatedLabel)}</div>
    <div class="badge">${esc(badge)}</div>
  </div>
</div>
</body>
</html>`;
}
