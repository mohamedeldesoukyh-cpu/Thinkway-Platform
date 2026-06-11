import { readFileSync } from "node:fs";
import { join } from "node:path";

import { THINKWAY_AGENCY_DEFAULTS } from "@/lib/io/thinkway-agency-defaults";
import type { VendorIoDocumentData } from "@/lib/io/vendor-io-document-types";

const TEMPLATE_PATH = join(process.cwd(), "lib/io/templates/Thinkway_IO_Global.html");

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

function renderDeliverableRows(data: VendorIoDocumentData): string {
  if (data.deliverables.length === 0) {
    return `<tr><td colspan="5" class="muted">No deliverables on linked assignment lines.</td></tr>`;
  }

  return data.deliverables
    .map(
      (row) => `
          <tr>
            <td><span class="platform">${escapeHtml(platformLabel(row.platform))}</span></td>
            <td class="muted">${display(row.deliverableType)}</td>
            <td>${row.quantity}</td>
            <td class="muted">${display(row.handle)}</td>
            <td class="muted">${display(row.scheduledDates)}</td>
          </tr>`
    )
    .join("");
}

function paymentDetail(data: VendorIoDocumentData, key: string): string {
  const details = data.influencer.paymentDetails;
  const value = details[key];
  return typeof value === "string" ? value : "";
}

export function loadVendorIoTemplate(): string {
  return readFileSync(TEMPLATE_PATH, "utf8");
}

