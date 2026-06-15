import * as XLSX from "xlsx";
import { readFileSync, writeFileSync } from "fs";

const EXCEL_PATH =
  "c:\\Users\\X13 Yoga G3\\Documents\\Thinway\\Thinkway Intelligence Engine\\data 2023 - 2026.xlsx";

function inferType(values) {
  const nonNull = values.filter((v) => v != null && v !== "");
  if (nonNull.length === 0) return "empty";
  const nums = nonNull.filter((v) => typeof v === "number" || (!isNaN(Number(v)) && String(v).trim() !== ""));
  const dates = nonNull.filter((v) => v instanceof Date || (typeof v === "number" && v > 40000 && v < 60000));
  if (dates.length / nonNull.length > 0.5) return "date";
  if (nums.length / nonNull.length > 0.7) return "number";
  return "string";
}

function sampleValues(values, n = 5) {
  const seen = new Set();
  const out = [];
  for (const v of values) {
    if (v == null || v === "") continue;
    const key = typeof v === "object" ? String(v) : JSON.stringify(v);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v instanceof Date ? v.toISOString().slice(0, 10) : v);
    if (out.length >= n) break;
  }
  return out;
}

function analyzeSheet(ws, name) {
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false, dateNF: "yyyy-mm-dd" });
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const headers = (rawRows[0] || []).map((h) => (h == null ? "" : String(h).trim()));
  const dataRows = rows.length;

  const colStats = {};
  for (const h of headers) {
    if (!h) continue;
    colStats[h] = { missing: 0, values: [], nonEmpty: 0 };
  }

  for (const row of rows) {
    for (const h of headers) {
      if (!h) continue;
      const v = row[h];
      if (v == null || v === "") {
        colStats[h].missing++;
      } else {
        colStats[h].nonEmpty++;
        if (colStats[h].values.length < 200) colStats[h].values.push(v);
      }
    }
  }

  const columns = headers.filter(Boolean).map((h) => {
    const s = colStats[h];
    const missingPct = dataRows > 0 ? Math.round((s.missing / dataRows) * 1000) / 10 : 0;
    return {
      name: h,
      inferred_type: inferType(s.values),
      missing_count: s.missing,
      missing_pct: missingPct,
      non_empty: s.nonEmpty,
      samples: sampleValues(s.values),
    };
  });

  return { name, row_count: dataRows, column_count: headers.filter(Boolean).length, columns, headers };
}

function findDuplicates(rows, keyCols) {
  const map = new Map();
  for (const row of rows) {
    const key = keyCols.map((k) => String(row[k] ?? "").trim().toLowerCase()).join("|");
    if (!key || key === "|".repeat(keyCols.length - 1)) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  const dups = [...map.entries()].filter(([, c]) => c > 1);
  return { duplicate_keys: dups.length, top_duplicates: dups.sort((a, b) => b[1] - a[1]).slice(0, 10) };
}

const buf = readFileSync(EXCEL_PATH);
const wb = XLSX.read(buf, { type: "buffer", cellDates: true, dateNF: "yyyy-mm-dd" });

const report = {
  file: EXCEL_PATH,
  sheet_names: wb.SheetNames,
  sheets: [],
  quality: {},
  date_ranges: {},
};

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const sheet = analyzeSheet(ws, name);
  report.sheets.push(sheet);

  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });

  // Date range scan
  const dateCols = sheet.columns.filter((c) => c.inferred_type === "date" || /date|month|year|live|period/i.test(c.name));
  for (const col of dateCols) {
    const vals = rows.map((r) => r[col.name]).filter(Boolean);
    if (vals.length === 0) continue;
    const parsed = vals
      .map((v) => {
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
      })
      .filter(Boolean);
    if (parsed.length === 0) continue;
    parsed.sort((a, b) => a - b);
    report.date_ranges[`${name}::${col.name}`] = {
      min: parsed[0].toISOString().slice(0, 10),
      max: parsed[parsed.length - 1].toISOString().slice(0, 10),
      count: parsed.length,
    };
  }

  // Quality checks per sheet
  const q = {};
  const campaignCols = sheet.headers.filter((h) => /campaign|tw-|document|header/i.test(h));
  const influencerCols = sheet.headers.filter((h) => /influencer|vendor|creator|handle/i.test(h));
  const clientCols = sheet.headers.filter((h) => /client|legal|entity|group/i.test(h));
  const brandCols = sheet.headers.filter((h) => /brand/i.test(h));

  if (campaignCols.length) q.campaign_duplicates = findDuplicates(rows, [campaignCols[0]]);
  if (influencerCols.length) q.influencer_duplicates = findDuplicates(rows, [influencerCols[0]]);
  if (clientCols.length) q.client_name_variants = [...new Set(rows.map((r) => String(r[clientCols[0]] ?? "").trim()).filter(Boolean))].length;
  if (brandCols.length) q.brand_name_variants = [...new Set(rows.map((r) => String(r[brandCols[0]] ?? "").trim()).filter(Boolean))].length;

  // Naming inconsistency: trim/case variants
  if (influencerCols.length) {
    const col = influencerCols[0];
    const names = rows.map((r) => String(r[col] ?? "").trim()).filter(Boolean);
    const lowerMap = new Map();
    for (const n of names) {
      const k = n.toLowerCase();
      if (!lowerMap.has(k)) lowerMap.set(k, new Set());
      lowerMap.get(k).add(n);
    }
    const inconsistent = [...lowerMap.entries()].filter(([, s]) => s.size > 1);
    q.influencer_naming_inconsistencies = inconsistent.length;
    q.influencer_naming_examples = inconsistent.slice(0, 5).map(([k, s]) => ({ key: k, variants: [...s] }));
  }

  report.quality[name] = q;
}

writeFileSync("scripts/intelligence-excel-analysis.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  sheets: report.sheets.map((s) => ({ name: s.name, rows: s.row_count, cols: s.column_count })),
  total_sheets: report.sheet_names.length,
}, null, 2));
