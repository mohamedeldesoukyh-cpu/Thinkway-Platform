import type { SpendingByCategoryReportData } from "@/lib/analytics/spending-by-category/spending-by-category-types";
import type { StyledDataRow, StyledSheetConfig } from "@/lib/reports/document/excel-report-builder";
import { buildStyledExcelBuffer } from "@/lib/reports/document/thinkway-report-excel";
import {
  formatReportAmount,
  renderThinkwayReportHtml,
  type ReportTableSection,
} from "@/lib/reports/document/thinkway-report-html";
import { sanitizeFileNameSegment } from "@/lib/reports/document/report-document-response";
import { csvEscapeCell } from "@/lib/security/csv-formula";

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function escapeCsvValue(value: string | number): string {
  return csvEscapeCell(value);
}

function renderSummaryTable(report: SpendingByCategoryReportData): string {
  const showSubcategory = report.group_by === "subcategory";
  const bodyRows = report.summary_rows
    .map((row) => {
      const subcategoryCell = showSubcategory
        ? `<td>${row.subcategory_label ?? "—"}</td>`
        : "";
      return `
      <tr>
        <td>${row.category_label}</td>
        ${subcategoryCell}
        <td class="num">${row.client_count}</td>
        <td class="num">${row.campaign_count}</td>
        <td class="num">${formatReportAmount(row.total_spending)}</td>
        <td class="num">${formatPercent(row.percent_of_total)}</td>
        <td class="num">${formatReportAmount(row.vr_amount)}</td>
        <td class="num">${formatPercent(row.avg_margin_percent)}</td>
      </tr>`;
    })
    .join("");

  const subcategoryHeader = showSubcategory ? "<th>Subcategory</th>" : "";

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Category</th>
          ${subcategoryHeader}
          <th class="num">Clients</th>
          <th class="num">Campaigns</th>
          <th class="num">Spending</th>
          <th class="num">% of total</th>
          <th class="num">VR amount</th>
          <th class="num">Avg margin</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>`;
}

function renderDetailTable(report: SpendingByCategoryReportData): string {
  const rows: string[] = [];

  for (const group of report.detail_groups) {
    const groupLabel =
      group.subcategory_label != null
        ? `${group.category_label} · ${group.subcategory_label}`
        : group.category_label;

    for (const client of group.clients) {
      for (const campaign of client.campaigns) {
        rows.push(`
          <tr>
            <td>${groupLabel}</td>
            <td>${client.client_name}</td>
            <td>${campaign.campaign_label}</td>
            <td>${campaign.brand_name ?? "—"}</td>
            <td class="num">${formatReportAmount(campaign.spending)}</td>
            <td class="num">${formatReportAmount(campaign.vr_amount)}</td>
            <td class="num">${formatPercent(campaign.margin_percent)}</td>
          </tr>`);
      }
    }
  }

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>Client</th>
          <th>Campaign</th>
          <th>Brand</th>
          <th class="num">Spending</th>
          <th class="num">VR amount</th>
          <th class="num">Margin</th>
        </tr>
      </thead>
      <tbody>${rows.join("")}</tbody>
    </table>`;
}

function buildScopeMeta(report: SpendingByCategoryReportData) {
  return [
    { label: "Year", value: String(report.year) },
    { label: "Period", value: report.period_label },
    { label: "Group by", value: report.group_by },
    { label: "Currency", value: report.display_currency },
    {
      label: "Total spending",
      value: formatReportAmount(report.kpis.total_spending),
    },
    {
      label: "Categories",
      value: String(report.kpis.category_count),
    },
  ];
}

function buildTableSections(report: SpendingByCategoryReportData): ReportTableSection[] {
  return [
    {
      number: 1,
      title: "Summary by category",
      notes: [report.period_note, report.data_scope_note],
      tableHtml: renderSummaryTable(report),
    },
    {
      number: 2,
      title: "Client and campaign detail",
      notes: ["Drill-down by category, client, and campaign."],
      tableHtml: renderDetailTable(report),
    },
  ];
}

export function buildSpendingByCategoryReportHtml(
  report: SpendingByCategoryReportData
): string {
  return renderThinkwayReportHtml({
    pageTitle: `Spending by Category ${report.year}`,
    reportTypeLabel: "Performance Report",
    reportBadge: `Spending by Category ${report.period_label} ${report.year}`,
    generatedAt: new Date(),
    scopeMeta: buildScopeMeta(report),
    tableSections: buildTableSections(report),
    footerBrand: "thinkway.SpendingByCategory",
  });
}

