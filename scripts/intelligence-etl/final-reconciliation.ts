/**
 * Final pre-ETL reconciliation — parse Excel, aggregate by sheet year, verify mappings.
 * No database writes. Set INTELLIGENCE_ETL_DRY_RUN=1 (recommended).
 *
 * Run:
 *   INTELLIGENCE_ETL_DRY_RUN=1 npm run intelligence:final-reconciliation
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { config } from "dotenv";
import * as XLSX from "xlsx";

import { harmonizeCampaignRow } from "@/lib/intelligence/parsers/harmonize";
import {
  buildNormalizedRowLookup,
  lookupValue,
  normalizeExcelHeader,
} from "@/lib/intelligence/parsers/header-normalize";
import { parseMoney } from "@/lib/intelligence/parsers/money";
import { parsePercent } from "@/lib/intelligence/parsers/percent";
import { isCampaignDataRow } from "@/lib/intelligence/parsers/row-filter";
import type { HarmonizedCampaignRow, IntelligenceSheet } from "@/types/intelligence";

config({ path: ".env" });

const DEFAULT_EXCEL_PATH =
  "c:\\Users\\X13 Yoga G3\\Documents\\Thinway\\Thinkway Intelligence Engine\\data 2023 - 2026.xlsx";
const OUTPUT_PATH = join(process.cwd(), "docs", "INTELLIGENCE_FINAL_RECONCILIATION.md");

const CAMPAIGN_SHEETS: IntelligenceSheet[] = ["2023", "2024", "2025", "2026"];

const HARMONIZER_REVENUE_ALIASES = ["Revenue ($) ROI", "Revenue ($)"] as const;
const HARMONIZER_COST_ALIASES = ["Cost ($)", "Our Cost ($)", "our cost"] as const;
const HARMONIZER_GP_ALIASES = ["Profit ($)"] as const;
const HARMONIZER_MARGIN_ALIASES = ["Profit Margin %", "Markup Margin %"] as const;

const CONSUMED_REVENUE_NORMALIZED = new Set(
  HARMONIZER_REVENUE_ALIASES.map(normalizeExcelHeader)
);
const CONSUMED_COST_NORMALIZED = new Set(HARMONIZER_COST_ALIASES.map(normalizeExcelHeader));

const REVENUE_EXCLUDE_PATTERNS = /io\s*amount|curr/i;
const COST_EXCLUDE_PATTERNS = /io\s*amount|curr/i;

const REVENUE_PATTERNS = /revenue|rev\b|billable|client\s*fee|sales|income|roi/i;
const COST_PATTERNS = /cost|our\s*cost|vendor|payment|fee\s*to|spend/i;

type YearTotals = {
  lines: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number | null;
};

type VerificationResult = {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
};

type UnmappedColumn = {
  sheet: string;
  column: string;
  sum: number;
  nonNull: number;
};

type ParserFailure = {
  sheet: string;
  rowNumber: number;
  field: string;
  rawValue: string;
  critical: boolean;
};

const CRITICAL_PARSER_FIELDS = new Set(["revenue_usd", "cost_usd"]);

type DoubleCountRow = {
  sheet: string;
  rowNumber: number;
  columnsWithData: string[];
  harmonizedRevenue: number | null;
  wouldDoubleCountSum: number;
};

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

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

function mdTable(headers: string[], rows: string[][]): string {
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const head = `| ${headers.join(" | ")} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}`;
}

function passFail(pass: boolean): string {
  return pass ? "**PASS**" : "**FAIL**";
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

function resolveRevenueAlias(row: Map<string, unknown>): string | null {
  for (const alias of HARMONIZER_REVENUE_ALIASES) {
    const normalized = normalizeExcelHeader(alias);
    if (row.has(normalized)) return alias;
  }
  return null;
}

function resolveCostAlias(row: Map<string, unknown>): string | null {
  for (const alias of HARMONIZER_COST_ALIASES) {
    const normalized = normalizeExcelHeader(alias);
    if (row.has(normalized)) return alias;
  }
  return null;
}

function revenueColumnsWithData(row: Map<string, unknown>, allColumns: string[]): string[] {
  const hits: string[] = [];
  for (const col of allColumns) {
    if (!REVENUE_PATTERNS.test(col) || REVENUE_EXCLUDE_PATTERNS.test(col)) continue;
    const normalized = normalizeExcelHeader(col);
    const value = row.get(normalized);
    if (parseMoney(value) != null) hits.push(col);
  }
  return hits;
}

function findUnmappedColumns(
  sheet: string,
  filteredRows: Record<string, unknown>[],
  allColumns: string[],
  pattern: RegExp,
  excludePattern: RegExp,
  consumedNormalized: Set<string>
): UnmappedColumn[] {
  const out: UnmappedColumn[] = [];
  for (const col of allColumns) {
    if (!pattern.test(col) || excludePattern.test(col)) continue;
    if (consumedNormalized.has(normalizeExcelHeader(col))) continue;
    const { sum, nonNull } = sumColumn(filteredRows, col);
    if (nonNull > 0 && Math.abs(sum) > 0.01) {
      out.push({ sheet, column: col, sum, nonNull });
    }
  }
  return out;
}

function collectParserFailures(
  sheet: IntelligenceSheet,
  row: Record<string, unknown>,
  rowNumber: number
): ParserFailure[] {
  const normalized = buildNormalizedRowLookup(row);
  const failures: ParserFailure[] = [];

  const checks: Array<{ field: string; aliases: readonly string[]; parser: (v: unknown) => number | null }> = [
    { field: "revenue_usd", aliases: HARMONIZER_REVENUE_ALIASES, parser: parseMoney },
    { field: "cost_usd", aliases: HARMONIZER_COST_ALIASES, parser: parseMoney },
    { field: "gp_usd", aliases: HARMONIZER_GP_ALIASES, parser: parseMoney },
    { field: "margin_pct", aliases: ["Profit Margin %"], parser: parsePercent },
    { field: "markup_pct", aliases: ["Markup Margin %"], parser: parsePercent },
  ];

  for (const check of checks) {
    const raw = lookupValue(normalized, ...check.aliases);
    if (raw == null || raw === "") continue;
    const text = String(raw).trim();
    if (!text || /^n\/?a$/i.test(text) || text === "-") continue;
    if (check.parser(raw) == null) {
      failures.push({
        sheet,
        rowNumber,
        field: check.field,
        rawValue: text.slice(0, 60),
        critical: CRITICAL_PARSER_FIELDS.has(check.field),
      });
    }
  }

  return failures;
}

function buildMarkdown(opts: {
  excelPath: string;
  generatedAt: string;
  dryRun: boolean;
  yearTotals: Map<IntelligenceSheet, YearTotals>;
  grandTotal: YearTotals;
  verifications: VerificationResult[];
  unmappedRevenue: UnmappedColumn[];
  unmappedCost: UnmappedColumn[];
  parserFailures: ParserFailure[];
  doubleCountRows: DoubleCountRow[];
  sheetHarmonizeStats: Array<{ sheet: string; raw: number; filtered: number; harmonized: number; ok: boolean }>;
  harmonizedCount: number;
}): string {
  const {
    excelPath,
    generatedAt,
    dryRun,
    yearTotals,
    grandTotal,
    verifications,
    unmappedRevenue,
    unmappedCost,
    parserFailures,
    doubleCountRows,
    sheetHarmonizeStats,
    harmonizedCount,
  } = opts;

  const yearRows = CAMPAIGN_SHEETS.map((year) => {
    const t = yearTotals.get(year) ?? { lines: 0, revenue: 0, cost: 0, margin: 0, marginPct: null };
    return [
      year,
      formatNumber(t.lines),
      formatUsd(t.revenue),
      formatUsd(t.cost),
      formatUsd(t.margin),
      formatPct(t.marginPct),
    ];
  });
  yearRows.push([
    "**Total**",
    formatNumber(grandTotal.lines),
    formatUsd(grandTotal.revenue),
    formatUsd(grandTotal.cost),
    formatUsd(grandTotal.margin),
    formatPct(grandTotal.marginPct),
  ]);

  const verificationRows = verifications.map((v) => [v.label, passFail(v.pass), v.detail]);

  const sheetRows = sheetHarmonizeStats.map((s) => [
    s.sheet,
    formatNumber(s.raw),
    formatNumber(s.filtered),
    formatNumber(s.harmonized),
    s.ok ? "Yes" : "No",
  ]);

  const unmappedRevRows =
    unmappedRevenue.length > 0
      ? unmappedRevenue.map((u) => [
          u.sheet,
          `\`${u.column}\``,
          formatNumber(u.nonNull),
          formatUsd(u.sum),
        ])
      : [["—", "_None_", "—", "—"]];

  const unmappedCostRows =
    unmappedCost.length > 0
      ? unmappedCost.map((u) => [
          u.sheet,
          `\`${u.column}\``,
          formatNumber(u.nonNull),
          formatUsd(u.sum),
        ])
      : [["—", "_None_", "—", "—"]];

  const criticalParserFailures = parserFailures.filter((f) => f.critical);
  const nonCriticalParserFailures = parserFailures.filter((f) => !f.critical);
  const failuresByField = parserFailures.reduce<Record<string, number>>((acc, f) => {
    acc[f.field] = (acc[f.field] ?? 0) + 1;
    return acc;
  }, {});

  const parserFailSample = (criticalParserFailures.length > 0 ? criticalParserFailures : nonCriticalParserFailures)
    .slice(0, 20)
    .map((f) => [f.sheet, String(f.rowNumber), f.field, `\`${f.rawValue}\``]);

  const doubleCountSample = doubleCountRows.slice(0, 10).map((d) => [
    d.sheet,
    String(d.rowNumber),
    d.columnsWithData.map((c) => `\`${c}\``).join(", "),
    d.harmonizedRevenue != null ? formatUsd(d.harmonizedRevenue) : "—",
    formatUsd(d.wouldDoubleCountSum),
  ]);

  const allPass = verifications.every((v) => v.pass);

  return `# Intelligence Final Reconciliation (Pre-ETL Sign-Off)

> Generated ${generatedAt}. **Authoritative pre-ETL sign-off document** — analysis only, no database writes.
> Dry run: \`${dryRun ? "INTELLIGENCE_ETL_DRY_RUN=1" : "off"}\`

**Source file:** \`${excelPath}\`

**Related (superseded for sign-off):** [\`INTELLIGENCE_REVENUE_RECONCILIATION.md\`](./INTELLIGENCE_REVENUE_RECONCILIATION.md) · [\`INTELLIGENCE_PRELOAD_AUDIT.md\`](./INTELLIGENCE_PRELOAD_AUDIT.md)

---

## Sign-off status

| Overall | ${allPass ? "**READY FOR ETL**" : "**NOT READY — see failures below**"} |
| --- | --- |
| Harmonized campaign lines | ${formatNumber(harmonizedCount)} |
| Verification checks | ${verifications.filter((v) => v.pass).length}/${verifications.length} passed |

---

## Totals (harmonized, post header-normalize)

| Metric | Value |
| --- | ---: |
| **Revenue** | **${formatUsd(grandTotal.revenue)}** |
| **Cost** | **${formatUsd(grandTotal.cost)}** |
| **Margin (GP)** | **${formatUsd(grandTotal.margin)}** |
| **Margin %** | **${formatPct(grandTotal.marginPct)}** |

Commercial mapping: **revenue** = \`Revenue ($) ROI\` / \`Revenue ($)\` via \`lookupValue\` (first alias present in row); **cost** = \`Cost ($)\` / \`Our Cost ($)\` / \`our cost\`. Header normalization via \`normalizeExcelHeader\` resolves whitespace/punctuation variants (2023 fix).

---

## Revenue / cost / margin by source year (sheet tab)

Aggregated by \`source_sheet\` (2023–2026 campaign tabs). Margin = revenue − cost; margin % = margin ÷ revenue.

${mdTable(["Year", "Lines", "Revenue (USD)", "Cost (USD)", "Margin (USD)", "Margin %"], yearRows)}

---

## Verification (must pass for sign-off)

${mdTable(["Check", "Status", "Detail"], verificationRows)}

### Harmonizer revenue alias resolution

\`harmonizeCampaignRow\` picks **one** revenue column per row — first alias whose normalized header exists in the row:

\`\`\`typescript
parseMoney(lookupValue(normalized, "Revenue ($) ROI", "Revenue ($)"))
\`\`\`

Double-count audit: rows where multiple revenue-pattern columns hold parseable money are flagged if the sum of all such columns exceeds the single harmonized value (would indicate alias-order bug or duplicate counting risk).

${doubleCountRows.length === 0 ? "_No double-count risk rows detected._" : mdTable(["Sheet", "Row", "Revenue columns with data", "Harmonized revenue", "Sum if all counted"], doubleCountSample)}

${doubleCountRows.length > 10 ? `\n_Showing 10 of ${formatNumber(doubleCountRows.length)} flagged rows._\n` : ""}

---

## Unmapped revenue-like columns (with data)

Columns matching revenue name patterns, excluding harmonizer aliases and IO/local-currency fields:

${mdTable(["Sheet", "Column", "Non-null rows", "Sum (USD)"], unmappedRevRows)}

---

## Unmapped cost-like columns (with data)

Columns matching cost name patterns, excluding harmonizer aliases and IO/local-currency fields:

${mdTable(["Sheet", "Column", "Non-null rows", "Sum (USD)"], unmappedCostRows)}

---

## Parser failures (money / percent)

**Sign-off rule:** Only **revenue** and **cost** parse failures block ETL. Margin/markup/GP column misformats are non-blocking — harmonizer computes margin from revenue − cost when \`Profit Margin %\` fails (e.g. dollar amounts pasted into percent cells).

| Category | Count |
| --- | ---: |
| Critical (revenue / cost) | ${formatNumber(criticalParserFailures.length)} |
| Non-blocking (margin / markup / GP) | ${formatNumber(nonCriticalParserFailures.length)} |
| **Total raw parse attempts failed** | ${formatNumber(parserFailures.length)} |

${Object.keys(failuresByField).length > 0 ? `By field: ${Object.entries(failuresByField).map(([k, v]) => `\`${k}\` ${formatNumber(v)}`).join(" · ")}` : ""}

${parserFailures.length === 0 ? "_None detected._" : mdTable(["Sheet", "Row", "Field", "Raw value"], parserFailSample)}

${criticalParserFailures.length > 0 ? `### Critical revenue/cost failures (blocking)\n\n${mdTable(["Sheet", "Row", "Field", "Raw value"], criticalParserFailures.map((f) => [f.sheet, String(f.rowNumber), f.field, `\`${f.rawValue}\``]))}\n` : ""}

${(criticalParserFailures.length > 20 || nonCriticalParserFailures.length > 20) ? `\n_Showing 20 sample rows (${criticalParserFailures.length > 0 ? "critical" : "non-blocking"})._` : ""}

---

## Sheet harmonization

${mdTable(["Sheet", "Raw rows", "Filtered rows", "Harmonized rows", "Harmonized OK"], sheetRows)}

---

## Method

1. Parse workbook with \`xlsx\` (same options as ETL).
2. Filter blank layout rows via \`isCampaignDataRow\`.
3. Harmonize with \`harmonizeCampaignRow\` (post \`normalizeExcelHeader\` fix).
4. Aggregate revenue/cost/margin by \`source_sheet\` (2023–2026).
5. Scan all campaign sheets for revenue/cost-like columns not consumed by harmonizer.
6. Audit alias resolution — one canonical revenue field per row via \`lookupValue\`.
7. Collect parse failures on money/percent fields.

Re-run:

\`\`\`bash
INTELLIGENCE_ETL_DRY_RUN=1 npm run intelligence:final-reconciliation
\`\`\`

Do **not** run \`npm run intelligence:etl\` until this document shows all verification checks **PASS** and stakeholders sign off on headline totals.
`;
}

function main() {
  const excelPath = process.env.INTELLIGENCE_EXCEL_PATH?.trim() || DEFAULT_EXCEL_PATH;
  const dryRun = process.env.INTELLIGENCE_ETL_DRY_RUN === "1";
  const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

  console.log(`[final-reconciliation] Reading ${excelPath} (dry_run=${dryRun})`);
  const wb = loadWorkbook(excelPath);

  const yearTotals = new Map<IntelligenceSheet, YearTotals>();
  for (const year of CAMPAIGN_SHEETS) {
    yearTotals.set(year, { lines: 0, revenue: 0, cost: 0, margin: 0, marginPct: null });
  }

  const harmonized: HarmonizedCampaignRow[] = [];
  const unmappedRevenue: UnmappedColumn[] = [];
  const unmappedCost: UnmappedColumn[] = [];
  const parserFailures: ParserFailure[] = [];
  const doubleCountRows: DoubleCountRow[] = [];
  const sheetHarmonizeStats: Array<{
    sheet: string;
    raw: number;
    filtered: number;
    harmonized: number;
    ok: boolean;
  }> = [];

  let sheetMappingErrors = 0;

  for (const sheet of CAMPAIGN_SHEETS) {
    const sheetExists = wb.SheetNames.includes(sheet);
    if (!sheetExists) {
      sheetHarmonizeStats.push({ sheet, raw: 0, filtered: 0, harmonized: 0, ok: false });
      sheetMappingErrors += 1;
      console.error(`[final-reconciliation] Missing sheet: ${sheet}`);
      continue;
    }

    const ws = wb.Sheets[sheet];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
      raw: false,
      dateNF: "yyyy-mm-dd",
    });

    const allColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const filteredRows: Record<string, unknown>[] = [];
    let harmonizedCount = 0;
    let harmonizeOk = true;

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      if (!isCampaignDataRow(row, sheet)) return;
      filteredRows.push(row);

      try {
        const h = harmonizeCampaignRow(sheet, row, rowNumber);
        harmonized.push(h);
        harmonizedCount += 1;

        const normalized = buildNormalizedRowLookup(row);
        const revCols = revenueColumnsWithData(normalized, allColumns);
        if (revCols.length > 1) {
          const wouldSum = revCols.reduce((sum, col) => {
            const v = normalized.get(normalizeExcelHeader(col));
            return sum + (parseMoney(v) ?? 0);
          }, 0);
          const harmonizedRev = h.revenue_usd ?? 0;
          const resolvedAlias = resolveRevenueAlias(normalized);
          const resolvedVal = parseMoney(
            resolvedAlias ? lookupValue(normalized, resolvedAlias) : undefined
          );
          const expected = resolvedVal ?? harmonizedRev;
          if (Math.abs(wouldSum - expected) > 0.02 && wouldSum > expected + 0.02) {
            doubleCountRows.push({
              sheet,
              rowNumber,
              columnsWithData: revCols,
              harmonizedRevenue: h.revenue_usd,
              wouldDoubleCountSum: Math.round(wouldSum * 100) / 100,
            });
          }
        }

        parserFailures.push(...collectParserFailures(sheet, row, rowNumber));
      } catch (err) {
        harmonizeOk = false;
        sheetMappingErrors += 1;
        console.error(`[final-reconciliation] Harmonize error ${sheet} row ${rowNumber}:`, err);
      }
    });

    const yt = yearTotals.get(sheet)!;
    for (const h of harmonized.filter((r) => r.source_sheet === sheet)) {
      yt.lines += 1;
      yt.revenue += h.revenue_usd ?? 0;
      yt.cost += h.cost_usd ?? 0;
    }
    yt.margin = Math.round((yt.revenue - yt.cost) * 100) / 100;
    yt.marginPct = yt.revenue > 0 ? Math.round((yt.margin / yt.revenue) * 10000) / 100 : null;

    unmappedRevenue.push(...findUnmappedColumns(sheet, filteredRows, allColumns, REVENUE_PATTERNS, REVENUE_EXCLUDE_PATTERNS, CONSUMED_REVENUE_NORMALIZED));
    unmappedCost.push(...findUnmappedColumns(sheet, filteredRows, allColumns, COST_PATTERNS, COST_EXCLUDE_PATTERNS, CONSUMED_COST_NORMALIZED));

    sheetHarmonizeStats.push({
      sheet,
      raw: rows.length,
      filtered: filteredRows.length,
      harmonized: harmonizedCount,
      ok: harmonizeOk && harmonizedCount === filteredRows.length,
    });

    console.log(
      `[final-reconciliation] ${sheet}: ${harmonizedCount}/${filteredRows.length} harmonized · revenue ${formatUsd(yt.revenue)}`
    );
  }

  const grandTotal: YearTotals = { lines: 0, revenue: 0, cost: 0, margin: 0, marginPct: null };
  for (const t of yearTotals.values()) {
    grandTotal.lines += t.lines;
    grandTotal.revenue += t.revenue;
    grandTotal.cost += t.cost;
  }
  grandTotal.revenue = Math.round(grandTotal.revenue * 100) / 100;
  grandTotal.cost = Math.round(grandTotal.cost * 100) / 100;
  grandTotal.margin = Math.round((grandTotal.revenue - grandTotal.cost) * 100) / 100;
  grandTotal.marginPct =
    grandTotal.revenue > 0
      ? Math.round((grandTotal.margin / grandTotal.revenue) * 10000) / 100
      : null;

  const allSheetsHarmonized = sheetHarmonizeStats.every((s) => s.ok);
  const noUnmappedRevenue = unmappedRevenue.length === 0;
  const noUnmappedCost = unmappedCost.length === 0;
  const criticalParserFailures = parserFailures.filter((f) => f.critical);
  const nonCriticalParserFailures = parserFailures.filter((f) => !f.critical);
  const noParserFailures = criticalParserFailures.length === 0;
  const noDoubleCount = doubleCountRows.length === 0;

  const verifications: VerificationResult[] = [
    {
      id: "unmapped_revenue",
      label: "No unmapped revenue fields remain",
      pass: noUnmappedRevenue,
      detail: noUnmappedRevenue
        ? "All revenue-pattern columns with data map to harmonizer aliases or are excluded (IO/local currency)."
        : `${unmappedRevenue.length} column(s) with parseable revenue-like data not consumed: ${unmappedRevenue.map((u) => `${u.sheet}:\`${u.column}\` (${formatUsd(u.sum)})`).join("; ")}`,
    },
    {
      id: "unmapped_cost",
      label: "No unmapped cost fields remain",
      pass: noUnmappedCost,
      detail: noUnmappedCost
        ? "All cost-pattern columns with data map to harmonizer aliases or are excluded."
        : `${unmappedCost.length} column(s) with parseable cost-like data not consumed: ${unmappedCost.map((u) => `${u.sheet}:\`${u.column}\` (${formatUsd(u.sum)})`).join("; ")}`,
    },
    {
      id: "parser_failures",
      label: "No failed parsers (revenue/cost money parse failures)",
      pass: noParserFailures,
      detail: noParserFailures
        ? nonCriticalParserFailures.length > 0
          ? `Revenue and cost parse cleanly. ${formatNumber(nonCriticalParserFailures.length)} non-blocking margin/markup/GP format issue(s) — harmonizer uses computed margin fallback.`
          : "All harmonizer field values parsed successfully."
        : `${criticalParserFailures.length} revenue/cost parse failure(s) would lose commercial data.`,
    },
    {
      id: "sheet_mappings",
      label: "No failed sheet mappings (each sheet harmonizes successfully)",
      pass: allSheetsHarmonized && sheetMappingErrors === 0,
      detail:
        allSheetsHarmonized && sheetMappingErrors === 0
          ? `All ${CAMPAIGN_SHEETS.length} campaign sheets present; filtered row count = harmonized row count.`
          : `Sheet errors: ${sheetMappingErrors}; failed sheets: ${sheetHarmonizeStats.filter((s) => !s.ok).map((s) => s.sheet).join(", ") || "none"}`,
    },
    {
      id: "no_double_count",
      label: "No duplicate revenue columns counted twice (alias resolution)",
      pass: noDoubleCount,
      detail: noDoubleCount
        ? "One canonical revenue field per row via lookupValue alias order; no rows where summing all revenue columns would exceed harmonized value."
        : `${doubleCountRows.length} row(s) where multiple revenue columns hold data and sum exceeds harmonized pick.`,
    },
  ];

  const markdown = buildMarkdown({
    excelPath,
    generatedAt,
    dryRun,
    yearTotals,
    grandTotal,
    verifications,
    unmappedRevenue,
    unmappedCost,
    parserFailures,
    doubleCountRows,
    sheetHarmonizeStats,
    harmonizedCount: harmonized.length,
  });

  writeFileSync(OUTPUT_PATH, markdown, "utf8");
  console.log(`[final-reconciliation] Wrote ${OUTPUT_PATH}`);
  console.log(
    JSON.stringify(
      {
        dry_run: dryRun,
        harmonized_lines: harmonized.length,
        totals: {
          revenue_usd: Math.round(grandTotal.revenue),
          cost_usd: Math.round(grandTotal.cost),
          margin_usd: Math.round(grandTotal.margin),
          margin_pct: grandTotal.marginPct,
        },
        by_year: Object.fromEntries(
          CAMPAIGN_SHEETS.map((y) => {
            const t = yearTotals.get(y)!;
            return [y, { revenue: Math.round(t.revenue), cost: Math.round(t.cost), margin: Math.round(t.margin) }];
          })
        ),
        verifications: Object.fromEntries(verifications.map((v) => [v.id, v.pass])),
        parser_failures: {
          critical: criticalParserFailures.length,
          non_blocking: nonCriticalParserFailures.length,
        },
        all_pass: verifications.every((v) => v.pass),
      },
      null,
      2
    )
  );
}

main();
