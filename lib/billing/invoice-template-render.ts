import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { InvoiceDocumentData, InvoiceLineItemRow } from "@/lib/billing/invoice-document-types";
import { THINKWAY_AGENCY_DEFAULTS } from "@/lib/io/thinkway-agency-defaults";
import { formatMoneyDetail } from "@/lib/finance/currency-format";
import { applyThinkwayLogoToDocumentHtml } from "@/lib/reports/document/thinkway-report-logo";

const TEMPLATE_PATH = join(process.cwd(), "lib/billing/templates/Thinkway_Invoice_Template.html");

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function display(value: string | null | undefined, fallback = "——"): string {
  const trimmed = value?.trim();
  return trimmed ? escapeHtml(trimmed) : fallback;
}

function formatMoney(amount: number, currency: string): string {
  return formatMoneyDetail(amount, currency);
}

function formatMoneyAmount(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatShortDate(value: string | null): string {
  if (!value) return "——";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatLongDueDate(value: string | null): string {
  if (!value) return "——";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatCampaignPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return "——";
  return `${formatShortDate(start)} — ${formatShortDate(end)}`;
}

function formatTaxLabel(line: InvoiceLineItemRow): string {
  if (line.revenueVatExempt) return "Exempt";
  if (line.revenueVatPercent > 0) return `${line.revenueVatPercent}%`;
  return "—";
}

function renderLineItemRows(data: InvoiceDocumentData): string {
  if (data.lineItems.length === 0) {
    return `<tr><td colspan="5" class="muted">No line items on this invoice.</td></tr>`;
  }

  return data.lineItems
    .map((line) => {
      const sub = line.subDescription
        ? `<br><span style="font-size:11px;color:var(--muted);">${display(line.subDescription)}</span>`
        : "";
      return `
          <tr>
            <td class="desc">${display(line.description)}${sub}</td>
            <td>${line.quantity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="right">${formatMoneyAmount(line.revenueBeforeVat)}</td>
            <td class="right muted">${escapeHtml(formatTaxLabel(line))}</td>
            <td class="right">${formatMoneyAmount(line.lineTotal)}</td>
          </tr>`;
    })
    .join("");
}

export function loadInvoiceTemplate(): string {
  return readFileSync(TEMPLATE_PATH, "utf8");
}

export function renderInvoiceHtml(data: InvoiceDocumentData): string {
  let html = loadInvoiceTemplate();
  const agency = THINKWAY_AGENCY_DEFAULTS;
  const currency = data.currencyCode;
  const docNum = escapeHtml(data.documentNumber);
  const issueDate = formatShortDate(data.issueDate);
  const dueDateShort = formatShortDate(data.dueDate);
  const dueDateLong = formatLongDueDate(data.dueDate);
  const ioRef = display(data.campaign?.clientIoReferenceDisplay ?? "—");
  const poRef = display(data.campaign?.poReferenceDisplay ?? "—");
  const internalRef = display(data.campaign?.internalReference ?? "—");
  const clientName = display(data.client.billingName);
  const clientLegalName = display(data.client.legalName ?? data.client.name);
  const trn = display(data.client.vatNumber ?? data.client.taxId);
  const accountNumber = display(data.client.documentNumber);
  const paymentTerms = display(data.client.paymentTerms ?? agency.paymentSchedule);
  const vatPill = `VAT ${data.vatPercent}% Included`;

  html = html.replace(
    /<title>Tax Invoice — INV-\[NUMBER\] — Thinkway<\/title>/,
    `<title>Tax Invoice — ${docNum} — Thinkway</title>`
  );
  html = html.replace(/INV-\[NUMBER\]/g, docNum);

  html = html.replace(
    /<div class="meta-row"><strong>Invoice Date<\/strong> &nbsp; \[DATE\]<\/div>/,
    `<div class="meta-row"><strong>Invoice Date</strong> &nbsp; ${issueDate}</div>`
  );
  html = html.replace(
    /<div class="meta-row"><strong>Due Date<\/strong> &nbsp; \[DATE\]<\/div>/,
    `<div class="meta-row"><strong>Due Date</strong> &nbsp; ${dueDateShort}</div>`
  );
  html = html.replace(
    /<div class="meta-row"><strong>IO Reference<\/strong> &nbsp; VIO-2026-\[N\]<\/div>/,
    `<div class="meta-row"><strong>IO Reference</strong> &nbsp; ${ioRef}</div>`
  );
  html = html.replace(
    /<div class="meta-row"><strong>Internal Reference<\/strong> &nbsp; TW-2026-\[N\]<\/div>/,
    `<div class="meta-row"><strong>Internal Reference</strong> &nbsp; ${internalRef}</div>`
  );

  html = html.replace(
    /<div class="party-name">\[Client \/ Agency Name\]<\/div>/g,
    `<div class="party-name">${clientName}</div>`
  );
  html = html.replace(
    /\[Address Line 1\]<br>\s*\[City, Country\]<br>\s*<span class="trn">TRN: \[TAX REG NUMBER\]<\/span>/,
    [
      display(data.client.addressLine1),
      display(data.client.addressLine2 ?? data.client.cityCountry),
      `<span class="trn">TRN: ${trn}</span>`,
    ].join("<br>\n            ")
  );

  html = html.replace(
    /<div class="flabel">Invoice Date<\/div>\s*<div class="fvalue">\[DATE\]<\/div>/,
    `<div class="flabel">Invoice Date</div><div class="fvalue">${issueDate}</div>`
  );
  html = html.replace(
    /<div class="flabel">IO \/ PO Reference<\/div>\s*<div class="fvalue">VIO-2026-\[N\]<\/div>/,
    `<div class="flabel">IO / PO Reference</div><div class="fvalue">${poRef}</div>`
  );
  html = html.replace(
    /<div class="flabel">Account Number<\/div>\s*<div class="fvalue">\[ACCOUNT NO\.\]<\/div>/,
    `<div class="flabel">Account Number</div><div class="fvalue">${accountNumber}</div>`
  );
  html = html.replace(
    /<div class="flabel">Campaign \/ Project<\/div>\s*<div class="fvalue">\[Campaign Name\]<\/div>/,
    `<div class="flabel">Campaign / Project</div><div class="fvalue">${display(data.campaign?.name)}</div>`
  );
  html = html.replace(
    /<div class="flabel">Client<\/div>\s*<div class="fvalue">\[Client Name\]<\/div>/,
    `<div class="flabel">Client</div><div class="fvalue">${clientLegalName}</div>`
  );
  html = html.replace(
    /<div class="flabel">Campaign Period<\/div>\s*<div class="fvalue">\[FROM\] — \[TO\]<\/div>/,
    `<div class="flabel">Campaign Period</div><div class="fvalue">${formatCampaignPeriod(data.campaign?.startDate ?? null, data.campaign?.endDate ?? null)}</div>`
  );

  html = html.replace(
    /<th class="right">Unit Price \(EGP\)<\/th>/,
    `<th class="right">Unit Price (${escapeHtml(currency)})</th>`
  );
  html = html.replace(
    /<th class="right">Amount \(EGP\)<\/th>/,
    `<th class="right">Amount (${escapeHtml(currency)})</th>`
  );

  html = html.replace(
    /<table class="items-table">[\s\S]*?<tbody>[\s\S]*?<\/tbody>/,
    (table) =>
      table.replace(/<tbody>[\s\S]*?<\/tbody>/, `<tbody>${renderLineItemRows(data)}</tbody>`)
  );

  html = html.replace(
    `<span class="t-label">Subtotal</span>\n            <span class="t-amount">EGP [0,000.00]</span>`,
    `<span class="t-label">Subtotal</span>\n            <span class="t-amount">${formatMoney(data.subtotal, currency)}</span>`
  );
  html = html.replace(
    `<span class="t-label">VAT (14%)</span>\n            <span class="t-amount">EGP [0,000.00]</span>`,
    `<span class="t-label">VAT (${data.vatPercent}%)</span>\n            <span class="t-amount">${formatMoney(data.taxAmount, currency)}</span>`
  );

  const isEgp = currency.toUpperCase() === "EGP";
  const usdNote =
    !isEgp && data.usdEquivalent != null
      ? `USD Equivalent: ~USD ${formatMoneyAmount(data.usdEquivalent)}`
      : "";

  html = html.replace(
    `<div class="t-sub">[USD Equivalent: ~USD 0,000.00]</div>`,
    usdNote ? `<div class="t-sub">${escapeHtml(usdNote)}</div>` : `<div class="t-sub"></div>`
  );
  html = html.replace(
    `<div class="t-amount">EGP [0,000.00]</div>`,
    `<div class="t-amount">${formatMoney(data.total, currency)}</div>`
  );
  html = html.replace(
    `<div class="due-date">[DD Month YYYY]</div>`,
    `<div class="due-date">${dueDateLong}</div>`
  );

  html = html.replace(
    /<div class="pills">[\s\S]*?<\/div>/,
    `<div class="pills">
            <span class="pill"><span class="dot"></span>${paymentTerms}</span>
            <span class="pill"><span class="dot"></span>Bank Transfer Only</span>
            <span class="pill"><span class="dot"></span>${escapeHtml(vatPill)}</span>
          </div>`
  );

  html = html.replace(
    `<div class="af-value">[Client / Agency Name]</div>`,
    `<div class="af-value">${clientName}</div>`
  );
  html = html.replace(
    `<div class="af-value large">EGP [0,000.00]</div>`,
    `<div class="af-value large">${formatMoney(data.total, currency)}</div>`
  );
  html = html.replace(
    /<div class="advice-field">\s*<div class="af-label">Due Date<\/div>\s*<div class="af-value">\[DD Month YYYY\]<\/div>\s*<\/div>/,
    `<div class="advice-field">
          <div class="af-label">Due Date</div>
          <div class="af-value">${dueDateLong}</div>
        </div>`
  );

  if (isEgp) {
    html = html.replace(/<div class="conversion-note">[\s\S]*?<\/div>\s*/g, "");
  } else {
    html = html.replace(
      /All amounts are invoiced in Egyptian Pounds \(EGP\)/,
      `All amounts are invoiced in ${escapeHtml(currency)}`
    );
  }

  if (data.notes?.trim()) {
    html = html.replace(
      `<div class="conversion-note">`,
      `<div class="conversion-note" style="margin-bottom:12px;">`
    );
    html = html.replace(
      /(<div class="conversion-note"[\s\S]*?<\/div>)/,
      `$1\n      <div class="conversion-note"><span>&#9432;</span><span><strong>Notes:</strong> ${escapeHtml(data.notes.trim())}</span></div>`
    );
  }

  return applyThinkwayLogoToDocumentHtml(html);
}
