import { videoMetricTotals, videoCounters, reportedTotal } from './reported-metrics';
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
import { REACH_SOURCE_LABELS, type ReachSource } from "@/lib/performance/reach-forecast-engine";
import {
  IMPRESSIONS_SOURCE_LABELS,
  type ImpressionsSource,
} from "@/lib/performance/impressions-forecast-engine";
import type { PerformanceReportDocumentData } from "@/lib/performance/report/performance-report-types";
import {
  partitionPublicationsByValueScope,
  publicationValueScopeLabel,
} from "@/lib/performance/publication-value-scope";
import {
  buildStyledExcelBuffer,
  type StyledDataRow,
  type StyledSheetConfig,
} from "@/lib/reports/document/excel-report-builder";

export function buildPerformanceReportExcelBuffer(
  data: PerformanceReportDocumentData
): Promise<Buffer> {
  const costMetricColumns = resolveDisplayableCostMetricColumns(data.bundle.publications);
  const costMetricHeaderLabels: Record<CostMetricColumnKey, string> = {
    cpv: "CPV",
    cpe: "CPE",
    cpm: "CPM",
  };

  const baseHeaders = [
    "Creator",
    "Platform",
    "Type",
    "Value type",
    "URL",
    "Date",
    "Status",
    "Caption",
    "Hashtags",
    "Mentions",
    "Video Play Count",
    "Views",
    "Reach",
    "Reach Source",
    "Impressions",
    "Impressions Source",
    "Engagements",
    "ER %",
    "Likes",
    "Comments",
    "Shares",
    "Cost",
  ] as const;

  const headers = [
    ...baseHeaders,
    ...costMetricColumns.map((key) => costMetricHeaderLabels[key]),
  ];

  const { agreed: agreedPublications, addedValue: addedValuePublications } =
    partitionPublicationsByValueScope(data.bundle.publications);

  const mapPublicationRows = (
    publications: PerformanceReportDocumentData["bundle"]["publications"]
  ): StyledDataRow[] =>
    publications.map((p) => {
    const baseValues = [
      p.influencer_name ?? "",
      p.platform_label,
      p.publication_type_label,
      publicationValueScopeLabel(p.value_scope),
      p.content_url ?? "",
      p.publication_date ?? "",
      p.status,
      p.caption ?? "",
      p.hashtags ?? "",
      p.mentions ?? "",
      videoCounters(p).plays ?? "",
      videoCounters(p).views ?? "",
      p.reach ?? "",
      p.reach_source
        ? REACH_SOURCE_LABELS[(p.reach_source as ReachSource) ?? "actual"] ?? p.reach_source
        : "—",
      p.impressions ?? "",
      p.impressions_source
        ? IMPRESSIONS_SOURCE_LABELS[(p.impressions_source as ImpressionsSource) ?? "actual"] ??
          p.impressions_source
        : "—",
      p.total_engagements,
      p.engagement_rate ?? 0,
      p.likes ?? 0,
      p.comments ?? 0,
      p.shares ?? 0,
      p.cost ?? 0,
    ];

    const costMetricValues: Record<CostMetricColumnKey, number> = {
      cpv: p.cpv ?? 0,
      cpe: p.cpe ?? 0,
      cpm: p.cpm ?? 0,
    };

    return {
      values: [...baseValues, ...costMetricColumns.map((key) => costMetricValues[key])],
    };
  });

  const agreedRows = mapPublicationRows(agreedPublications);
  const addedValueRows = mapPublicationRows(addedValuePublications);

  const cpeValues = data.bundle.publications
    .map((p) => p.cpe)
    .filter((v): v is number => v != null);
  const averageCpe =
    cpeValues.length > 0 ? cpeValues.reduce((a, b) => a + b, 0) / cpeValues.length : null;

  const optionalSummaryCostRows = buildOptionalCostMetricKpiRows([
    {
      label: "Average CPM",
      value: data.bundle.summary.average_cpm,
      formatted: formatMoneyValue(data.bundle.summary.average_cpm, data.campaign.currency),
    },
    {
      label: "Average CPV",
      value: data.bundle.summary.average_cpv,
      formatted: formatMoneyValue(data.bundle.summary.average_cpv, data.campaign.currency),
    },
    {
      label: "Average CPE",
      value: averageCpe,
      formatted: formatMoneyValue(averageCpe, data.campaign.currency),
    },
  ]).map(([label, value]) => ({ values: [label, value] }));

  const summarySheet: StyledSheetConfig = {
    name: "Summary",
    header: {
      title: "Thinkway — Campaign Performance Report",
      entityLine: `${data.campaign.documentNumber} — ${data.campaign.name}`,
      meta: [
        { label: "Client", value: data.campaign.clientName },
        { label: "Brand", value: data.campaign.brandName ?? "—" },
        { label: "Creators", value: String(data.uniqueCreatorCount) },
        { label: "Publications", value: String(data.bundle.summary.agreed_publications) },
        { label: "AV creators", value: String(data.addedValueCreatorCount) },
        {
          label: "AV creator names",
          value: data.addedValueCreators.map((c) => c.name).join(", ") || "—",
        },
        { label: "AV posts", value: String(data.bundle.summary.added_value_publications) },
        { label: "Reported reach (not deduplicated)", value: reportedTotal(data.bundle.publications, 'reach') },
        { label: "Reported impressions", value: reportedTotal(data.bundle.publications, 'impressions') },
        ...videoMetricTotals(data.bundle.publications).map(m=>({label:m.label,value:`${m.value} · ${m.coverage}`})),
        { label: "Avg ER", value: formatPercent(data.bundle.summary.average_engagement_rate) },
        ...data.platformBenchmarks.map((b) => ({
          label: `Avg ER · ${b.label}`,
          value: `${b.publicationCount} agreed · ${formatPercent(b.averageEr)}`,
        })),
      ].filter(row => !String(row.value).startsWith("Unavailable")),
      generatedAt: data.generatedAt,
    },
    columnHeaders: [["Metric", "Value"]],
    rows: [
      { values: ["Publications (agreed)", String(data.bundle.summary.agreed_publications)] },
      { values: ["AV creators (no deliverables)", String(data.addedValueCreatorCount)] },
      {
        values: [
          "AV creator names",
          data.addedValueCreators.map((c) => c.name).join(", ") || "—",
        ],
      },
      { values: ["AV posts", String(data.bundle.summary.added_value_publications)] },
      { values: ["Reported reach (not deduplicated)", reportedTotal(data.bundle.publications, 'reach')] },
      { values: ["Reported impressions", reportedTotal(data.bundle.publications, 'impressions')] },
      { values: ["Total engagements", formatCompactCount(data.bundle.summary.total_engagements)] },
      { values: ["Avg ER", formatPercent(data.bundle.summary.average_engagement_rate)] },
      ...data.platformBenchmarks.map((b) => ({
        values: [
          `Avg ER · ${b.label}`,
          `${b.publicationCount} agreed · ${formatPercent(b.averageEr)}`,
        ],
      })),
      ...optionalSummaryCostRows,
    ].filter(row => !String(row.values[1]).startsWith("Unavailable")),
    columnFormats: ["text", "text"],
  };

  const publicationsSheet: StyledSheetConfig = {
    name: "Publications",
    header: {
      title: "Agreed publication performance",
      entityLine: data.campaign.name,
      generatedAt: data.generatedAt,
    },
    columnHeaders: [headers],
    rows: agreedRows,
    columnFormats: headers.map((h) =>
      h === "ER %" ? "percent" : ["Cost", "CPV", "CPE", "CPM"].includes(h) ? "money" : "text"
    ),
  };

  const addedValueSheet: StyledSheetConfig = {
    name: "Added Value",
    header: {
      title: "Added-value publication performance",
      entityLine: data.campaign.name,
      generatedAt: data.generatedAt,
    },
    columnHeaders: [headers],
    rows: addedValueRows,
    columnFormats: headers.map((h) =>
      h === "ER %" ? "percent" : ["Cost", "CPV", "CPE", "CPM"].includes(h) ? "money" : "text"
    ),
  };

  return buildStyledExcelBuffer([summarySheet, publicationsSheet, addedValueSheet]);
}