/**
 * Enterprise client quotation HTML — cover, commercial grid, summary, terms, signatures.
 * Preview / Word / PDF share this renderer (puppeteer via vendor-io-pdf).
 */
import { QUOTATION_CLIENT_LABELS } from "@/features/quotations/constants";
import type { QuotationDocument } from "./quotation-document";
import { QUOTATION_DOCUMENT_CSS } from "./quotation-document-styles";

function esc(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderRows(doc: QuotationDocument): string {
  if (!doc.rows.length) {
    return `<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:24px">No creators added yet.</td></tr>`;
  }
  return doc.rows
    .map(
      (r) => `
      <tr class="avoid-break">
        <td class="creator">${esc(r.creator)}</td>
        <td>${esc(r.platform)}</td>
        <td class="num">${esc(r.followers)}</td>
        <td class="num">${esc(r.engagementRate)}</td>
        <td>${esc(r.country)}</td>
        <td>${esc(r.deliverables)}</td>
        <td class="num">${esc(r.unitCost)}</td>
        <td class="num">${esc(r.revenue)}</td>
        <td class="num" style="color:${r.gpColor}">${esc(r.gp)}</td>
        <td class="num" style="color:${r.gpColor}">${esc(r.gpPct)}</td>
      </tr>`
    )
    .join("");
}

function renderTerms(doc: QuotationDocument): string {
  return doc.termsSections
    .map(
      (t) => `
      <li class="avoid-break">
        <h4>${esc(t.title)}</h4>
        <p>${esc(t.body)}</p>
      </li>`
    )
    .join("");
}

function renderKpiStrip(kpis: QuotationDocument["commercialKpis"]): string {
  return kpis
    .map(
      (k) => `
      <div class="kpi avoid-break">
        <div class="label">${esc(k.label)}</div>
        <div class="value"${k.valueColor ? ` style="color:${k.valueColor}"` : ""}>${esc(k.value)}</div>
      </div>`
    )
    .join("");
}

export function buildQuotationHtml(doc: QuotationDocument): string {
  const statusBadge = doc.isExpired
    ? `<span class="badge badge-expired">Expired</span>`
    : `<span class="badge badge-status">${esc(doc.statusLabel)}</span>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(doc.serial)} — ${esc(doc.name)}</title>
<style>${QUOTATION_DOCUMENT_CSS}</style>
</head>
<body>
  <div class="doc">
    <!-- COVER -->
    <section class="cover avoid-break">
      <div class="cover-top">
        <div class="brand-mark">Thinkway<small>Influencer Marketing</small></div>
        <div class="confidential">Confidential</div>
      </div>
      <div class="cover-title">
        <h1>Client Quotation</h1>
        <p>${esc(doc.preparedForLine)}</p>
      </div>
      <div class="cover-meta-grid">
        <div class="meta-card"><div class="label">Quotation No.</div><div class="value">${esc(doc.serial)}</div></div>
        <div class="meta-card"><div class="label">Issue Date</div><div class="value">${esc(doc.issueDateLabel)}</div></div>
        <div class="meta-card"><div class="label">Valid Until</div><div class="value">${esc(doc.validityDateLabel)}</div></div>
        <div class="meta-card"><div class="label">Client</div><div class="value">${esc(doc.clientName)}</div></div>
        <div class="meta-card"><div class="label">Brand</div><div class="value">${esc(doc.brandName)}</div></div>
        <div class="meta-card"><div class="label">Campaign</div><div class="value">${esc(doc.campaignName)}</div></div>
        <div class="meta-card"><div class="label">Prepared By</div><div class="value">${esc(doc.preparedByName)}</div></div>
        <div class="meta-card"><div class="label">Reviewed By</div><div class="value">${esc(doc.reviewedByName)}</div></div>
        <div class="meta-card"><div class="label">Version / Status</div><div class="value">${esc(doc.version)} · ${statusBadge}</div></div>
        <div class="meta-card"><div class="label">Department</div><div class="value">${esc(doc.department)}</div></div>
        <div class="meta-card"><div class="label">Validity</div><div class="value">${esc(doc.validityLabel)}</div></div>
        <div class="meta-card"><div class="label">Document</div><div class="value">${esc(doc.name)}</div></div>
      </div>
      <div class="hero-kpis">
        <div class="hero-kpi avoid-break"><div class="label">Campaign</div><div class="value">${esc(doc.campaignName === "—" ? doc.name : doc.campaignName)}</div></div>
        <div class="hero-kpi avoid-break"><div class="label">Creators</div><div class="value">${doc.summary.creatorCount}</div></div>
        <div class="hero-kpi avoid-break"><div class="label">Est. Reach</div><div class="value">${esc(doc.summary.estimatedReach)}</div></div>
        <div class="hero-kpi avoid-break"><div class="label">${esc(QUOTATION_CLIENT_LABELS.clientInvestment)}</div><div class="value">${esc(doc.summary.totalRevenue)}</div></div>
      </div>
    </section>

    <!-- COMMERCIAL SUMMARY + GRID -->
    <section class="section page-break">
      <div class="section-head">
        <h2>Commercial Summary</h2>
        <span class="serial">${esc(doc.serial)}</span>
      </div>
      <div class="kpi-strip">${renderKpiStrip(doc.commercialKpis.slice(0, 3))}</div>
      <div class="kpi-strip">${renderKpiStrip(doc.commercialKpis.slice(3))}</div>

      <table class="data">
        <thead>
          <tr>
            <th>Creator</th><th>Platform</th><th class="num">Followers</th>
            <th class="num">ER</th><th>Country</th><th>Deliverables</th>
            <th class="num">Unit Cost</th><th class="num">${esc(QUOTATION_CLIENT_LABELS.clientCost)}</th>
            <th class="num">GP</th><th class="num">GP%</th>
          </tr>
        </thead>
        <tbody>${renderRows(doc)}</tbody>
      </table>

      <div class="summary-box avoid-break">
        <table>
          <tr><td>Total Cost</td><td class="num">${esc(doc.summary.totalCost)}</td></tr>
          <tr class="total"><td>${esc(QUOTATION_CLIENT_LABELS.totalClientCost)}</td><td class="num">${esc(doc.summary.totalRevenue)}</td></tr>
          <tr class="gp"><td>Gross Profit</td><td class="num" style="color:${doc.summary.gpColor}">${esc(doc.summary.totalGpValue)}</td></tr>
          <tr class="gp"><td>GP %</td><td class="num" style="color:${doc.summary.gpColor}">${esc(doc.summary.totalGpPct)}</td></tr>
        </table>
      </div>
    </section>

    ${
      doc.notes
        ? `<section class="section page-break avoid-break">
      <div class="section-head"><h2>Notes</h2></div>
      <p style="white-space:pre-wrap;font-size:10.5px">${esc(doc.notes)}</p>
    </section>`
        : ""
    }

    <!-- TERMS -->
    <section class="section page-break">
      <div class="section-head"><h2>Terms &amp; Conditions</h2></div>
      <ul class="terms-list">${renderTerms(doc)}</ul>
    </section>

    <!-- SIGNATURES -->
    <section class="section page-break avoid-break">
      <div class="section-head"><h2>Acceptance</h2></div>
      <div class="sign-grid">
        <div class="sign-slot">
          <div class="role">Prepared By — Thinkway</div>
          <div class="hint">Name: ${esc(doc.preparedByNameSignature ?? "_________________________")}<br/>Date: ${esc(doc.issueDateLabel)}</div>
        </div>
        <div class="sign-slot">
          <div class="role">Approved By Client</div>
          <div class="hint">Name: ${esc(doc.clientSignatureName ?? "_________________________")}<br/>Date: _________________________</div>
        </div>
      </div>
      <div class="revision-foot">${esc(doc.revisionLine)}</div>
    </section>
  </div>
</body>
</html>`;
}
