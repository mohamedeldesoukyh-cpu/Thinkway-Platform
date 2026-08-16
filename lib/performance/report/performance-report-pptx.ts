import {
  formatCompactCount,
  formatMoneyValue,
  formatPercent,
} from "@/lib/campaigns/performance-calculations";
import { resolvePublicationContentPreviewUrl } from "@/lib/performance/publication-preview";
import { buildOptionalCostMetricKpiRows } from "@/lib/performance/report/performance-report-cost-metrics";
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

const NAVY = "0A0F1E";
const BLUE = "0057FF";
const GREEN = "1D9E75";

export async function buildPerformanceReportPptxBuffer(
  data: PerformanceReportDocumentData
): Promise<Buffer> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.author = "Thinkway";
  pptx.company = "Thinkway";
  pptx.subject = "Campaign Performance Report";
  pptx.title = `${data.campaign.documentNumber} — ${data.campaign.name}`;

  const cover = pptx.addSlide();
  cover.background = { color: NAVY };
  cover.addText("THINKWAY", {
    x: 0.6,
    y: 0.5,
    w: 8,
    h: 0.6,
    fontSize: 28,
    bold: true,
    color: "FFFFFF",
  });
  cover.addText("Campaign Performance Report", {
    x: 0.6,
    y: 1.2,
    w: 8,
    h: 0.4,
    fontSize: 12,
    color: "8899BB",
  });
  cover.addText(data.campaign.name, {
    x: 0.6,
    y: 2.0,
    w: 8.5,
    h: 1.2,
    fontSize: 28,
    bold: true,
    color: "FFFFFF",
  });
  cover.addText(
    [
      `Client: ${data.campaign.clientName}`,
      data.campaign.brandName ? `Brand: ${data.campaign.brandName}` : null,
      `Campaign: ${data.campaign.documentNumber}`,
      `Generated: ${data.generatedAt.toLocaleDateString("en-GB")}`,
    ]
      .filter(Boolean)
      .join("\n"),
    { x: 0.6, y: 3.4, w: 8, h: 2, fontSize: 12, color: "C8D6F5" }
  );

  const summary = pptx.addSlide();
  summary.addText("Executive Summary", {
    x: 0.5,
    y: 0.4,
    w: 9,
    h: 0.5,
    fontSize: 22,
    bold: true,
    color: NAVY,
  });
  const cpeValues = data.bundle.publications
    .map((p) => p.cpe)
    .filter((v): v is number => v != null);
  const averageCpe =
    cpeValues.length > 0 ? cpeValues.reduce((a, b) => a + b, 0) / cpeValues.length : null;

  const summaryRows = [
    ["Creators", String(data.uniqueCreatorCount)],
    ["Publications", String(data.bundle.summary.agreed_publications)],
    ["AV creators", String(data.addedValueCreatorCount)],
    [
      "AV creator names",
      data.addedValueCreators.map((c) => c.name).join(", ") || "—",
    ],
    ["AV posts", String(data.bundle.summary.added_value_publications)],
    ["Reach", formatCompactCount(data.bundle.summary.total_reach)],
    [
      "Reach breakdown",
      `Actual ${formatCompactCount(data.bundle.summary.total_actual_reach)} · Forecast ${formatCompactCount(data.bundle.summary.total_forecast_reach)}`,
    ],
    ["Impressions", formatCompactCount(data.bundle.summary.total_impressions)],
    [
      "Impressions breakdown",
      `Actual ${formatCompactCount(data.bundle.summary.total_actual_impressions)} · Forecast ${formatCompactCount(data.bundle.summary.total_forecast_impressions)}`,
    ],
    ["Views", formatCompactCount(data.bundle.summary.total_views)],
    ["Engagements", formatCompactCount(data.bundle.summary.total_engagements)],
    ["Avg ER", formatPercent(data.bundle.summary.average_engagement_rate)],
    ...data.platformBenchmarks.map((b) => [
      `Avg ER · ${b.label}`,
      `${b.publicationCount} agreed · ${formatPercent(b.averageEr)}`,
    ]),
    ...buildOptionalCostMetricKpiRows([
      {
        label: "CPM",
        value: data.bundle.summary.average_cpm,
        formatted: formatMoneyValue(data.bundle.summary.average_cpm, data.campaign.currency),
      },
      {
        label: "CPV",
        value: data.bundle.summary.average_cpv,
        formatted: formatMoneyValue(data.bundle.summary.average_cpv, data.campaign.currency),
      },
      {
        label: "CPE",
        value: averageCpe,
        formatted: formatMoneyValue(averageCpe, data.campaign.currency),
      },
    ]),
  ];
  summary.addTable(
    [
      [
        { text: "Metric", options: { bold: true, fill: { color: NAVY }, color: "FFFFFF" } },
        { text: "Value", options: { bold: true, fill: { color: NAVY }, color: "FFFFFF" } },
      ],
      ...summaryRows.map(([label, value]) => [
        { text: label, options: { bold: false } },
        { text: value, options: { bold: false } },
      ]),
    ],
    { x: 0.5, y: 1.1, w: 9, fontSize: 11, border: { type: "solid", color: "E2E8F0", pt: 1 } }
  );

  const platform = pptx.addSlide();
  platform.addText("Platform Breakdown", {
    x: 0.5,
    y: 0.4,
    w: 9,
    h: 0.5,
    fontSize: 22,
    bold: true,
    color: NAVY,
  });
  if (data.bundle.charts.platform_split.length > 0) {
    platform.addChart(
      pptx.ChartType.bar,
      [
        {
          name: "Posts",
          labels: data.bundle.charts.platform_split.map((p) => p.label),
          values: data.bundle.charts.platform_split.map((p) => p.count),
        },
      ],
      { x: 0.5, y: 1.0, w: 9, h: 4.5, showLegend: false, chartColors: [BLUE, GREEN] }
    );
  }

  const topCreators = pptx.addSlide();
  topCreators.addText("Top Creators by Engagement", {
    x: 0.5,
    y: 0.4,
    w: 9,
    h: 0.5,
    fontSize: 22,
    bold: true,
    color: NAVY,
  });
  const creators = data.bundle.charts.top_creators_by_engagement.slice(0, 8);
  if (creators.length > 0) {
    topCreators.addChart(
      pptx.ChartType.bar,
      [
        {
          name: "Engagements",
          labels: creators.map((c) => c.name),
          values: creators.map((c) => c.engagements),
        },
      ],
      { x: 0.5, y: 1.0, w: 9, h: 4.5, barDir: "bar", showLegend: false, chartColors: [BLUE] }
    );
  }

  const { agreed: agreedPublications, addedValue: addedValuePublications } =
    partitionPublicationsByValueScope(data.bundle.publications);
  const publicationSlides = [...agreedPublications, ...addedValuePublications].slice(0, 12);
  let addedValueHeadingInserted = false;

  for (const pub of publicationSlides) {
    if (
      !addedValueHeadingInserted &&
      pub.value_scope === "added_value" &&
      addedValuePublications.length > 0
    ) {
      const divider = pptx.addSlide();
      divider.addText("Added Value", {
        x: 0.5,
        y: 2.2,
        w: 9,
        h: 0.6,
        fontSize: 32,
        bold: true,
        color: GREEN,
      });
      divider.addText(
        "Extra publications beyond the agreed assignment mix.",
        { x: 0.5, y: 2.9, w: 9, h: 0.4, fontSize: 14, color: "6B7280" }
      );
      divider.addText(
        `${addedValuePublications.length} publication${addedValuePublications.length === 1 ? "" : "s"}`,
        { x: 0.5, y: 3.4, w: 9, h: 0.35, fontSize: 12, color: GREEN }
      );
      addedValueHeadingInserted = true;
    }

    const slide = pptx.addSlide();
    slide.addText(pub.influencer_name ?? "Creator", {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.4,
      fontSize: 18,
      bold: true,
      color: NAVY,
    });
    slide.addText(
      `${publicationValueScopeLabel(pub.value_scope)} · ${pub.platform_label} · ${pub.publication_type_label} · ${pub.publication_date ?? "—"}`,
      { x: 0.5, y: 0.75, w: 9, h: 0.3, fontSize: 10, color: "6B7280" }
    );
    const imageUrl = resolvePublicationContentPreviewUrl(pub);
    if (imageUrl) {
      slide.addImage({ path: imageUrl, x: 0.5, y: 1.2, w: 4.5, h: 2.5 });
    }
    slide.addTable(
      [
        ["Views", formatCompactCount(pub.views)],
        ["Reach", formatCompactCount(pub.reach)],
        [
          "Reach source",
          pub.reach_source
            ? REACH_SOURCE_LABELS[(pub.reach_source as ReachSource) ?? "actual"] ?? pub.reach_source
            : "—",
        ],
        ["Impressions", formatCompactCount(pub.impressions)],
        [
          "Impressions source",
          pub.impressions_source
            ? IMPRESSIONS_SOURCE_LABELS[
                (pub.impressions_source as ImpressionsSource) ?? "actual"
              ] ?? pub.impressions_source
            : "—",
        ],
        ["Engagements", formatCompactCount(pub.total_engagements)],
        ["ER", formatPercent(pub.engagement_rate, 1)],
      ].map(([label, value]) => [
        { text: String(label), options: { bold: true } },
        { text: String(value), options: { bold: false } },
      ]),
      { x: 5.2, y: 1.2, w: 4.3, h: 2.5, fontSize: 11 }
    );
    if (pub.content_url) {
      slide.addText(
        [
          {
            text: "Open post → ",
            options: { bold: true, color: BLUE },
          },
          {
            text: pub.content_url,
            options: {
              color: BLUE,
              hyperlink: { url: pub.content_url },
            },
          },
        ],
        {
          x: 0.5,
          y: 4.0,
          w: 9,
          h: 0.4,
          fontSize: 9,
        }
      );
    }
    const captionExcerpt = pub.caption?.trim()
      ? pub.caption.trim().length > 140
        ? `${pub.caption.trim().slice(0, 140)}…`
        : pub.caption.trim()
      : null;
    if (captionExcerpt || pub.hashtags?.trim() || pub.mentions?.trim()) {
      slide.addText(
        [
          captionExcerpt ? `Caption: ${captionExcerpt}` : null,
          pub.hashtags?.trim() ? `Hashtags: ${pub.hashtags.trim()}` : null,
          pub.mentions?.trim() ? `Mentions: ${pub.mentions.trim()}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        { x: 0.5, y: 4.5, w: 9, h: 1.2, fontSize: 9, color: "6B7280" }
      );
    }
  }

  if (data.variant === "influencers") {
    for (const section of data.influencerSections) {
      const slide = pptx.addSlide();
      slide.addText(section.name, {
        x: 0.5,
        y: 0.4,
        w: 9,
        h: 0.5,
        fontSize: 22,
        bold: true,
        color: NAVY,
      });
      slide.addText(
        `${section.summary.agreedPublications} agreed · ${section.summary.addedValuePublications} added value · ${formatCompactCount(section.summary.views)} views · ${formatCompactCount(section.summary.reach)} reach · ${formatCompactCount(section.summary.impressions)} impressions · ${formatCompactCount(section.summary.engagements)} engagements · Avg ER ${formatPercent(section.summary.averageEr)}`,
        { x: 0.5, y: 1.0, w: 9, h: 0.4, fontSize: 12, color: "6B7280" }
      );
      const gallery = section.publications.slice(0, 4);
      gallery.forEach((pub, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const imageUrl = resolvePublicationContentPreviewUrl(pub);
        if (imageUrl) {
          slide.addImage({
            path: imageUrl,
            x: 0.5 + col * 4.7,
            y: 1.6 + row * 2.2,
            w: 4.3,
            h: 2.0,
          });
        }
      });
    }
  }

  const arrayBuffer = (await pptx.write({ outputType: "arraybuffer" })) as ArrayBuffer;
  return Buffer.from(arrayBuffer);
}
