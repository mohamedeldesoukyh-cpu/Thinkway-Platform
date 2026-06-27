/**
 * Enterprise client quotation HTML — cover, commercial grid, summary, terms, signatures.
 * Preview / Word / PDF share this renderer (puppeteer via vendor-io-pdf).
 */
import { QUOTATION_CLIENT_LABELS } from "@/features/quotations/constants";
import { THINKWAY_REPORT_STYLES } from "@/lib/reports/document/thinkway-report-styles";
import type { QuotationDocument } from "./quotation-document";
import { buildQuotationDocumentStyles } from "./quotation-document-styles";

function esc(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Inline amount + currency so EGP never wraps below the number. */
export function renderMoney(value: string): string {
  const dual = value.match(/^([\d,.\s]+)\s+(\w+)\s+\/\s+([\d,.\s]+)\s+(\w+)$/);
  if (dual) {
    return `<span class="money"><span class="money-primary">${esc(dual[1])} ${esc(dual[2])}</span><span class="money-sep">/</span><span class="money-amount">${esc(dual[3])}</span><span class="money-currency">${esc(dual[4])}</span></span>`;
  }
  const single = value.match(/^([\d,.\s]+)\s+(\w+)$/);
  if (single) {
    return `<span class="money"><span class="money-amount">${esc(single[1])}</span><span class="money-currency">${esc(single[2])}</span></span>`;
  }
  return esc(value);
}

function clientColumnCount(doc: QuotationDocument): number {
  return doc.audience === "internal" ? 12 : 9;
}

function renderRows(doc: QuotationDocument): string {
  const colspan = clientColumnCount(doc);
  if (!doc.rows.length) {
    return `<tr><td colspan="${colspan}" class="muted" style="text-align:center;padding:24px">No creators added yet.</td></tr>`;
  }
  return doc.rows
    .map((r) => {
      const internalCells =
        doc.audience === "internal"
          ? `<td class="num">${renderMoney(r.unitCost ?? "—")}</td>
        <td class="num" style="color:${r.gpColor}">${esc(r.gp ?? "—")}</td>
        <td class="num" style="color:${r.gpColor}">${esc(r.gpPct ?? "—")}</td>`
          : "";
      return `
      <tr class="avoid-break">
        <td class="creator">${esc(r.creator)}</td>
        <td>${esc(r.platform)}</td>
        <td class="num">${esc(r.followers)}</td>
        <td class="num">${esc(r.engagementRate)}</td>
        <td>${esc(r.country)}</td>
        <td>${esc(r.deliverables)}</td>
        ${internalCells}
        <td class="num">${renderMoney(r.clientCost)}</td>
        <td class="num">${renderMoney(r.af)}</td>
        <td class="num">${esc(r.afPct)}</td>
      </tr>`;
    })
    .join("");
}

function renderTableHead(doc: QuotationDocument): string {
  const internalHeaders =
    doc.audience === "internal"
      ? `<th class="num">Unit Cost</th><th class="num">GP</th><th class="num">GP%</th>`
      : "";
  return `
            <th>Creator</th><th>Platform</th><th class="num">Followers</th>
            <th class="num">ER</th><th>Country</th><th>Deliverables</th>
            ${internalHeaders}
            <th class="num">${esc(QUOTATION_CLIENT_LABELS.clientCost)}</th>
            <th class="num">${esc(QUOTATION_CLIENT_LABELS.agencyFee)}</th>
            <th class="num">${esc(QUOTATION_CLIENT_LABELS.agencyFeePct)}</th>`;
}

function renderDetailedSummaryRows(doc: QuotationDocument): string {
  const internalRows =
    doc.audience === "internal" && doc.summary.totalCost
      ? `<tr class="gp"><td>Total Cost</td><td class="num">${renderMoney(doc.summary.totalCost)}</td></tr>
          <tr class="gp"><td>Gross Profit</td><td class="num" style="color:${doc.summary.gpColor}">${esc(doc.summary.totalGpValue ?? "—")}</td></tr>
          <tr class="gp"><td>GP %</td><td class="num" style="color:${doc.summary.gpColor}">${esc(doc.summary.totalGpPct ?? "—")}</td></tr>`
      : "";
  return `${internalRows}
          <tr class="total"><td>${esc(QUOTATION_CLIENT_LABELS.totalAgencyFee)}</td><td class="num">${renderMoney(doc.summary.totalAf)}</td></tr>
          <tr class="sub"><td>${esc(QUOTATION_CLIENT_LABELS.totalClientCost)}</td><td class="num">${renderMoney(doc.summary.totalClientCost)}</td></tr>`;
}

function renderLumpSumSummaryRows(doc: QuotationDocument): string {
  return `
          <tr><td>${esc(QUOTATION_CLIENT_LABELS.lumpSumCost)}</td><td class="num">${renderMoney(doc.summary.totalClientCost)}</td></tr>
          <tr><td>${esc(QUOTATION_CLIENT_LABELS.totalAgencyFee)}</td><td class="num">${renderMoney(doc.summary.totalAf)}</td></tr>
          <tr class="total"><td>${esc(QUOTATION_CLIENT_LABELS.totalCost)}</td><td class="num">${renderMoney(doc.summary.grandTotal)}</td></tr>`;
}

function renderCreatorList(doc: QuotationDocument): string {
  if (!doc.rows.length) {
    return `<p class="report-note">No creators added yet.</p>`;
  }
  return `<ul class="creator-list">${doc.rows
    .map(
      (r) =>
        `<li class="avoid-break"><strong>${esc(r.creator)}</strong><span class="creator-meta">${esc(r.platform)} · ${esc(r.followers)} followers · ${esc(r.deliverables)}</span></li>`
    )
    .join("")}</ul>`;
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

function renderKpiGrid(kpis: QuotationDocument["commercialKpis"]): string {
  return `<div class="kpi-grid">${kpis
    .map(
      (k) => `
      <div class="kpi-card avoid-break">
        <label>${esc(k.label)}</label>
        <strong${k.valueColor ? ` style="color:${k.valueColor}"` : ""}>${renderMoney(k.value)}</strong>
      </div>`
    )
    .join("")}</div>`;
}

function renderCoverPage(doc: QuotationDocument): string {
  const statusClass = doc.isExpired ? "status-badge--expired" : "status-badge--active";
  const campaignDisplay =
    doc.campaignName === "—" ? doc.name : doc.campaignName;
  const investmentLabel =
    doc.template === "lump-sum"
      ? QUOTATION_CLIENT_LABELS.totalCost
      : QUOTATION_CLIENT_LABELS.clientInvestment;
  const investmentValue =
    doc.template === "lump-sum" ? doc.summary.grandTotal : doc.summary.totalClientCost;

  return `<section class="cover-page">
    <div class="cover-overlay">
      <div>
        <div class="cover-brand">THINK<span>WAY</span></div>
        <div class="cover-kicker">Client Quotation${doc.template === "lump-sum" ? " · Lump Sum" : ""}</div>
        <div class="cover-accent"></div>
        <h1 class="cover-title">${esc(doc.name)}</h1>
        <p class="cover-subtitle">${esc(doc.preparedForLine)}</p>
        <div class="cover-meta">
          <div><strong>Quotation No.:</strong> ${esc(doc.serial)}</div>
          <div><strong>Client:</strong> ${esc(doc.clientName)}</div>
          <div><strong>Brand:</strong> ${esc(doc.brandName)}</div>
          <div><strong>Campaign:</strong> ${esc(doc.campaignName)}</div>
          <div><strong>Issue Date:</strong> ${esc(doc.issueDateLabel)}</div>
          <div><strong>Valid Until:</strong> ${esc(doc.validityDateLabel)}</div>
          <div><strong>Prepared By:</strong> ${esc(doc.preparedByName)}</div>
          <div><strong>Version:</strong> ${esc(doc.version)} · <span class="status-badge ${statusClass}">${esc(doc.isExpired ? "Expired" : doc.statusLabel)}</span></div>
        </div>
        <div class="cover-kpi-row">
          <div class="cover-kpi avoid-break"><span class="label">Campaign</span><span class="value">${esc(campaignDisplay)}</span></div>
          <div class="cover-kpi avoid-break"><span class="label">Creators</span><span class="value">${doc.summary.creatorCount}</span></div>
          <div class="cover-kpi avoid-break"><span class="label">Est. Reach</span><span class="value">${esc(doc.summary.estimatedReach)}</span></div>
          <div class="cover-kpi avoid-break"><span class="label">${esc(investmentLabel)}</span><span class="value">${renderMoney(investmentValue)}</span></div>
        </div>
      </div>
      <div class="cover-footer">
        <span>Confidential · Thinkway Platform</span>
        <span>Issued ${esc(doc.issueDateLabel)}</span>
      </div>
    </div>
  </section>`;
}

function sectionLabel(num: string, title: string): string {
  return `<div class="section-label"><div class="num">${esc(num)}</div><div class="title">${esc(title)}</div></div>`;
}

function renderDetailedCommercialSection(doc: QuotationDocument, sectionNum: number): string {
  return `<div class="section avoid-break page-break" id="section-commercial">
      ${sectionLabel(String(sectionNum).padStart(2, "0"), "Commercial Summary")}
      ${renderKpiGrid(doc.commercialKpis.slice(0, 3))}
      ${doc.commercialKpis.length > 3 ? renderKpiGrid(doc.commercialKpis.slice(3)) : ""}
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>${renderTableHead(doc)}</tr>
          </thead>
          <tbody>${renderRows(doc)}</tbody>
        </table>
      </div>
      <div class="summary-box avoid-break">
        <table>${renderDetailedSummaryRows(doc)}</table>
      </div>
    </div>`;
}

function renderLumpSumCommercialSection(doc: QuotationDocument, sectionNum: number): string {
  return `<div class="section avoid-break page-break" id="section-commercial">
      ${sectionLabel(String(sectionNum).padStart(2, "0"), "Commercial Summary")}
      ${renderKpiGrid(doc.commercialKpis.slice(0, 3))}
      ${doc.commercialKpis.length > 3 ? renderKpiGrid(doc.commercialKpis.slice(3)) : ""}
      <div class="lump-sum-box avoid-break">
        <h4 class="lump-sum-heading">Included creators (${doc.summary.creatorCount})</h4>
        ${renderCreatorList(doc)}
      </div>
      <div class="summary-box avoid-break">
        <table>${renderLumpSumSummaryRows(doc)}</table>
      </div>
    </div>`;
}

export function buildQuotationHtml(doc: QuotationDocument): string {
  const generatedLabel = doc.issueDateLabel;
  let sectionNum = 1;

  const commercialSection =
    doc.template === "lump-sum"
      ? renderLumpSumCommercialSection(doc, sectionNum++)
      : renderDetailedCommercialSection(doc, sectionNum++);

  const notesSection = doc.notes
    ? `<div class="section avoid-break page-break" id="section-notes">
      ${sectionLabel(String(sectionNum++).padStart(2, "0"), "Notes")}
      <p class="report-note">${esc(doc.notes)}</p>
    </div>`
    : "";

  const termsSection = `<div class="section page-break" id="section-terms">
      ${sectionLabel(String(sectionNum++).padStart(2, "0"), "Terms & Conditions")}
      <ul class="terms-list">${renderTerms(doc)}</ul>
    </div>`;

  const acceptanceSection = `<div class="section page-break avoid-break" id="section-acceptance">
      ${sectionLabel(String(sectionNum).padStart(2, "0"), "Acceptance")}
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
    </div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(doc.serial)} — ${esc(doc.name)} — Thinkway</title>
<style>${THINKWAY_REPORT_STYLES}${buildQuotationDocumentStyles(generatedLabel)}</style>
</head>
<body class="quotation-report">
  <div class="page">
    ${renderCoverPage(doc)}
    <div class="report-body">
      ${commercialSection}
      ${notesSection}
      ${termsSection}
      ${acceptanceSection}
    </div>
    <div class="screen-footer">
      <div class="left">Confidential · <strong>Thinkway Platform</strong> · Issued ${esc(doc.issueDateLabel)}</div>
      <div class="badge">${esc(doc.serial)} · Client Quotation</div>
    </div>
  </div>
</body>
</html>`;
}
