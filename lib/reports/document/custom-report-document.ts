import { CUSTOM_COLUMNS, formatCustomCell, type CustomColumn, type CustomReport, type CustomRow } from "../custom/custom-report";
import { statementCss, statementLogo } from "./statement-assets";
import { buildStyledExcelBuffer } from "./thinkway-report-excel";

const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export function parseCustomDocumentColumns(params: URLSearchParams): CustomColumn[] {
  const keys = [...new Set((params.get("columns") ?? "").split(","))].filter((key): key is CustomColumn => key !== "vat" && CUSTOM_COLUMNS.some(c => c.key === key));
  if (params.get("includeVat") === "1") keys.push("vat");
  return keys;
}
const notes = (report: CustomReport, keys: CustomColumn[]) => [
  "Actual = went-live activity. Acc. = not yet live. Total = actual + accrued. GP = revenue − cost.",
  keys.includes("vat") ? "Amounts exclude VAT. The separate VAT column shows total client VAT, including accrued activity." : "Amounts exclude VAT.",
  ...(report.currency === "Foreign" ? ["Original currencies are shown separately. Mixed-currency GP requires choosing a single display currency."] : []),
];

export function buildCustomReportHtml(report: CustomReport, keys: CustomColumn[], params: URLSearchParams): string {
  const columns = keys.map(key => CUSTOM_COLUMNS.find(c => c.key === key)!);
  const dense = columns.length > 10;
  const weight = (numeric: boolean) => numeric ? 1 : 1.5;
  const totalWeight = columns.reduce((sum, c) => sum + weight(c.numeric), 0);
  const colgroup = '<colgroup>' + columns.map(c => '<col style="width:' + (weight(c.numeric) / totalWeight * 100).toFixed(3) + '%">').join('') + '</colgroup>';
  const display = (value: CustomRow['cells'][CustomColumn]) => report.currency !== "Foreign" && value && typeof value === "object"
    ? Object.values(value).map(n => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })).join(" / ") || "—"
    : formatCustomCell(value);
  const firstText = columns.findIndex(c => !c.numeric);
  const cell = (row: CustomRow, total = false) => columns.map((c, i) => `<td class="${c.numeric ? "r num" : ""} ${c.accrued ? "accrued" : ""}">${esc(total && !c.numeric ? i === firstText ? "Totals" : "" : display(row.cells[c.key]))}</td>`).join("");
  const url = (format: string) => { const query = new URLSearchParams(params); query.set("format", format); query.set("download", "1"); return `/api/reports/custom/document?${query}`; };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Custom Report — Thinkway</title><style>${statementCss}
  .page{width:1123px;height:794px;margin:24px auto}.toolbar{position:sticky;top:0;z-index:2;display:flex;justify-content:center;gap:12px;flex-wrap:wrap;padding:12px;background:#050443;font:14px Arial}.toolbar a{background:white;color:#050443;padding:12px 18px;border-radius:6px;text-decoration:none}.toolbar a:focus-visible{outline:3px solid #ff7cc4;outline-offset:2px}.num{white-space:normal;overflow-wrap:anywhere}th,td{padding:${dense ? "6px 4px" : "8px 6px"}!important;font-size:${dense ? 9 : 11}px;overflow-wrap:anywhere}thead th{white-space:normal;letter-spacing:.5px}.accrued{background:#fff8e8}.totals td{font-weight:800;border-top:2px solid #080642;background:#f2f1f9}.to p{margin-top:7px}.band .doc h1{line-height:1.2}.page .body{padding:16px 24px 0}.band{padding:18px 24px}.band--compact{padding:12px 24px}.foot{left:24px;right:24px;bottom:16px}.parties{gap:18px}.to h2{font-size:16px}.to p{font-size:10px;line-height:1.4}.meta{font-size:10px;padding:8px 12px;gap:4px 12px}.sh{margin:16px 0 8px}.brand span{letter-spacing:1px}tr{break-inside:avoid}
  @page{size:A4 landscape;margin:0}@media print{.toolbar{display:none}html,body{width:297mm}.page{width:297mm;height:210mm;margin:0!important;zoom:1!important}}
  </style></head><body><nav class="toolbar" aria-label="Report downloads"><a href="${esc(url("pdf"))}">Download PDF</a><a href="${esc(url("xlsx"))}">Download Excel</a></nav>
  <section class="page"><header class="band"><div class="brand"><img src="${statementLogo}" alt="Thinkway"><span>Ideas. Influence. Impact.</span></div><div class="doc"><h1>Custom Report</h1><div class="ref"><b>CAMPAIGN FINANCIALS</b> · ${esc(report.currency)}</div></div></header>
  <div class="body"><div class="intro"><div class="parties"><div class="to"><span class="k">Financial report</span><h2>Actual &amp; accrued</h2>${notes(report, keys).map(note => `<p>${esc(note)}</p>`).join("")}</div><dl class="meta"><dt>Went live as of</dt><dd>${esc(report.asOf)}</dd><dt>Currency</dt><dd>${esc(report.currency)}</dd><dt>Campaigns</dt><dd>${report.rows.length}</dd><dt>VAT column</dt><dd>${keys.includes("vat") ? "Included" : "Not included"}</dd></dl></div></div>
  <div class="sh"><h3>Campaign details</h3><span>${columns.length} selected columns · ${report.currency === "Foreign" ? "Original currencies" : "All amounts in " + esc(report.currency)}</span></div><table aria-label="Custom report">${colgroup}<thead><tr>${columns.map(c => `<th scope="col" class="${c.numeric ? "r" : ""}">${esc(c.label)}</th>`).join("")}</tr></thead><tbody>${report.rows.map(row => `<tr>${cell(row)}</tr>`).join("") || `<tr class="empty"><td colspan="${columns.length}">No campaigns match this report.</td></tr>`}<tr class="totals" aria-label="Report totals">${cell(report.totals, true)}</tr></tbody></table></div>
  <footer class="foot"><span><b>Thinkway Platform</b> · Confidential</span><span>${esc(new Date().toLocaleString("en-GB", { timeZone: "Africa/Cairo" }))} Cairo</span><span class="page-number"></span></footer></section>
  <script>(async()=>{await document.fonts.ready; const original=document.querySelector('.page');let current=original;const rows=[...original.querySelectorAll('tbody tr')];rows.forEach(row=>row.remove());
  function next(){const page=original.cloneNode(true);page.querySelector('.intro')?.remove();page.querySelector('.band').classList.add('band--compact');page.querySelector('.sh h3').textContent='Campaign details, continued';page.querySelector('tbody').innerHTML='';current.after(page);current=page;}
  const fits=()=>current.querySelector('.body').getBoundingClientRect().bottom<=current.querySelector('.foot').getBoundingClientRect().top-18;
  for(const row of rows){current.querySelector('tbody').append(row);if(!fits()){row.remove();const previous=row.classList.contains('totals')?current.querySelector('tbody tr:last-child'):null;if(previous)previous.remove();next();if(previous)current.querySelector('tbody').append(previous);current.querySelector('tbody').append(row);}}
  const pages=[...document.querySelectorAll('.page')];pages.forEach((page,i)=>page.querySelector('.page-number').textContent='Page '+(i+1)+' of '+pages.length);function fitPreview(){const scale=Math.min(1,Math.max(.1,(document.documentElement.clientWidth-24)/1123));pages.forEach(page=>page.style.zoom=String(scale));}fitPreview();window.addEventListener('resize',fitPreview);document.documentElement.setAttribute('data-custom-report-ready','true');})();</script></body></html>`;
}

export async function buildCustomReportExcelBuffer(report: CustomReport, keys: CustomColumn[]) {
  const columns = keys.map(key => CUSTOM_COLUMNS.find(c => c.key === key)!);
  const firstText = columns.findIndex(c => !c.numeric);
  const values = (row: CustomRow, total = false) => columns.map((c, i) => {
    const value = row.cells[c.key];
    if (!c.numeric) return total ? i === firstText ? "Totals" : "" : String(value ?? "");
    if (report.currency !== "Foreign" && value && typeof value === "object") return value[report.currency] ?? null;
    return formatCustomCell(value);
  });
  return buildStyledExcelBuffer([{ name: "Custom report", header: { title: "Thinkway — Custom Report", generatedAt: new Date(), meta: [{ label: "Currency", value: report.currency }, { label: "Went live as of", value: report.asOf }, { label: "Campaigns", value: String(report.rows.length) }], notes: notes(report, keys) }, columnHeaders: [columns.map(c => c.label)], columnFormats: columns.map(c => c.numeric && report.currency !== "Foreign" ? "money" : "text"), accruedColumns: columns.flatMap((c, i) => c.accrued ? [i] : []), rows: [...report.rows.map(row => ({ values: values(row) })), { kind: "total", values: values(report.totals, true) }] }]);
}
