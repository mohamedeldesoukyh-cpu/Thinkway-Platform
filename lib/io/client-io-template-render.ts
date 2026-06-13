import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  applyClientIoDocumentLayout,
  resolveClientIoDeliverableRows,
  type ClientIoDocumentLayout,
  type ClientIoPricingRow,
} from "@/lib/io/client-io-document-layout";
import type { ClientIoDocumentData } from "@/lib/io/client-io-document-types";
import { renderTermsListHtml } from "@/lib/io/client-io-terms";
import { THINKWAY_AGENCY_DEFAULTS } from "@/lib/io/thinkway-agency-defaults";

const TEMPLATE_PATH = join(process.cwd(), "lib/io/templates/Thinkway_Client_IO_Global.html");

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
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatted}`;
}

function formatDateRange(start: string | null, end: string | null): string {
  const fmt = (d: string | null) => {
    if (!d) return "[DATE]";
    const parsed = new Date(`${d}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return d;
    return parsed.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };
  return `From: ${fmt(start)} &nbsp;&nbsp; To: ${fmt(end)}`;
}

function formatIssuedMeta(issuedAt: string, country: string): string {
  const parsed = new Date(issuedAt);
  const monthYear = Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return `Issued: ${monthYear} &nbsp;·&nbsp; ${escapeHtml(country)}`;
}

