import type { CampaignPerformanceBundle } from "@/features/campaigns/queries/publications";
import {
  buildStyledExcelBuffer,
  type StyledDataRow,
  type StyledSheetConfig,
} from "@/lib/reports/document/excel-report-builder";
import {
  formatCompactCount,
  formatMoneyValue,
  formatPercent,
} from "@/lib/campaigns/performance-calculations";
import {
  buildOptionalCostMetricKpiRows,
  resolveDisplayableCostMetricColumns,
  type CostMetricColumnKey,
} from "@/lib/performance/report/performance-report-cost-metrics";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Legacy minimal HTML renderer — prefer lib/performance/report. */
export function renderCampaignPerformanceReportHtml(
  campaignName: string,
  documentNumber: string,
  bundle: CampaignPerformanceBundle
): string {
  const { summary, publications } = bundle;

  const kpiRows = [
    ["Total Publications", String(summary.total_publications)],
    ["Total Reach", formatCompactCount(summary.total_reach)],
    ["Total Impressions", formatCompactCount(summary.total_impressions)],
    ["Total Views", formatCompactCount(summary.total_views)],
    ["Total Engagements", formatCompactCount(summary.total_engagements)],
    ["Average ER", formatPercent(summary.average_engagement_rate)],
    ...buildOptionalCostMetricKpiRows([
      {
        label: "CPM",
        value: summary.average_cpm,
        formatted: formatMoneyValue(summary.average_cpm, summary.currency),
      },
      {
        label: "CPV",
        value: summary.average_cpv,
        formatted: formatMoneyValue(summary.average_cpv, summary.currency),
      },
    ]),
    ["Top Creator", summary.top_creator_name ?? "—"],
  ];

  const pubRows = publications
    .map(
      (p) => `<tr>
        <td>${esc(p.influencer_name ?? "—")}</td>
        <td>${esc(p.platform_label)}</td>
        <td>${esc(p.publication_type_label)}</td>
        <td>${esc(p.publication_date ?? "—")}</td>
        <td style="text-align:right">${formatCompactCount(p.views)}</td>
        <td style="text-align:right">${formatCompactCount(p.reach)}</td>
        <td style="text-align:right">${formatPercent(p.engagement_rate, 1)}</td>
        <td>${esc(p.status)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(campaignName)} — Performance Report</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 28px; color: #0B0F1A; }
    h1 { font-size: 20px; margin: 0 0 4px; color: #0057FF; }
    .meta { color: #9099A8; font-size: 12px; margin-bottom: 24px; }
    .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 28px; }
    .kpi { border: 1px solid #E6EAF2; border-radius: 8px; padding: 12px; background: #FAFBFD; }
    .kpi label { display: block; font-size: 10px; text-transform: uppercase; color: #9099A8; margin-bottom: 4px; }
    .kpi strong { font-size: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border-bottom: 1px solid #E6EAF2; padding: 8px; text-align: left; }
    th { background: #FAFBFD; color: #9099A8; font-size: 10px; text-transform: uppercase; }
  </style>
</head>
<body>
  <h1>Campaign Performance Report</h1>
  <p class="meta">${esc(documentNumber)} · ${esc(campaignName)} · Generated ${new Date().toLocaleString()}</p>
  <div class="kpis">
    ${kpiRows
      .map(
        ([label, value]) =>
          `<div class="kpi"><label>${esc(label)}</label><strong>${esc(value)}</strong></div>`
      )
      .join("")}
  </div>
  <h2 style="font-size:14px;margin:0 0 12px">Publication performance</h2>
  <table>
    <thead>
      <tr>
        <th>Creator</th><th>Platform</th><th>Type</th><th>Date</th>
        <th style="text-align:right">Views</th><th style="text-align:right">Reach</th>
        <th style="text-align:right">ER%</th><th>Status</th>
      </tr>
    </thead>
    <tbody>${pubRows || '<tr><td colspan="8">No publications</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}

export function buildCampaignPerformanceExcelRows(
  bundle: CampaignPerformanceBundle
): Array<Record<string, string | number>> {
  const costMetricColumns = resolveDisplayableCostMetricColumns(bundle.publications);
  const costMetricHeaderLabels: Record<CostMetricColumnKey, string> = {
    cpv: "CPV",
    cpe: "CPE",
    cpm: "CPM",
  };

  return bundle.publications.map((p) => {
    const row: Record<string, string | number> = {
      Creator: p.influencer_name ?? "",
      Platform: p.platform_label,
      Type: p.publication_type_label,
      URL: p.content_url ?? "",
      Date: p.publication_date ?? "",
      Status: p.status,
      Views: p.views ?? 0,
      Reach: p.reach ?? 0,
      Impressions: p.impressions ?? 0,
      Likes: p.likes ?? 0,
      Comments: p.comments ?? 0,
      Shares: p.shares ?? 0,
      "ER %": p.engagement_rate ?? 0,
      Cost: p.cost ?? 0,
    };

    for (const key of costMetricColumns) {
      const label = costMetricHeaderLabels[key];
      row[label] = p[key] ?? 0;
    }

    return row;
  });
}

export async function buildCampaignPerformanceExcelBuffer(
  campaignName: string,
  documentNumber: string,
  bundle: CampaignPerformanceBundle
): Promise<Buffer> {
  const excelRows = buildCampaignPerformanceExcelRows(bundle);
  const headers = excelRows[0]
    ? Object.keys(excelRows[0])
    : [
        "Creator",
        "Platform",
        "Type",
        "URL",
        "Date",
        "Status",
        "Views",
        "Reach",
        "Impressions",
        "Likes",
        "Comments",
        "Shares",
        "ER %",
        "Cost",
      ];

  const rows: StyledDataRow[] = excelRows.map((r) => ({
    values: headers.map((h) => r[h] ?? ""),
  }));

  const sheet: StyledSheetConfig = {
    name: "Performance",
    header: {
      title: "Thinkway — Campaign Performance Report",
      entityLine: `${documentNumber} — ${campaignName}`,
      meta: [
        { label: "Publications", value: String(bundle.summary.total_publications) },
        { label: "Total views", value: formatCompactCount(bundle.summary.total_views) },
        { label: "Avg ER", value: formatPercent(bundle.summary.average_engagement_rate) },
      ],
      generatedAt: new Date(),
    },
    columnHeaders: [headers],
    rows,
    columnFormats: headers.map((h) =>
      h === "ER %" ? "percent" : ["Cost", "CPV", "CPE", "CPM"].includes(h) ? "money" : "text"
    ),
  };

  return buildStyledExcelBuffer([sheet]);
}
