/**
 * Intelligence preload audit — parse Excel, compute quality/rankings/warehouse estimates.
 * No database writes.
 *
 * Run:
 *   npx tsx scripts/intelligence-etl/preload-audit.ts
 *   npm run intelligence:preload-audit
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { config } from "dotenv";
import * as XLSX from "xlsx";

import { buildBenchmarkAggregates } from "@/lib/intelligence/benchmarks/aggregate";
import {
  normalizeCampaignDocumentNumber,
  normalizeHandle,
  normalizeName,
} from "@/lib/intelligence/entity-resolution/normalize";
import {
  harmonizeCampaignRow,
  hashRow,
  normalizeCampaignKey,
  payloadFromRow,
} from "@/lib/intelligence/parsers/harmonize";
import {
  isCampaignDataRow,
  isDatabaseDataRow,
  stripEmoji,
} from "@/lib/intelligence/parsers/row-filter";
import type { HarmonizedCampaignRow, IntelligenceSheet } from "@/types/intelligence";

config({ path: ".env" });

const DEFAULT_EXCEL_PATH =
  "c:\\Users\\X13 Yoga G3\\Documents\\Thinway\\Thinkway Intelligence Engine\\data 2023 - 2026.xlsx";

const CAMPAIGN_SHEETS: IntelligenceSheet[] = ["2023", "2024", "2025", "2026"];
const OUTPUT_PATH = join(process.cwd(), "docs", "INTELLIGENCE_PRELOAD_AUDIT.md");

type SheetStat = { totalRows: number; filteredRows: number; removedRows: number };

type DuplicateSummary = {
  uniqueKeys: number;
  duplicateKeys: number;
  duplicateRows: number;
  topExamples: Array<{ key: string; count: number }>;
};

function loadWorkbook(path: string) {
  const buf = readFileSync(path);
  return XLSX.read(buf, { type: "buffer", cellDates: true, dateNF: "yyyy-mm-dd" });
}

function countDuplicates(keys: string[]): DuplicateSummary {
  const map = new Map<string, number>();
  for (const key of keys) {
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const entries = [...map.entries()];
  const duplicateEntries = entries.filter(([, count]) => count > 1);
  const duplicateRows = duplicateEntries.reduce((sum, [, count]) => sum + (count - 1), 0);
  return {
    uniqueKeys: entries.length,
    duplicateKeys: duplicateEntries.length,
    duplicateRows,
    topExamples: duplicateEntries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => ({ key, count })),
  };
}

function campaignDuplicateKey(row: HarmonizedCampaignRow): string | null {
  const camp = normalizeCampaignDocumentNumber(
    normalizeCampaignKey(row.source_campaign_key) ?? row.source_campaign_key
  );
  const code = row.source_line_key?.trim() ?? null;
  if (camp && code) return `camp_code:${camp}|${code.toLowerCase()}`;
  const name = normalizeName(row.campaign_name ?? row.source_campaign_key);
  if (name) return `name:${name}`;
  return null;
}


function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function sanitizeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

function mdTable(headers: string[], rows: string[][]): string {
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const head = `| ${headers.join(" | ")} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}`;
}

function duplicateSection(label: string, summary: DuplicateSummary, rules: string): string {
  const examples =
    summary.topExamples.length > 0
      ? summary.topExamples.map((e) => `- \`${e.key}\` — ${e.count} rows`).join("\n")
      : "_None detected._";

  return `### ${label}

**Detection rules:** ${rules}

| Metric | Count |
| --- | ---: |
| Unique keys | ${formatNumber(summary.uniqueKeys)} |
| Keys with duplicates | ${formatNumber(summary.duplicateKeys)} |
| Extra rows (beyond first per key) | ${formatNumber(summary.duplicateRows)} |

**Top duplicate keys:**

${examples}
`;
}

function buildMarkdown(opts: {
  excelPath: string;
  generatedAt: string;
  sheetStats: Map<string, SheetStat>;
  sheetNames: string[];
  campaignDups: DuplicateSummary;
  influencerDups: DuplicateSummary;
  clientDups: DuplicateSummary;
  brandDups: DuplicateSummary;
  topClients: Array<{ name: string; group: string | null; revenue: number; cost: number; lines: number }>;
  topBrands: Array<{ name: string; client: string | null; revenue: number; cost: number; lines: number }>;
  topInfluencers: Array<{ name: string; revenue: number; cost: number; lines: number }>;
  warehouse: Record<string, number>;
  harmonizedCount: number;
  totalRevenue: number;
  totalCost: number;
}): string {
  const {
    excelPath,
    generatedAt,
    sheetStats,
    sheetNames,
    campaignDups,
    influencerDups,
    clientDups,
    brandDups,
    topClients,
    topBrands,
    topInfluencers,
    warehouse,
    harmonizedCount,
    totalRevenue,
    totalCost,
  } = opts;

  const totalRaw = [...sheetStats.values()].reduce((sum, s) => sum + s.totalRows, 0);
  const totalFiltered = [...sheetStats.values()].reduce((sum, s) => sum + s.filteredRows, 0);
  const totalRemoved = totalRaw - totalFiltered;

  const sheetRows = sheetNames.map((name) => {
    const stat = sheetStats.get(name) ?? { totalRows: 0, filteredRows: 0, removedRows: 0 };
    return [
      name,
      formatNumber(stat.totalRows),
      formatNumber(stat.removedRows),
      formatNumber(stat.filteredRows),
    ];
  });
  sheetRows.push(["**Total**", formatNumber(totalRaw), formatNumber(totalRemoved), formatNumber(totalFiltered)]);

  const clientRows = topClients.map((r, i) => [
    String(i + 1),
    sanitizeCell(r.name),
    sanitizeCell(r.group ?? "—"),
    formatUsd(r.revenue),
    formatUsd(r.cost),
    formatNumber(r.lines),
  ]);

  const brandRows = topBrands.map((r, i) => [
    String(i + 1),
    sanitizeCell(r.name),
    sanitizeCell(r.client ?? "—"),
    formatUsd(r.revenue),
    formatUsd(r.cost),
    formatNumber(r.lines),
  ]);

  const influencerRows = topInfluencers.map((r, i) => [
    String(i + 1),
    sanitizeCell(r.name),
    formatUsd(r.revenue),
    formatUsd(r.cost),
    formatNumber(r.lines),
  ]);

  const warehouseRows = Object.entries(warehouse).map(([table, count]) => [
    `\`${table}\``,
    formatNumber(count),
  ]);

  return `# Intelligence Preload Audit

> Generated ${generatedAt} from historical Excel workbook. **No database writes** — dry-run parse only.

**Source file:** \`${excelPath}\`

## Headline

| Metric | Value |
| --- | ---: |
| Harmonized campaign lines | ${formatNumber(harmonizedCount)} |
| Blank rows removed | ${formatNumber(totalRemoved)} (${totalRaw > 0 ? ((totalRemoved / totalRaw) * 100).toFixed(1) : "0"}% of raw) |
| Total revenue (harmonized) | ${formatUsd(totalRevenue)} |
| Total cost (harmonized) | ${formatUsd(totalCost)} |
| Duplicate campaign keys | ${formatNumber(campaignDups.duplicateKeys)} |
| Duplicate influencer keys | ${formatNumber(influencerDups.duplicateKeys)} |
| Est. warehouse rows (campaigns raw) | ${formatNumber(warehouse.historical_campaigns_raw)} |

---

## Data quality & volume

### Rows per sheet

Blank rows are layout padding removed by \`isCampaignDataRow\` / \`isDatabaseDataRow\` (rows without influencer, revenue, cost, or camp/code identity).

${mdTable(["Sheet", "Raw rows", "Blank rows removed", "Data rows kept"], sheetRows)}

${duplicateSection(
  "Duplicate campaigns",
  campaignDups,
  "Primary key = normalized \`Camp#\` + \`Code#\` via \`normalizeCampaignKey\` / \`normalizeCampaignDocumentNumber\`. Fallback = normalized \`Campaign Name\` (\`normalizeName\`: lowercase, trim, collapse whitespace, strip punctuation). Rows sharing a key are counted as duplicates."
)}

${duplicateSection(
  "Duplicate influencers",
  influencerDups,
  "Campaign sheets: \`normalizeName(INFLUENCER)\`. Database sheet: \`normalizeName(display)|normalizeHandle(username)\`. Duplicate = same normalized key on more than one row."
)}

${duplicateSection(
  "Duplicate clients",
  clientDups,
  "Key = \`normalizeName(group)|normalizeName(client)\` from harmonized \`Group Name\` + \`Client Name\`."
)}

${duplicateSection(
  "Duplicate brands",
  brandDups,
  "Key = \`normalizeName(brand)|normalizeName(client)\` from harmonized \`Brand\` + \`Client Name\`."
)}

---

## Rankings (harmonized filtered data)

Commercial fields: **revenue** = \`revenue_usd\` (Revenue ($) ROI / Revenue ($)); **cost** = \`cost_usd\` (Cost ($) / Our Cost ($)). Historical workbook has no UR/AF billable-base columns — rankings use revenue for client/brand spend and influencer revenue; cost shown for reference.

### Top 20 clients by spend (revenue)

${mdTable(["#", "Client", "Group", "Revenue (USD)", "Cost (USD)", "Lines"], clientRows)}

### Top 20 brands by spend (revenue)

${mdTable(["#", "Brand", "Client", "Revenue (USD)", "Cost (USD)", "Lines"], brandRows)}

### Top 50 influencers by revenue

${mdTable(["#", "Influencer", "Revenue (USD)", "Cost (USD)", "Lines"], influencerRows)}

---

## Warehouse load estimates

Projected row counts after full ETL (\`scripts/intelligence-etl/run.ts\` logic, no truncate/dedup beyond upsert keys).

${mdTable(["Table", "Estimated rows"], warehouseRows)}

---

## Method

1. Parse workbook with \`xlsx\` (same options as ETL).
2. Filter blank layout rows per sheet.
3. Harmonize campaign rows (\`harmonizeCampaignRow\`).
4. Build dimension maps and fact tables in memory (mirrors ETL dry-run).
5. Aggregate benchmarks via \`buildBenchmarkAggregates\`.

Re-run:

\`\`\`bash
npm run intelligence:preload-audit
\`\`\`
`;
}

function main() {
  const excelPath = process.env.INTELLIGENCE_EXCEL_PATH?.trim() || DEFAULT_EXCEL_PATH;
  const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

  console.log(`[preload-audit] Reading ${excelPath}`);
  const wb = loadWorkbook(excelPath);
  const sheetStats = new Map<string, SheetStat>();

  for (const name of wb.SheetNames) {
    sheetStats.set(name, { totalRows: 0, filteredRows: 0, removedRows: 0 });
  }

  const harmonized: HarmonizedCampaignRow[] = [];
  let rawCampaignCount = 0;

  for (const sheet of CAMPAIGN_SHEETS) {
    if (!wb.SheetNames.includes(sheet)) continue;
    const ws = wb.Sheets[sheet];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
      raw: false,
      dateNF: "yyyy-mm-dd",
    });

    let kept = 0;
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      if (!isCampaignDataRow(row, sheet)) return;
      kept += 1;
      rawCampaignCount += 1;
      harmonized.push(harmonizeCampaignRow(sheet, row, rowNumber));
    });
    sheetStats.set(sheet, {
      totalRows: rows.length,
      filteredRows: kept,
      removedRows: rows.length - kept,
    });
    console.log(`[preload-audit] ${sheet}: ${kept}/${rows.length} data rows`);
  }

  const rawInfluencerRows: Array<Record<string, unknown>> = [];
  const influencerKeys: string[] = [];

  if (wb.SheetNames.includes("Database")) {
    const ws = wb.Sheets.Database;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: false });
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      if (!isDatabaseDataRow(row)) return;
      const payload = payloadFromRow(row);
      rawInfluencerRows.push({
        source_row_number: rowNumber,
        payload,
        row_hash: hashRow("Database", rowNumber, payload),
      });
      const display =
        String(row["Influencer NEW name"] ?? row["Influencer OLD Name"] ?? "").trim() || null;
      const username = String(row.Username ?? "").trim() || null;
      influencerKeys.push(`${normalizeName(display)}|${normalizeHandle(username)}`);
    });
    sheetStats.set("Database", {
      totalRows: rows.length,
      filteredRows: rawInfluencerRows.length,
      removedRows: rows.length - rawInfluencerRows.length,
    });
    console.log(`[preload-audit] Database: ${rawInfluencerRows.length}/${rows.length} vendor rows`);
  }

  for (const row of harmonized) {
    if (row.influencer_name_raw) {
      influencerKeys.push(`${normalizeName(row.influencer_name_raw)}|`);
    }
  }

  const campaignKeys = harmonized.map(campaignDuplicateKey).filter((k): k is string => Boolean(k));
  const clientKeys = harmonized
    .filter((r) => r.client_name_raw)
    .map((r) => `${normalizeName(r.group_name_raw)}|${normalizeName(r.client_name_raw)}`);
  const brandKeys = harmonized
    .filter((r) => r.brand_name_raw)
    .map((r) => `${normalizeName(r.brand_name_raw)}|${normalizeName(r.client_name_raw)}`);

  const campaignDups = countDuplicates(campaignKeys);
  const influencerDups = countDuplicates(influencerKeys);
  const clientDups = countDuplicates(clientKeys);
  const brandDups = countDuplicates(brandKeys);

  const clientSpend = new Map<string, { name: string; group: string | null; revenue: number; cost: number; lines: number }>();
  const brandSpend = new Map<string, { name: string; client: string | null; revenue: number; cost: number; lines: number }>();
  const influencerRevenue = new Map<string, { name: string; revenue: number; cost: number; lines: number }>();

  let totalRevenue = 0;
  let totalCost = 0;

  for (const row of harmonized) {
    const rev = row.revenue_usd ?? 0;
    const cost = row.cost_usd ?? 0;
    totalRevenue += rev;
    totalCost += cost;

    if (row.client_name_raw) {
      const key = `${normalizeName(row.group_name_raw)}|${normalizeName(row.client_name_raw)}`;
      const cur = clientSpend.get(key) ?? {
        name: row.client_name_raw,
        group: row.group_name_raw,
        revenue: 0,
        cost: 0,
        lines: 0,
      };
      cur.revenue += rev;
      cur.cost += cost;
      cur.lines += 1;
      clientSpend.set(key, cur);
    }

    if (row.brand_name_raw) {
      const key = `${normalizeName(row.brand_name_raw)}|${normalizeName(row.client_name_raw)}`;
      const cur = brandSpend.get(key) ?? {
        name: row.brand_name_raw,
        client: row.client_name_raw,
        revenue: 0,
        cost: 0,
        lines: 0,
      };
      cur.revenue += rev;
      cur.cost += cost;
      cur.lines += 1;
      brandSpend.set(key, cur);
    }

    if (row.influencer_name_raw) {
      const key = normalizeName(row.influencer_name_raw);
      const cur = influencerRevenue.get(key) ?? {
        name: row.influencer_name_raw,
        revenue: 0,
        cost: 0,
        lines: 0,
      };
      cur.revenue += rev;
      cur.cost += cost;
      cur.lines += 1;
      influencerRevenue.set(key, cur);
    }
  }

  const topClients = [...clientSpend.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 20);
  const topBrands = [...brandSpend.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 20);
  const topInfluencers = [...influencerRevenue.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 50);

  const clientMap = new Map<string, string>();
  const brandMap = new Map<string, string>();
  const influencerMap = new Map<string, string>();
  let intClients = 0;
  let intBrands = 0;
  let intInfluencers = 0;
  let intMarginHistory = 0;
  let intPricingHistory = 0;

  for (const row of harmonized) {
    if (row.client_name_raw) {
      const key = `${row.group_name_raw ?? ""}|${row.client_name_raw}`;
      if (!clientMap.has(key)) {
        clientMap.set(key, crypto.randomUUID());
        intClients += 1;
      }
    }
    if (row.brand_name_raw) {
      const key = `${row.brand_name_raw}|${row.client_name_raw ?? ""}`;
      if (!brandMap.has(key)) {
        brandMap.set(key, crypto.randomUUID());
        intBrands += 1;
      }
    }
    if (row.influencer_name_raw) {
      const key = `${row.influencer_name_raw}|`;
      if (!influencerMap.has(key)) {
        influencerMap.set(key, crypto.randomUUID());
        intInfluencers += 1;
      }
    }
    if (row.revenue_usd != null || row.cost_usd != null) intMarginHistory += 1;
    if (row.cost_usd != null && row.cost_usd > 0 && row.influencer_name_raw) intPricingHistory += 1;
  }

  if (wb.SheetNames.includes("Database")) {
    const ws = wb.Sheets.Database;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: false });
    for (const row of rows) {
      if (!isDatabaseDataRow(row)) continue;
      const display =
        String(row["Influencer NEW name"] ?? row["Influencer OLD Name"] ?? "").trim() || null;
      const username = String(row.Username ?? "").trim() || null;
      const key = `${display ?? ""}|${username ?? ""}`;
      if (!influencerMap.has(key)) {
        influencerMap.set(key, crypto.randomUUID());
        intInfluencers += 1;
      }
      const infId = influencerMap.get(key);
      if (!infId) continue;
      for (const col of ["New Rate", "NEW PACKAGES", "(old) rates for 1 ad"] as const) {
        const text = String(row[col] ?? "").trim();
        if (text) intPricingHistory += 1;
      }
    }
  }

  const influencerTierById = new Map<string, string | null>();
  const benchmarkInputs = harmonized.map((row) => {
    const influencerKey = `${row.influencer_name_raw ?? ""}|`;
    const infId = influencerMap.get(influencerKey);
    return {
      platform: row.channel ?? null,
      category: row.category_raw ?? null,
      market_entity: row.market_entity ?? null,
      tier: infId ? (influencerTierById.get(infId) ?? null) : null,
      period_year: row.period_year ?? null,
      cost_usd: row.cost_usd ?? null,
      revenue_usd: row.revenue_usd ?? null,
      margin_pct: row.margin_pct ?? null,
    };
  });
  const intBenchmarks = buildBenchmarkAggregates(benchmarkInputs).length;

  const warehouse = {
    historical_campaigns_raw: rawCampaignCount,
    historical_influencers_raw: rawInfluencerRows.length,
    int_campaigns: harmonized.length,
    int_clients: intClients,
    int_brands: intBrands,
    int_influencers: intInfluencers,
    int_pricing_history: intPricingHistory,
    int_margin_history: intMarginHistory,
    int_benchmarks: intBenchmarks,
  };

  const markdown = buildMarkdown({
    excelPath,
    generatedAt,
    sheetStats,
    sheetNames: wb.SheetNames,
    campaignDups,
    influencerDups,
    clientDups,
    brandDups,
    topClients,
    topBrands,
    topInfluencers,
    warehouse,
    harmonizedCount: harmonized.length,
    totalRevenue,
    totalCost,
  });

  writeFileSync(OUTPUT_PATH, markdown, "utf8");
  console.log(`[preload-audit] Wrote ${OUTPUT_PATH}`);
  console.log(
    JSON.stringify(
      {
        harmonized_lines: harmonized.length,
        blank_rows_removed: [...sheetStats.values()].reduce((s, x) => s + x.removedRows, 0),
        total_revenue_usd: Math.round(totalRevenue),
        total_cost_usd: Math.round(totalCost),
        warehouse,
      },
      null,
      2
    )
  );
}

main();
