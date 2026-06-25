/**
 * Branded HTML for quotation Preview, Word (.doc), and PDF (via puppeteer).
 * Matches VIO/CIO/Invoice export quality with the Thinkway palette (#1D9E75).
 */
import type { QuotationDocument } from "./quotation-document";

const BRAND = "#1D9E75";
const INK = "#1A1F36";
const MUTED = "#6B7280";

function esc(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildQuotationHtml(doc: QuotationDocument): string {
  const rows = doc.rows
    .map(
      (r) => `
      <tr>
        <td class="creator">${esc(r.creator)}</td>
        <td>${esc(r.platform)}</td>
        <td class="num">${esc(r.followers)}</td>
        <td class="num">${esc(r.engagementRate)}</td>
        <td>${esc(r.country)}</td>
        <td>${esc(r.deliverables)}</td>
        <td class="num">${esc(r.cost)}</td>
        <td class="num">${esc(r.revenue)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(doc.serial)} — ${esc(doc.name)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: ${INK}; margin: 0; }
  .doc { padding: 8px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${BRAND}; padding-bottom: 16px; margin-bottom: 20px; }
  .brand { font-size: 22px; font-weight: 800; color: ${BRAND}; letter-spacing: -0.5px; }
  .brand small { display: block; font-size: 11px; color: ${MUTED}; font-weight: 500; letter-spacing: 0.5px; }
  .doc-meta { text-align: right; font-size: 12px; color: ${MUTED}; }
  .doc-meta .serial { font-size: 16px; font-weight: 700; color: ${INK}; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .facts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 16px 0 22px; }
  .fact { background: #F8FAF9; border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px 12px; }
  .fact .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: ${MUTED}; }
  .fact .value { font-size: 13px; font-weight: 600; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  thead th { background: ${BRAND}; color: #fff; text-align: left; padding: 9px 8px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.4px; }
  tbody td { padding: 8px; border-bottom: 1px solid #EEF0F2; }
  td.num, th.num { text-align: right; }
  td.creator { font-weight: 600; }
  .summary { margin-top: 18px; display: flex; justify-content: flex-end; }
  .summary table { width: 320px; }
  .summary td { padding: 6px 8px; }
  .summary .total td { font-weight: 700; border-top: 2px solid ${BRAND}; }
  .summary .gp td { color: ${BRAND}; font-weight: 700; }
  .section { margin-top: 22px; }
  .section h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px; color: ${MUTED}; margin: 0 0 6px; }
  .section p { font-size: 12px; line-height: 1.5; white-space: pre-wrap; margin: 0; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; }
  .sign .slot { border-top: 1px solid ${INK}; padding-top: 6px; font-size: 11px; color: ${MUTED}; }
</style>
</head>
<body>
  <div class="doc">
    <div class="head">
      <div class="brand">Thinkway<small>INFLUENCER MARKETING</small></div>
      <div class="doc-meta">
        <div class="serial">${esc(doc.serial)}</div>
        <div>Client Quotation</div>
        <div>${esc(doc.dateLabel)}</div>
      </div>
    </div>

    <h1>${esc(doc.name)}</h1>

    <div class="facts">
      <div class="fact"><div class="label">Client</div><div class="value">${esc(doc.clientName)}</div></div>
      <div class="fact"><div class="label">Brand</div><div class="value">${esc(doc.brandName)}</div></div>
      <div class="fact"><div class="label">Campaign</div><div class="value">${esc(doc.campaignName)}</div></div>
      <div class="fact"><div class="label">Status</div><div class="value">${esc(doc.status)}</div></div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Creator</th><th>Platform</th><th class="num">Followers</th>
          <th class="num">ER</th><th>Country</th><th>Deliverables</th>
          <th class="num">Cost</th><th class="num">Revenue</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="8" style="text-align:center;color:${MUTED};padding:24px">No creators added yet.</td></tr>`}</tbody>
    </table>

    <div class="summary">
      <table>
        <tr><td>Total Cost</td><td class="num">${esc(doc.summary.totalCost)}</td></tr>
        <tr class="total"><td>Total Revenue</td><td class="num">${esc(doc.summary.totalRevenue)}</td></tr>
        <tr class="gp"><td>Gross Profit</td><td class="num">${esc(doc.summary.totalGpValue)}</td></tr>
        <tr class="gp"><td>GP %</td><td class="num">${esc(doc.summary.totalGpPct)}</td></tr>
      </table>
    </div>

    ${
      doc.notes
        ? `<div class="section"><h3>Notes</h3><p>${esc(doc.notes)}</p></div>`
        : ""
    }
    ${
      doc.terms
        ? `<div class="section"><h3>Terms &amp; Conditions</h3><p>${esc(doc.terms)}</p></div>`
        : ""
    }

    <div class="sign">
      <div class="slot">Prepared by${doc.preparedByName ? `: ${esc(doc.preparedByName)}` : ""}</div>
      <div class="slot">Client approval${doc.clientSignatureName ? `: ${esc(doc.clientSignatureName)}` : ""}</div>
    </div>
  </div>
</body>
</html>`;
}