export function renderVendorIoHtml(data: VendorIoDocumentData): string {
  let html = loadVendorIoTemplate();
  const agency = THINKWAY_AGENCY_DEFAULTS;
  const docNum = escapeHtml(data.documentNumber);
  const currency = data.currencyCode;
  const influencerName = display(
    data.influencer.legalName ?? data.influencer.displayName
  );
  const influencerEmail = display(data.influencer.email);
  const influencerAddress = display(data.influencer.address);
  const influencerId = display(data.influencer.nationalId);

  html = html.replace(
    /<title>Insertion Order — VIO-2026-8 — Thinkway<\/title>/,
    `<title>Insertion Order — ${docNum} — Thinkway</title>`
  );
  html = html.replace(/VIO-2026-8/g, docNum);
  html = html.replace(
    /Issued: June 2026 &nbsp;·&nbsp; Egypt/,
    formatIssuedMeta(data.issuedAt, data.issuedCountry || agency.country)
  );

  // Section 1 — Parties (influencer shade fields)
  html = html.replace(
    /<div class="flabel">Influencer \/ Agency<\/div>\s*<div class="fvalue empty">——<\/div>/,
    `<div class="flabel">Influencer / Agency</div><div class="fvalue">${influencerName}</div>`
  );
  html = html.replace(
    /<div class="flabel">National ID \/ Trade License<\/div>\s*<div class="fvalue empty">——<\/div>/,
    `<div class="flabel">National ID / Trade License</div><div class="fvalue">${influencerId}</div>`
  );
  html = html.replace(
    /<div class="flabel">Influencer Address<\/div>\s*<div class="fvalue empty">——<\/div>/,
    `<div class="flabel">Influencer Address</div><div class="fvalue">${influencerAddress}</div>`
  );
  html = html.replace(
    /<div class="flabel">Influencer Email<\/div>\s*<div class="fvalue empty">——<\/div>/,
    `<div class="flabel">Influencer Email</div><div class="fvalue">${influencerEmail}</div>`
  );

  // Section 2 — Campaign
  html = html.replace(
    /<div class="flabel">Client<\/div>\s*<div class="fvalue empty">——<\/div>/,
    `<div class="flabel">Client</div><div class="fvalue">${display(data.campaign.clientName)}</div>`
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
    /<div class="flabel">Usage Period \(from date of posting\)<\/div>\s*<div class="fvalue empty">——<\/div>/,
    `<div class="flabel">Usage Period (from date of posting)</div><div class="fvalue">${display(data.campaign.usagePeriod)}</div>`
  );

  // Section 3 — Influencer details (all shade fields in section 3)
  const section3Fields: Array<[string, string]> = [
    ["Full Name / Handle", data.influencerMetrics.handle],
    ["Platform(s)", data.influencerMetrics.platforms],
    ["Follower Count", data.influencerMetrics.followerCount],
    ["Content Niche", data.influencerMetrics.niche],
    ["Primary Audience", data.influencerMetrics.audience],
    ["Avg. Engagement Rate", data.influencerMetrics.engagementRate],
  ];

  for (const [label, value] of section3Fields) {
    const pattern = new RegExp(
      `<div class="flabel">${label.replace(/[()]/g, "\\$&")}<\\/div>\\s*<div class="fvalue empty">——<\\/div>`,
      "g"
    );
    html = html.replace(
      pattern,
      `<div class="flabel">${label}</div><div class="fvalue">${display(value)}</div>`
    );
  }

  // Section 4 — Deliverables tbody
  html = html.replace(
    /<table class="deliv-table">[\s\S]*?<tbody>[\s\S]*?<\/tbody>/,
    (table) => table.replace(/<tbody>[\s\S]*?<\/tbody>/, `<tbody>${renderDeliverableRows(data)}</tbody>`)
  );

  // Section 5 — Pricing
  const { pricing } = data;
  html = html.replace(
    `<span class="label">Content Creation Fee</span>\n          <span class="amount">[EGP ——]</span>`,
    `<span class="label">Content Creation Fee</span>\n          <span class="amount">${formatMoney(pricing.contentCreationFee, currency)}</span>`
  );
  html = html.replace(
    `<span class="label">Platform Distribution Fee</span>\n          <span class="amount">[EGP ——]</span>`,
    `<span class="label">Platform Distribution Fee</span>\n          <span class="amount">${formatMoney(pricing.platformDistributionFee, currency)}</span>`
  );
  html = html.replace(
    `<span class="label">Usage Rights Fee</span>\n          <span class="amount">[EGP ——]</span>`,
    `<span class="label">Usage Rights Fee</span>\n          <span class="amount">${formatMoney(pricing.usageRightsFee, currency)}</span>`
  );
  html = html.replace(
    `<span class="label">VAT (14%)</span>\n          <span class="amount">[EGP ——]</span>`,
    `<span class="label">VAT (${pricing.vatPercent}%)</span>\n          <span class="amount">${formatMoney(pricing.vatAmount, currency)}</span>`
  );
  html = html.replace(
    `<span class="label">Total Amount Due</span>\n          <span class="amount">[EGP ——]</span>`,
    `<span class="label">Total Amount Due</span>\n          <span class="amount">${formatMoney(pricing.totalDue, currency)}</span>`
  );

  // Section 6 — Vendor payout bank details (from influencers.payment_details)
  html = html.replace(
    /<div class="num">6<\/div><div class="title">Payment Terms<\/div>/,
    `<div class="num">6</div><div class="title">Vendor Payment Details</div>`
  );
  html = html.replace(
    /<div class="flabel">Payment Schedule<\/div>\s*<div class="fvalue">Net 30 Days from Invoice<\/div>/,
    `<div class="flabel">Payment Schedule</div><div class="fvalue">${display(paymentDetail(data, "payment_schedule") || agency.paymentSchedule)}</div>`
  );
  html = html.replace(
    /<div class="flabel">Beneficiary<\/div>\s*<div class="fvalue">Thinkway<\/div>/,
    `<div class="flabel">Beneficiary</div><div class="fvalue">${display(paymentDetail(data, "beneficiary_name") || data.influencer.legalName || data.influencer.displayName)}</div>`
  );
  html = html.replace(
    /<div class="flabel">Payment Method<\/div>\s*<div class="fvalue">Bank Transfer \(AAIB\)<\/div>/,
    `<div class="flabel">Payment Method</div><div class="fvalue">${display(paymentDetail(data, "method") || "Bank transfer")}</div>`
  );
  html = html.replace(
    /<div class="flabel">Bank<\/div>\s*<div class="fvalue">Arab African International Bank \(AAIB\) — Park Street Branch<\/div>/,
    `<div class="flabel">Bank</div><div class="fvalue">${display(
      [paymentDetail(data, "bank_name"), paymentDetail(data, "bank_branch")]
        .filter(Boolean)
        .join(" — ") || null
    )}</div>`
  );
  html = html.replace(
    /<div class="flabel">Account Number<\/div>\s*<div class="fvalue">1200842810010201<\/div>/,
    `<div class="flabel">Account Number</div><div class="fvalue">${display(paymentDetail(data, "account_number"))}</div>`
  );
  html = html.replace(
    /<div class="flabel">SWIFT Code<\/div>\s*<div class="fvalue">ARAIEGCXX<\/div>/,
    `<div class="flabel">SWIFT Code</div><div class="fvalue">${display(paymentDetail(data, "swift"))}</div>`
  );
  html = html.replace(
    /<div class="flabel">IBAN<\/div>\s*<div class="fvalue">EG500057093001200842810010201<\/div>/,
    `<div class="flabel">IBAN</div><div class="fvalue">${display(paymentDetail(data, "iban"))}</div>`
  );

  // Currency pill
  html = html.replace(
    /<span class="pill"><span class="dot"><\/span>EGP Currency<\/span>/,
    `<span class="pill"><span class="dot"></span>${escapeHtml(currency)} Currency</span>`
  );

  // Section 7 — Influencer signature name
  html = html.replace(
    /<div class="sig-box party">[\s\S]*?<div class="svalue empty" style="color:var\(--rule\);">——<\/div>/,
    (block) =>
      block.replace(
        /<div class="svalue empty" style="color:var\(--rule\);">——<\/div>/,
        `<div class="svalue">${influencerName}</div>`
      )
  );

  return html;
}
