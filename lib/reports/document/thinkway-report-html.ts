import { getThinkwayLogoDarkDataUri } from "@/lib/reports/document/thinkway-report-logo-embed";
import { renderThinkwayReportLogoHtml } from "@/lib/reports/document/thinkway-report-logo";
import { THINKWAY_REPORT_STYLES } from "@/lib/reports/document/thinkway-report-styles";

export type ReportScopeMetaItem = {
  label: string;
  value: string;
};

export type ReportTableSection = {
  number: number;
  title: string;
  notes?: string[];
  tableHtml: string;
};

export type ThinkwayReportHtmlInput = {
  pageTitle: string;
  reportTypeLabel: string;
  reportBadge: string;
  generatedAt: Date;
  scopeMeta: ReportScopeMetaItem[];
  tableSections: ReportTableSection[];
  /** Right footer label, e.g. thinkway.VR */
  footerBrand?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatGeneratedDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderScopeMeta(items: ReportScopeMetaItem[]): string {
  if (items.length === 0) return "";
  const pills = items
    .map(
      (item) =>
        `<span class="scope-pill"><span class="dot"></span>${escapeHtml(item.label)}: ${escapeHtml(item.value)}</span>`
    )
    .join("");
  return `<div class="scope-meta">${pills}</div>`;
}

function renderTableSections(sections: ReportTableSection[]): string {
  return sections
    .map((section) => {
      const notes =
        section.notes && section.notes.length > 0
          ? section.notes
              .map((note) => `<p class="report-note">${escapeHtml(note)}</p>`)
              .join("")
          : "";
      return `
        <div class="section">
          <div class="section-label">
            <div class="num">${section.number}</div>
            <div class="title">${escapeHtml(section.title)}</div>
          </div>
          ${notes}
          <div class="table-scroll">${section.tableHtml}</div>
        </div>`;
    })
    .join("");
}

export function renderThinkwayReportHtml(input: ThinkwayReportHtmlInput): string {
  const generatedLabel = formatGeneratedDate(input.generatedAt);
  const footerBrand = input.footerBrand?.trim() || "Thinkway Platform";
  // Puppeteer aborts remote/relative images — always embed data URI or CSS text.
  const logoDarkSrc = getThinkwayLogoDarkDataUri() ?? "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(input.pageTitle)} — Thinkway</title>
<style>${THINKWAY_REPORT_STYLES}</style>
</head>
<body>
<div class="page">
  <div class="doc-header">
    <div class="brand">
      ${renderThinkwayReportLogoHtml({
        variant: "header",
        theme: "dark",
        logoDarkSrc,
        logoLightSrc: "",
        showText: true,
      })}
      <div class="tagline">Influencer Marketing Agency · ثينكواي</div>
    </div>
    <div class="title-block">
      <div class="report-title">${escapeHtml(input.reportTypeLabel)}</div>
      <div><span class="serial-badge">${escapeHtml(input.reportBadge)}</span></div>
      <div class="meta">Generated: ${escapeHtml(generatedLabel)}</div>
    </div>
  </div>
  <div class="stripe"></div>
  <div class="doc-body">
    ${renderScopeMeta(input.scopeMeta)}
    ${renderTableSections(input.tableSections)}
  </div>
  <div class="doc-footer">
    <div class="left">Confidential · <strong>Thinkway Platform</strong></div>
    <div class="right">${escapeHtml(footerBrand)}</div>
  </div>
</div>
</body>
</html>`;
}

export function formatReportAmount(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatReportAmountAlways(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "0.00";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatVariancePercent(value: number | null): string {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(0)}%`;
}