function platformLabel(platform: string): string {
  const map: Record<string, string> = {
    twitter: "X (Twitter)",
    x: "X (Twitter)",
  };
  const key = platform.toLowerCase();
  if (map[key]) return map[key];
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

function renderDeliverableRows(
  data: ClientIoDocumentData,
  layout: ClientIoDocumentLayout
): string {
  const rows = resolveClientIoDeliverableRows(data, layout);

  if (rows.length === 0) {
    return `<tr><td colspan="6" class="muted">No deliverables on campaign assignment lines.</td></tr>`;
  }

  return rows
    .map(
      (row) => `
          <tr>
            <td><span class="platform">${display(row.influencerName)}</span></td>
            <td class="muted">${display(platformLabel(row.platform))}</td>
            <td class="muted">${display(row.deliverableType)}</td>
            <td>${row.quantity}</td>
            <td class="muted">${display(row.handle)}</td>
            <td class="muted">${display(row.scheduledDates)}</td>
          </tr>`
    )
    .join("");
}

function renderPricingRow(row: ClientIoPricingRow, currency: string): string {
  const variantClass =
    row.variant === "header"
      ? " header"
      : row.variant === "subtotal"
        ? " subtotal"
        : row.variant === "total"
          ? " total"
          : "";
  const amount =
    row.amount == null ? "" : `<span class="amount">${formatMoney(row.amount, currency)}</span>`;

  return `<div class="pricing-row${variantClass}">
          <span class="label">${escapeHtml(row.label)}</span>
          ${amount}
        </div>`;
}

function renderPricingSection(rows: ClientIoPricingRow[], currency: string): string {
  return rows.map((row) => renderPricingRow(row, currency)).join("\n        ");
}

export function loadClientIoTemplate(): string {
  return readFileSync(TEMPLATE_PATH, "utf8");
}

export function renderClientIoHtml(
  data: ClientIoDocumentData,
  layout: ClientIoDocumentLayout = "detailed"
): string {
  let html = loadClientIoTemplate();
  const agency = THINKWAY_AGENCY_DEFAULTS;
  const docNum = escapeHtml(data.documentNumber);
  const currency = data.currencyCode;
  const clientName = display(data.client.legalName ?? data.client.name);
  const { pricingRows } = applyClientIoDocumentLayout(data, layout);

  html = html.replace(
    /<title>Client Insertion Order — CIO-2026-\[NUMBER\] — Thinkway<\/title>/,
    `<title>Client Insertion Order — ${docNum} — Thinkway</title>`
  );
  html = html.replace(/CIO-2026-\[NUMBER\]/g, docNum);
  html = html.replace(
    /Issued: \[DATE\] &nbsp;·&nbsp; Egypt/,
    formatIssuedMeta(data.issuedAt, data.issuedCountry || agency.country)
  );

  // Section 1 — Parties
  html = html.replace(
    /<div class="flabel">Client \/ Advertiser<\/div>\s*<div class="fvalue empty">——<\/div>/,
    `<div class="flabel">Client / Advertiser</div><div class="fvalue">${clientName}</div>`
  );
  html = html.replace(
    /<div class="flabel">Client Trade License \/ CR<\/div>\s*<div class="fvalue empty">——<\/div>/,
    `<div class="flabel">Client Trade License / CR</div><div class="fvalue">${display(data.client.tradeLicense)}</div>`
  );
  html = html.replace(
    /<div class="flabel">Client Address<\/div>\s*<div class="fvalue empty">——<\/div>/,
    `<div class="flabel">Client Address</div><div class="fvalue">${display(data.client.address)}</div>`
  );
  html = html.replace(
    /<div class="flabel">Client Contact Person<\/div>\s*<div class="fvalue empty">——<\/div>/,
    `<div class="flabel">Client Contact Person</div><div class="fvalue">${display(data.client.contactPerson)}</div>`
  );
  html = html.replace(
    /<div class="flabel">Client Email<\/div>\s*<div class="fvalue empty">——<\/div>/,
    `<div class="flabel">Client Email</div><div class="fvalue">${display(data.client.email)}</div>`
  );
  html = html.replace(
    /<div class="flabel">Agency Contact<\/div>\s*<div class="fvalue">——<\/div>/,
    `<div class="flabel">Agency Contact</div><div class="fvalue">${display(data.agencyContact.fullName)}</div>`
  );

  // Section 2 — Campaign
  html = html.replace(
    /<div class="flabel">Client<\/div>\s*<div class="fvalue empty">——<\/div>/,
    `<div class="flabel">Client</div><div class="fvalue">${clientName}</div>`
  );
  html = html.replace(
    /<div class="flabel">Brand<\/div>\s*<div class="fvalue empty">——<\/div>/,
    `<div class="flabel">Brand</div><div class="fvalue">${display(data.campaign.brandName)}</div>`
  );
  html = html.replace(
    /<div class="flabel">Campaign Name<\/div>\s*<div class="fvalue empty">——<\/div>/,
    `<div class="flabel">Campaign Name</div><div class="fvalue">${display(data.campaign.name)}</div>`
  );
  html = html.replace(
    /<div class="fvalue">From: \[DATE\] &nbsp;&nbsp; To: \[DATE\]<\/div>/,
    `<div class="fvalue">${formatDateRange(data.campaign.startDate, data.campaign.endDate)}</div>`
  );
  html = html.replace(
    /<div class="flabel">Channel\(s\)<\/div>\s*<div class="fvalue empty">——<\/div>/,
    `<div class="flabel">Channel(s)</div><div class="fvalue">${display(data.campaign.channels)}</div>`
  );
  html = html.replace(
    /<div class="flabel">Target Market<\/div>\s*<div class="fvalue">Egypt<\/div>/,
    `<div class="flabel">Target Market</div><div class="fvalue">${display(data.campaign.targetMarket)}</div>`
  );
  html = html.replace(
    /<div class="flabel">Business Objective<\/div>\s*<div class="fvalue empty">——<\/div>/,
    `<div class="flabel">Business Objective</div><div class="fvalue">${display(data.campaign.businessObjective)}</div>`
  );
  html = html.replace(
    /<div class="flabel">Usage Period \(from date of posting\)<\/div>\s*<div class="fvalue empty">——<\/div>/,
    `<div class="flabel">Usage Period (from date of posting)</div><div class="fvalue">${display(data.campaign.usagePeriod)}</div>`
  );

  // Section 3 — Deliverables
  html = html.replace(
    /<table class="deliv-table">[\s\S]*?<tbody>[\s\S]*?<\/tbody>/,
    (table) =>
      table.replace(
        /<tbody>[\s\S]*?<\/tbody>/,
        `<tbody>${renderDeliverableRows(data, layout)}</tbody>`
      )
  );

  // Section 4 — Pricing
  html = html.replace(
    /<div class="pricing-wrap">[\s\S]*?<\/div>\s*<\/div>\s*\n\s*<!-- 05 PAYMENT TERMS -->/,
    `<div class="pricing-wrap">
        ${renderPricingSection(pricingRows, currency)}
      </div>
    </div>

    <!-- 05 PAYMENT TERMS -->`
  );

  // Section 5 — Payment terms (agency bank + client schedule)
  html = html.replace(
    /<div class="flabel">Payment Schedule<\/div>\s*<div class="fvalue">Advance — Prior to campaign launch<\/div>/,
    `<div class="flabel">Payment Schedule</div><div class="fvalue">${display(data.paymentSchedule)}</div>`
  );
  html = html.replace(
    /<div class="flabel">Payment Method<\/div>\s*<div class="fvalue">Bank Transfer \(AAIB\)<\/div>/,
    `<div class="flabel">Payment Method</div><div class="fvalue">${display(agency.paymentMethod)}</div>`
  );
  html = html.replace(
    /<div class="flabel">Beneficiary<\/div>\s*<div class="fvalue">Thinkway<\/div>/,
    `<div class="flabel">Beneficiary</div><div class="fvalue">${display(agency.beneficiary)}</div>`
  );
  html = html.replace(
    /<div class="flabel">Bank<\/div>\s*<div class="fvalue">Arab African International Bank \(AAIB\) — Park Street Branch<\/div>/,
    `<div class="flabel">Bank</div><div class="fvalue">${display(agency.bankName)}</div>`
  );
  html = html.replace(
    /<div class="flabel">Account Number<\/div>\s*<div class="fvalue">1200842810010201<\/div>/,
    `<div class="flabel">Account Number</div><div class="fvalue">${display(agency.accountNumber)}</div>`
  );
  html = html.replace(
    /<div class="flabel">SWIFT Code<\/div>\s*<div class="fvalue">ARAIEGCXX<\/div>/,
    `<div class="flabel">SWIFT Code</div><div class="fvalue">${display(agency.swift)}</div>`
  );
  html = html.replace(
    /<div class="flabel">IBAN<\/div>\s*<div class="fvalue">EG500057093001200842810010201<\/div>/,
    `<div class="flabel">IBAN</div><div class="fvalue">${display(agency.iban)}</div>`
  );

  const paymentSchedulePill = display(data.paymentSchedule);
  const vatPill = data.pricing.vatExempt
    ? "VAT Exempt"
    : `VAT ${data.pricing.vatPercent}% Included`;
  const currencyPill = `${escapeHtml(currency)} Currency`;

  html = html.replace(
    /<div class="terms-pills">[\s\S]*?<\/div>/,
    `<div class="terms-pills">
          <span class="pill"><span class="dot"></span>${paymentSchedulePill}</span>
          <span class="pill"><span class="dot"></span>${display(agency.paymentMethod)}</span>
          <span class="pill"><span class="dot"></span>${vatPill}</span>
          <span class="pill"><span class="dot"></span>${currencyPill}</span>
        </div>`
  );

  // Section 8 — Terms & Conditions
  html = html.replace(
    /<ul class="terms-list">[\s\S]*?<\/ul>/,
    `<ul class="terms-list">${renderTermsListHtml(data.terms)}</ul>`
  );

  return html;
}
