import {
  audienceCountryLabel,
  brandSafetyMeta,
  categoriesLabel,
  formatCreatorCount,
  formatEngagementRate,
  thinkwayAiScore,
} from "@/lib/creators/creator-display-utils";

import type { CreatorCompareBundle } from "@/lib/creators/creator-compare-bundle";
import { formatGrowthRate } from "@/lib/creators/creator-compare-bundle";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type CompareRow = {
  label: string;
  cells: string[];
  bestIndexes: Set<number>;
};

function bestNumericIndexes(values: (number | null)[], higherIsBetter = true): Set<number> {
  const valid = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v != null && !Number.isNaN(x.v));
  if (valid.length < 2) return new Set();
  const target = higherIsBetter
    ? Math.max(...valid.map((x) => x.v))
    : Math.min(...valid.map((x) => x.v));
  return new Set(valid.filter((x) => x.v === target).map((x) => x.i));
}

function buildRows(bundle: CreatorCompareBundle): CompareRow[] {
  const entries = bundle.entries;
  const n = entries.length;

  const followers = entries.map((e) => e.creator.metrics.followers.value);
  const engagement = entries.map((e) => e.creator.metrics.engagement_rate.value);
  const avgViews = entries.map((e) => e.creator.metrics.avg_views.value);
  const aiScores = entries.map((e) => thinkwayAiScore(e.creator));
  const safety = entries.map((e) => e.creator.authenticity_score);
  const collabs = entries.map((e) => e.enrichment.previous_collaborations);
  const growth = entries.map((e) => e.enrichment.growth_rate_percent);

  const rowDefs: Array<{ label: string; cells: string[]; nums?: (number | null)[] }> = [
    {
      label: "Followers",
      cells: followers.map((v) => formatCreatorCount(v)),
      nums: followers,
    },
    {
      label: "Engagement Rate",
      cells: engagement.map((v) => formatEngagementRate(v)),
      nums: engagement,
    },
    {
      label: "Average Views",
      cells: avgViews.map((v) => formatCreatorCount(v)),
      nums: avgViews,
    },
    {
      label: "Audience Country",
      cells: entries.map((e) => audienceCountryLabel(e.creator)),
    },
    {
      label: "Audience Gender",
      cells: entries.map((e) => e.enrichment.audience_gender),
    },
    {
      label: "Audience Age",
      cells: entries.map((e) => e.enrichment.audience_age),
    },
    {
      label: "Categories",
      cells: entries.map((e) => categoriesLabel(e.creator)),
    },
    {
      label: "Brand Safety",
      cells: entries.map((e) => brandSafetyMeta(e.creator.authenticity_score).label),
      nums: safety,
    },
    {
      label: "AI Score",
      cells: aiScores.map((v) => (v != null ? String(Math.round(v)) : "—")),
      nums: aiScores,
    },
    {
      label: "Estimated Pricing",
      cells: entries.map((e) => e.enrichment.estimated_pricing),
    },
    {
      label: "Previous Collaborations",
      cells: collabs.map((v) => String(v)),
      nums: collabs,
    },
    {
      label: "Growth Rate",
      cells: growth.map((v) => formatGrowthRate(v)),
      nums: growth,
    },
  ];

  return rowDefs.map((row) => ({
    label: row.label,
    cells: row.cells,
    bestIndexes: row.nums ? bestNumericIndexes(row.nums) : new Set<number>(),
  }));
}

export function renderCreatorCompareHtml(bundle: CreatorCompareBundle): string {
  const entries = bundle.entries;
  const rows = buildRows(bundle);
  const colWidth = `${Math.floor(100 / Math.max(entries.length, 1))}%`;

  const headerCells = entries
    .map((entry) => {
      const p = entry.creator.platforms[0];
      const handle = p?.handle ? `@${p.handle.replace(/^@/, "")}` : "";
      return `<th style="width:${colWidth};padding:12px 8px;text-align:left;border-bottom:2px solid #E6EAF2;">
        <div style="font-size:13px;font-weight:700;color:#0B0F1A;">${esc(entry.creator.display_name)}</div>
        <div style="font-size:10px;color:#9099A8;margin-top:2px;">${esc(handle)}</div>
      </th>`;
    })
    .join("");

  const bodyRows = rows
    .map((row) => {
      const cells = row.cells
        .map((cell, i) => {
          const highlight = row.bestIndexes.has(i);
          const bg = highlight ? "background:#EEF4FF;" : "";
          const color = highlight ? "color:#0057FF;font-weight:700;" : "color:#0B0F1A;";
          return `<td style="padding:10px 8px;border-bottom:1px solid #E6EAF2;font-size:11px;${bg}${color}">${esc(cell)}</td>`;
        })
        .join("");
      return `<tr>
        <th style="padding:10px 8px;text-align:left;border-bottom:1px solid #E6EAF2;font-size:10px;font-weight:600;color:#9099A8;text-transform:uppercase;white-space:nowrap;background:#FAFBFD;">${esc(row.label)}</th>
        ${cells}
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Thinkway Creator Comparison</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 0; padding: 24px; color: #0B0F1A; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { font-size: 11px; color: #9099A8; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
  </style>
</head>
<body>
  <h1>Creator Comparison</h1>
  <p class="meta">Thinkway · ${entries.length} creator${entries.length === 1 ? "" : "s"} · Generated ${new Date().toLocaleString()}</p>
  <table>
    <thead><tr>
      <th style="width:140px;padding:12px 8px;text-align:left;border-bottom:2px solid #E6EAF2;background:#FAFBFD;"></th>
      ${headerCells}
    </tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;
}