function buildSummaryExcelSheet(report: SpendingByCategoryReportData): StyledSheetConfig {
  const showSubcategory = report.group_by === "subcategory";
  const rows: StyledDataRow[] = report.summary_rows.map((row) => ({
    values: showSubcategory
      ? [
          row.category_label,
          row.subcategory_label ?? "—",
          row.client_count,
          row.campaign_count,
          row.total_spending,
          row.percent_of_total,
          row.vr_amount,
          row.avg_margin_percent,
        ]
      : [
          row.category_label,
          row.client_count,
          row.campaign_count,
          row.total_spending,
          row.percent_of_total,
          row.vr_amount,
          row.avg_margin_percent,
        ],
  }));

  return {
    name: "Summary",
    header: {
      title: "Thinkway — Spending by Category",
      entityLine: `Summary ${report.period_label} ${report.year}`,
      meta: buildScopeMeta(report),
      generatedAt: new Date(),
      notes: [report.period_note, report.data_scope_note],
    },
    columnHeaders: [
      showSubcategory
        ? [
            "Category",
            "Subcategory",
            "Clients",
            "Campaigns",
            "Spending",
            "% of total",
            "VR amount",
            "Avg margin",
          ]
        : [
            "Category",
            "Clients",
            "Campaigns",
            "Spending",
            "% of total",
            "VR amount",
            "Avg margin",
          ],
    ],
    rows,
    columnFormats: showSubcategory
      ? ["text", "text", "text", "text", "money", "percent", "money", "percent"]
      : ["text", "text", "text", "money", "percent", "money", "percent"],
  };
}

function buildDetailExcelSheet(report: SpendingByCategoryReportData): StyledSheetConfig {
  const rows: StyledDataRow[] = [];

  for (const group of report.detail_groups) {
    const groupLabel =
      group.subcategory_label != null
        ? `${group.category_label} · ${group.subcategory_label}`
        : group.category_label;

    for (const client of group.clients) {
      for (const campaign of client.campaigns) {
        rows.push({
          values: [
            groupLabel,
            client.client_name,
            campaign.campaign_label,
            campaign.brand_name ?? "—",
            campaign.spending,
            campaign.vr_amount,
            campaign.margin_percent,
          ],
        });
      }
    }
  }

  return {
    name: "Detail",
    header: {
      title: "Thinkway — Spending by Category Detail",
      entityLine: `Client and campaign drill-down ${report.period_label} ${report.year}`,
      meta: buildScopeMeta(report),
      generatedAt: new Date(),
    },
    columnHeaders: [
      ["Category", "Client", "Campaign", "Brand", "Spending", "VR amount", "Margin"],
    ],
    rows,
    columnFormats: ["text", "text", "text", "text", "money", "money", "percent"],
  };
}

export async function buildSpendingByCategoryReportExcelBuffer(
  report: SpendingByCategoryReportData
): Promise<Buffer> {
  return buildStyledExcelBuffer([
    buildSummaryExcelSheet(report),
    buildDetailExcelSheet(report),
  ]);
}

export function buildSpendingByCategoryCsv(
  report: SpendingByCategoryReportData,
  view: "summary" | "detail"
): string {
  if (view === "detail") {
    const header = [
      "Category",
      "Client",
      "Campaign",
      "Brand",
      "Spending",
      "VR amount",
      "Margin %",
    ];
    const lines = [header.join(",")];

    for (const group of report.detail_groups) {
      const groupLabel =
        group.subcategory_label != null
          ? `${group.category_label} · ${group.subcategory_label}`
          : group.category_label;

      for (const client of group.clients) {
        for (const campaign of client.campaigns) {
          lines.push(
            [
              groupLabel,
              client.client_name,
              campaign.campaign_label,
              campaign.brand_name ?? "",
              campaign.spending,
              campaign.vr_amount,
              campaign.margin_percent.toFixed(2),
            ]
              .map(escapeCsvValue)
              .join(",")
          );
        }
      }
    }

    return lines.join("\n");
  }

  const showSubcategory = report.group_by === "subcategory";
  const header = showSubcategory
    ? [
        "Category",
        "Subcategory",
        "Clients",
        "Campaigns",
        "Spending",
        "% of total",
        "VR amount",
        "Avg margin %",
      ]
    : [
        "Category",
        "Clients",
        "Campaigns",
        "Spending",
        "% of total",
        "VR amount",
        "Avg margin %",
      ];

  const lines = [header.join(",")];

  for (const row of report.summary_rows) {
    const values = showSubcategory
      ? [
          row.category_label,
          row.subcategory_label ?? "",
          row.client_count,
          row.campaign_count,
          row.total_spending,
          row.percent_of_total.toFixed(2),
          row.vr_amount,
          row.avg_margin_percent.toFixed(2),
        ]
      : [
          row.category_label,
          row.client_count,
          row.campaign_count,
          row.total_spending,
          row.percent_of_total.toFixed(2),
          row.vr_amount,
          row.avg_margin_percent.toFixed(2),
        ];
    lines.push(values.map(escapeCsvValue).join(","));
  }

  return lines.join("\n");
}

export function buildSpendingByCategoryFileBaseName(
  report: SpendingByCategoryReportData
): string {
  const periodSuffix = report.period_scope === "fy" ? "" : `-${report.period_scope}`;
  return `TW-Spending-By-Category-${report.year}${periodSuffix}-${report.group_by}-${report.display_currency}`;
}

export function buildSpendingByCategoryFileBaseNameSafe(
  report: SpendingByCategoryReportData
): string {
  return sanitizeFileNameSegment(buildSpendingByCategoryFileBaseName(report));
}
