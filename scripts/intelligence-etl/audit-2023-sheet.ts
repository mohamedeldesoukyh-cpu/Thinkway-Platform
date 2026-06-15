/**
 * 2023 worksheet audit — parse Excel sheet `2023` only, no DB writes, no ETL.
 *
 * Run:
 *   npx tsx scripts/intelligence-etl/audit-2023-sheet.ts
 *   npm run intelligence:audit-2023
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { config } from "dotenv";
import * as XLSX from "xlsx";

import { harmonizeCampaignRow } from "@/lib/intelligence/parsers/harmonize";
import { parseMoney } from "@/lib/intelligence/parsers/money";
import { isCampaignDataRow } from "@/lib/intelligence/parsers/row-filter";

config({ path: ".env" });

const DEFAULT_EXCEL_PATH =
  "c:\\Users\\X13 Yoga G3\\Documents\\Thinway\\Thinkway Intelligence Engine\\data 2023 - 2026.xlsx";
const SHEET = "2023";
const OUTPUT_PATH = join(process.cwd(), "docs", "INTELLIGENCE_2023_AUDIT.md");

const REVENUE_PATTERNS = /revenue|rev\b|billable|client\s*fee|io\s*amount|sales|income|roi/i;
const COST_PATTERNS = /cost|our\s*cost|vendor|payment|fee\s*to|spend/i;
const MARGIN_PATTERNS = /margin|profit|markup|gp\b|gross/i;

const KEY_COLUMNS = [
  "Camp#",
  "Code#",
  "Campaign Name",
  "Month",
  "Entity",
  "INFLUENCER",
  "Revenue ($) ROI",
  "Revenue ($)",
  "Revenue",
  "Cost ($)",
  "Our Cost ($)",
  "our cost",
  "Profit ($)",
  "Profit Margin %",
  "Markup Margin %",
  "Date",
  "Add live date",
  "Channel",
  "Client Name",
  "Brand",
];

function loadWorkbook(path: string) {
  const buf = readFileSync(path);
  return XLSX.read(buf, { type: "buffer", cellDates: true, dateNF: "yyyy-mm-dd" });
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
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim().slice(0, 80);
}

function mdTable(headers: string[], rows: string[][]): string {
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const head = `| ${headers.join(" | ")} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}`;
}

function isNumericColumn(rows: Record<string, unknown>[], col: string): boolean {
  let numeric = 0;
  let checked = 0;
  for (const row of rows) {
    const v = row[col];
    if (v == null || v === "") continue;
    checked += 1;
    if (typeof v === "number" && Number.isFinite(v)) {
      numeric += 1;
      continue;
    }
    if (parseMoney(v) != null) numeric += 1;
  }
  return checked >= 3 && numeric / checked >= 0.5;
}

function sumColumn(rows: Record<string, unknown>[], col: string): { sum: number; nonNull: number } {
  let sum = 0;
  let nonNull = 0;
  for (const row of rows) {
    const parsed = parseMoney(row[col]);
    if (parsed == null) continue;
    nonNull += 1;
    sum += parsed;
  }
  return { sum: Math.round(sum * 100) / 100, nonNull };
}

function sampleValues(rows: Record<string, unknown>[], col: string, limit = 5): string[] {
  const samples: string[] = [];
  for (const row of rows) {
    const v = row[col];
    if (v == null || v === "") continue;
    const text = String(v).trim();
    if (!text) continue;
    if (samples.includes(text)) continue;
    samples.push(text);
    if (samples.length >= limit) break;
  }
  return samples;
}

function inspectHeaderRows(ws: XLSX.WorkSheet, maxRows = 5): string[][] {
  const ref = ws["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const out: string[][] = [];
  for (let r = range.s.r; r <= Math.min(range.s.r + maxRows - 1, range.e.r); r++) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      row.push(cell?.v != null ? String(cell.v).trim() : "");
    }
    out.push(row);
  }
  return out;
}

function classifyColumns(columns: string[]) {
  const revenue: string[] = [];
  const cost: string[] = [];
  const margin: string[] = [];
  for (const col of columns) {
    if (REVENUE_PATTERNS.test(col)) revenue.push(col);
    if (COST_PATTERNS.test(col)) cost.push(col);
    if (MARGIN_PATTERNS.test(col)) margin.push(col);
  }
  return { revenue, cost, margin };
}

function main() {
  const excelPath = process.env.INTELLIGENCE_EXCEL_PATH?.trim() || DEFAULT_EXCEL_PATH;
  const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

  console.log(`[audit-2023] Reading ${excelPath}`);
  const wb = loadWorkbook(excelPath);

  if (!wb.SheetNames.includes(SHEET)) {
    console.error(`Sheet "${SHEET}" not found. Available: ${wb.SheetNames.join(", ")}`);
    process.exit(1);
  }

  const ws = wb.Sheets[SHEET];
  const headerPreview = inspectHeaderRows(ws);

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: false,
    dateNF: "yyyy-mm-dd",
  });

  const allColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const filteredRows: Record<string, unknown>[] = [];
  const harmonizedRows: ReturnType<typeof harmonizeCampaignRow>[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (!isCampaignDataRow(row, SHEET)) return;
    filteredRows.push(row);
    harmonizedRows.push(harmonizeCampaignRow(SHEET, row, rowNumber));
  });

  const { revenue: revenueCols, cost: costCols, margin: marginCols } = classifyColumns(allColumns);

  // Compare with 2024 sheet column names
  let compare2024: string[] = [];
  if (wb.SheetNames.includes("2024")) {
    const ws2024 = wb.Sheets["2024"];
    const rows2024 = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws2024, {
      defval: null,
      raw: false,
    });
    if (rows2024.length > 0) compare2024 = Object.keys(rows2024[0]);
  }

  const revenue2024Cols = compare2024.filter((c) => REVENUE_PATTERNS.test(c));
  const missingIn2023 = revenue2024Cols.filter((c) => !allColumns.includes(c));
  const extraIn2023 = allColumns.filter((c) => REVENUE_PATTERNS.test(c) && !compare2024.includes(c));

  // Numeric columns that look like revenue but aren't named revenue
  const numericCandidates = allColumns.filter(
    (col) => !REVENUE_PATTERNS.test(col) && isNumericColumn(filteredRows, col)
  );

  const columnStats = (cols: string[]) =>
    cols.map((col) => {
      const { sum, nonNull } = sumColumn(filteredRows, col);
      const samples = sampleValues(filteredRows, col);
      return { col, nonNull, sum, samples };
    });

  const revenueStats = columnStats(revenueCols);
  const costStats = columnStats(costCols);
  const marginStats = columnStats(marginCols);

  // Current harmonizer revenue
  let currentRevenue = 0;
  let currentCost = 0;
  let rowsWithRevenue = 0;
  for (const h of harmonizedRows) {
    currentRevenue += h.revenue_usd ?? 0;
    currentCost += h.cost_usd ?? 0;
    if (h.revenue_usd != null && h.revenue_usd !== 0) rowsWithRevenue += 1;
  }

  // Find best revenue column candidate
  const revenueCandidates = [
    ...revenueStats,
    ...numericCandidates.map((col) => {
      const { sum, nonNull } = sumColumn(filteredRows, col);
      return { col, nonNull, sum, samples: sampleValues(filteredRows, col) };
    }),
  ].sort((a, b) => b.sum - a.sum);

  const topCandidate = revenueCandidates.find((c) => c.sum > 0 && c.nonNull > 0);
  const mappedCols = ["Revenue ($) ROI", "Revenue ($)"];
  const mappedPresent = mappedCols.filter((c) => allColumns.includes(c));
  const mappedStats = mappedCols.map((col) => ({
    col,
    present: allColumns.includes(col),
    ...sumColumn(filteredRows, col),
    samples: sampleValues(filteredRows, col),
  }));

  // Corrected revenue: use top revenue-pattern column with data, or best numeric candidate
  let correctedCol: string | null = null;
  let correctedRevenue = 0;
  const revenueWithData = revenueStats.filter((s) => s.nonNull > 0).sort((a, b) => b.sum - a.sum);
  if (revenueWithData.length > 0) {
    correctedCol = revenueWithData[0].col;
    correctedRevenue = revenueWithData[0].sum;
  } else if (topCandidate && topCandidate.sum > 0) {
    correctedCol = topCandidate.col;
    correctedRevenue = topCandidate.sum;
  }

  // Sample 100 rows — key columns only
  const presentKeyCols = KEY_COLUMNS.filter((c) => allColumns.includes(c));
  // Include actual revenue column even if spaced variant
  const revenueColActual = revenueStats.find((s) => s.nonNull > 0)?.col;
  const sampleCols = [
    ...new Set([
      "Campaign Name",
      "Month",
      "Entity",
      "INFLUENCER",
      revenueColActual ?? "Revenue ($) ROI",
      "our cost",
      "Cost ($)",
      "Date",
      "Channel",
      ...presentKeyCols,
    ]),
  ].filter((c) => allColumns.includes(c));
  const sampleRows = filteredRows.slice(0, 100).map((row) =>
    sampleCols.map((col) => {
      const v = row[col];
      if (v == null || v === "") return "—";
      return sanitizeCell(String(v));
    })
  );

  // Root cause analysis
  const spacedRevenueCol = allColumns.find((c) => c.trim() === "Revenue ($) ROI");
  const exactMatch2024 = allColumns.includes("Revenue ($) ROI");

  let rootCause: string;
  if (spacedRevenueCol && !exactMatch2024) {
    rootCause =
      `**Whitespace mismatch on header cell.** Excel row 1 displays \`Revenue ($) ROI\`, but xlsx reads the key as \`${spacedRevenueCol}\` ` +
      `(JSON: ${JSON.stringify(spacedRevenueCol)}). \`harmonizeCampaignRow\` looks up \`row["Revenue ($) ROI"]\` — exact key miss → \`undefined\` → revenue $0. ` +
      `Cost works because \`our cost\` matches exactly (harmonizer fallback \`row["our cost"]\`).`;
  } else if (mappedPresent.length === 0) {
    rootCause =
      `Sheet \`2023\` has no columns named \`Revenue ($) ROI\` or \`Revenue ($)\` — the only keys ` +
      `\`harmonizeCampaignRow\` reads for revenue. Revenue data exists under different column name(s): ` +
      `${revenueStats.filter((s) => s.nonNull > 0).map((s) => `\`${s.col}\``).join(", ") || "none detected"}.`;
  } else if (mappedStats.every((s) => s.nonNull === 0)) {
    rootCause =
      `Mapped revenue columns (${mappedPresent.map((c) => `\`${c}\``).join(", ")}) exist but are empty on all filtered data rows.`;
  } else {
    rootCause =
      `Mapped columns have data but \`parseMoney\` may fail on format, or rows are filtered out before harmonization.`;
  }

  const headerPreviewMd = headerPreview
    .map((row, i) => `**Row ${i + 1} (Excel):** ${row.filter(Boolean).slice(0, 20).join(" | ") || "_empty_"}`)
    .join("\n\n");

  const markdown = `# Intelligence 2023 Worksheet Audit

> Generated ${generatedAt}. **Read-only audit** — no ETL, no database writes.

**Source file:** \`${excelPath}\`  
**Sheet:** \`${SHEET}\`

---

## Executive summary

| Metric | Value |
| --- | ---: |
| Raw rows (xlsx) | ${formatNumber(rows.length)} |
| Data rows kept (\`isCampaignDataRow\`) | ${formatNumber(filteredRows.length)} |
| **Current harmonizer revenue** | ${formatUsd(currentRevenue)} |
| **Corrected revenue** (${correctedCol ? `\`${correctedCol}\`` : "n/a"}) | ${formatUsd(correctedRevenue)} |
| Harmonizer rows with non-zero revenue | ${formatNumber(rowsWithRevenue)} |
| Current harmonizer cost | ${formatUsd(currentCost)} |

### Root cause of $0 revenue in preload audit

${rootCause}

---

## Harmonizer mapping (from \`lib/intelligence/parsers/harmonize.ts\`)

\`harmonizeCampaignRow\` maps revenue as:

\`\`\`typescript
const revenue = parseMoney(row["Revenue ($) ROI"] ?? row["Revenue ($)"]);
\`\`\`

| Mapped column | Present in 2023? | Non-null rows | Sum (filtered) | Sample values |
| --- | --- | ---: | ---: | --- |
${mappedStats
  .map(
    (s) =>
      `| \`${s.col}\` | ${s.present ? "Yes" : "No"} | ${formatNumber(s.nonNull)} | ${formatUsd(s.sum)} | ${s.samples.map((v) => `\`${sanitizeCell(v)}\``).join(", ") || "—"} |`
  )
  .join("\n")}

**Recommended mapping for 2023:** ${correctedCol ? `\`${correctedCol}\`` : "_Unable to identify — see numeric candidates below_"}

**Why:** 2024 sheet uses ${revenue2024Cols.map((c) => `\`${c}\``).join(", ") || "standard revenue columns"}. Sheet 2023 ${missingIn2023.length > 0 ? `is missing: ${missingIn2023.map((c) => `\`${c}\``).join(", ")}` : "shares some names but values may differ"}.${extraIn2023.length > 0 ? ` 2023-only revenue-like columns: ${extraIn2023.map((c) => `\`${c}\``).join(", ")}.` : ""}

---

## Header inspection

xlsx \`sheet_to_json\` uses **row 1** as headers. First rows of raw sheet:

${headerPreviewMd}

---

## All columns detected (sheet \`2023\`, row 1 headers)

Total: **${allColumns.length}** columns

${allColumns.map((c, i) => `${i + 1}. \`${c}\` (JSON: ${JSON.stringify(c)})`).join("\n")}

---

## Revenue-related columns

${mdTable(
  ["Column", "Non-null count", "Sum (USD)", "Sample values"],
  revenueStats.map((s) => [
    `\`${s.col}\``,
    formatNumber(s.nonNull),
    formatUsd(s.sum),
    s.samples.map((v) => `\`${sanitizeCell(v)}\``).join(", ") || "—",
  ])
)}

---

## Cost-related columns

${mdTable(
  ["Column", "Non-null count", "Sum (USD)", "Sample values"],
  costStats.map((s) => [
    `\`${s.col}\``,
    formatNumber(s.nonNull),
    formatUsd(s.sum),
    s.samples.map((v) => `\`${sanitizeCell(v)}\``).join(", ") || "—",
  ])
)}

---

## Margin-related columns

${mdTable(
  ["Column", "Non-null count", "Sum (USD)", "Sample values"],
  marginStats.map((s) => [
    `\`${s.col}\``,
    formatNumber(s.nonNull),
    formatUsd(s.sum),
    s.samples.map((v) => `\`${sanitizeCell(v)}\``).join(", ") || "—",
  ])
)}

---

## Other numeric columns (revenue candidates)

Columns with ≥50% parseable money values that do not match revenue/cost/margin name patterns:

${mdTable(
  ["Column", "Non-null count", "Sum (USD)", "Sample values"],
  numericCandidates.slice(0, 15).map((col) => {
    const { sum, nonNull } = sumColumn(filteredRows, col);
    return [
      `\`${col}\``,
      formatNumber(nonNull),
      formatUsd(sum),
      sampleValues(filteredRows, col).map((v) => `\`${sanitizeCell(v)}\``).join(", ") || "—",
    ];
  })
)}

---

## 2024 column comparison (revenue fields)

| 2024 revenue column | In 2023? |
| --- | --- |
${revenue2024Cols.map((c) => `| \`${c}\` | ${allColumns.includes(c) ? "Yes" : "No"} |`).join("\n") || "| _none_ | — |"}

---

## Sample 100 data rows (key columns)

${sampleCols.length > 0 ? mdTable(sampleCols.map((c) => `\`${c}\``), sampleRows) : "_No key columns found._"}

---

## Method

1. Parse workbook with \`xlsx\` (same options as preload audit / ETL).
2. Filter with \`isCampaignDataRow(row, "2023")\`.
3. Harmonize with \`harmonizeCampaignRow\` (read-only — no code changes).
4. Sum revenue/cost/margin columns and compare to harmonizer output.

Re-run:

\`\`\`bash
npm run intelligence:audit-2023
\`\`\`
`;

  writeFileSync(OUTPUT_PATH, markdown, "utf8");
  console.log(`[audit-2023] Wrote ${OUTPUT_PATH}`);
  console.log(
    JSON.stringify(
      {
        raw_rows: rows.length,
        filtered_rows: filteredRows.length,
        columns: allColumns.length,
        current_revenue_usd: Math.round(currentRevenue),
        corrected_revenue_usd: Math.round(correctedRevenue),
        corrected_column: correctedCol,
        root_cause: rootCause,
      },
      null,
      2
    )
  );
}

main();
