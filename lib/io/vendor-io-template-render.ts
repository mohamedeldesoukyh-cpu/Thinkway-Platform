import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderTermsListHtml } from "@/lib/io/client-io-terms";
import { IO_CLASSIC_DOCUMENT_STYLES } from "@/lib/io/io-classic-document-styles";
import { THINKWAY_AGENCY_DEFAULTS } from "@/lib/io/thinkway-agency-defaults";
import type { VendorIoDocumentData } from "@/lib/io/vendor-io-document-types";
import { formatMoneyDetail } from "@/lib/finance/currency-format";
import { applyThinkwayLogoToDocumentHtml } from "@/lib/reports/document/thinkway-report-logo";

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
  return formatMoneyDetail(amount, currency);
}

function formatDuration(start: string | null, end: string | null): string {
  const fmt = (d: string | null) => {
    if (!d) return null;
    const parsed = new Date(`${d}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return d;
    return parsed.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };
  const from = fmt(start);
  const to = fmt(end);
  if (from && to) return `${from} – ${to}`;
  return from || to || "——";
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

function paymentDetail(data: VendorIoDocumentData, key: string): string {
  const details = data.influencer.paymentDetails;
  const value = details[key];
  return typeof value === "string" ? value : "";
}

function fld(k: string, v: string): string {
  return `<div class="qf"><span class="k">${escapeHtml(k)}</span><span class="v">${v}</span></div>`;
}

function card(t: string, inner: string): string {
  return `<div class="qcard"><div class="ct">${escapeHtml(t)}</div>${inner}</div>`;
}

function sec(n: string, t: string, inner: string): string {
  return `<section class="qsec section"><div class="qh"><span class="qnum">${n}</span><h3 class="section-title">${escapeHtml(t)}</h3></div>${inner}</section>`;
}

function renderDeliverableRows(data: VendorIoDocumentData): string {
  if (data.deliverables.length === 0) {
    return `<tr><td colspan="5" class="muted">No deliverables on linked assignment lines.</td></tr>`;
  }
  return data.deliverables
    .map(
      (row) => `
          <tr>
            <td class="hh">${escapeHtml(platformLabel(row.platform))}</td>
            <td>${display(row.deliverableType)}</td>
            <td class="r">${row.quantity}</td>
            <td>${display(row.handle)}</td>
            <td class="r">${display(row.scheduledDates)}</td>
          </tr>`
    )
    .join("");
}

/** Shell kept for PDF print-CSS contract tests / parity. */
export function loadVendorIoTemplate(): string {
  return readFileSync(TEMPLATE_PATH, "utf8");
}

export function renderVendorIoHtml(data: VendorIoDocumentData): string {
  const agency = THINKWAY_AGENCY_DEFAULTS;
  const docNum = escapeHtml(data.documentNumber);
  const currency = data.currencyCode;
  const influencerName = display(
    data.influencer.legalName ?? data.influencer.displayName
  );
  const paymentSchedule = display(
    paymentDetail(data, "payment_schedule") || agency.paymentSchedule
  );
  const paymentMethod = display(paymentDetail(data, "method") || "Bank transfer");
  const beneficiary = display(
    paymentDetail(data, "beneficiary_name") ||
      data.influencer.legalName ||
      data.influencer.displayName
  );
  const bank = display(
    [paymentDetail(data, "bank_name"), paymentDetail(data, "bank_branch")]
      .filter(Boolean)
      .join(" — ") || null
  );

  const duration = formatDuration(data.campaign.startDate, data.campaign.endDate);
  const hero = `<div class="hero"><div class="mkw"><span class="mk"></span><div class="logo-text">THINKWAY</div></div>
  <div class="htype"><div class="lbl">Vendor Insertion Order · ${docNum}</div><h1>${display(data.campaign.name)}</h1>
  <div class="hpills"><span class="hp">Brand · ${display(data.campaign.brandName)}</span><span class="hp">${display(data.campaign.clientName)}</span><span class="hp">${duration}</span><span class="hp">${display(data.campaign.channels)}</span></div></div></div>`;

  const parties = sec(
    "1",
    "Parties",
    `<div class="qgrid2">
   ${card(
     "Influencer / Agency",
     fld("Name", influencerName) +
       fld("National ID / Trade License", display(data.influencer.nationalId)) +
       fld("Email", display(data.influencer.email)) +
       `<div class="qf"><span class="k">Address</span><span class="v" style="max-width:60%">${display(data.influencer.address)}</span></div>`
   )}
   ${card(
     "Agency",
     fld("Company", "Thinkway") +
       fld("Commercial Register", escapeHtml(agency.commercialRegister)) +
       fld(
         "Tax Reg. · VAT",
         `${escapeHtml(agency.taxRegistration)} · ${escapeHtml(agency.vatNumber)}`
       ) +
       fld("Email", escapeHtml(agency.email)) +
       `<div class="qf"><span class="k">Address</span><span class="v" style="max-width:60%">${escapeHtml(agency.registeredAddress)}</span></div>`
   )}
 </div>`
  );

  const campaign = sec(
    "2",
    "Campaign Details",
    `<div class="qgrid2">
   ${card(
     "Brief",
     fld("Client", display(data.campaign.clientName)) +
       fld("Brand", display(data.campaign.brandName)) +
       fld("Campaign", display(data.campaign.name)) +
       fld("Duration", duration)
   )}
   ${card(
     "Engagement",
     fld("Channel", display(data.campaign.channels)) +
       fld("Usage Period", display(data.campaign.usagePeriod)) +
       fld("Currency", escapeHtml(currency))
   )}
 </div>`
  );

  const profile = sec(
    "3",
    "Influencer Profile",
    `<div class="qgrid2">
   ${card(
     "Identity",
     fld("Full Name / Handle", display(data.influencerMetrics.handle)) +
       fld("Platform(s)", display(data.influencerMetrics.platforms)) +
       fld("Follower Count", display(data.influencerMetrics.followerCount))
   )}
   ${card(
     "Audience",
     fld("Content Niche", display(data.influencerMetrics.niche)) +
       fld("Primary Audience", display(data.influencerMetrics.audience)) +
       fld("Avg. Engagement Rate", display(data.influencerMetrics.engagementRate))
   )}
 </div>`
  );

  const deliverables = sec(
    "4",
    "Deliverables",
    `<table class="qtable deliv-table"><thead><tr><th>Platform</th><th>Deliverable</th><th class="r">Qty</th><th>Handle</th><th class="r">Scheduled</th></tr></thead><tbody>${renderDeliverableRows(data)}</tbody></table>`
  );

  const pricing = sec(
    "5",
    "Pricing & Fees",
    `<div class="fee-block">
      <div class="fee-line"><span>Content Creation Fee</span><b class="tabular">${escapeHtml(formatMoney(data.pricing.contentCreationFee, currency))}</b></div>
      <div class="fee-line"><span>Usage Rights Fee</span><b class="tabular">${escapeHtml(formatMoney(data.pricing.usageRightsFee, currency))}</b></div>
    </div>
    <div class="qtotals"><div class="qtbox">
      <div class="qtrow"><span>VAT (${data.pricing.vatPercent}%)</span><b class="tabular">${escapeHtml(formatMoney(data.pricing.vatAmount, currency))}</b></div>
      <div class="qgrand"><span class="gk">Total Amount Due · ${escapeHtml(currency)}</span><span class="gv tabular">${escapeHtml(formatMoney(data.pricing.totalDue, currency))}</span></div>
    </div></div>`
  );

  const payment = sec(
    "6",
    "Vendor Payment Details",
    `<div class="qgrid2">
   ${card(
     "Schedule & Method",
     fld("Schedule", paymentSchedule) +
       fld("Method", paymentMethod) +
       fld("VAT", escapeHtml(`${data.pricing.vatPercent}% Applicable`))
   )}
   ${card(
     "Beneficiary Bank",
     fld("Beneficiary", beneficiary) +
       fld("Bank", bank) +
       fld("Account", display(paymentDetail(data, "account_number"))) +
       fld("SWIFT", display(paymentDetail(data, "swift"))) +
       fld("IBAN", display(paymentDetail(data, "iban")))
   )}
 </div>`
  );

  const signature = sec(
    "7",
    "Acknowledgement & Signature",
    `<div class="sig-grid">
      <div class="sig-box">
        <div class="slabel">Thinkway</div>
        <div class="srow"><span class="sk">Authorized</span><span class="sv">${escapeHtml(agency.authorizedSignatory)}</span></div>
        <div class="srow"><span class="sk">Title</span><span class="sv">${escapeHtml(agency.authorizedTitle)}</span></div>
      </div>
      <div class="sig-box party">
        <div class="slabel">Influencer / Agency</div>
        <div class="srow"><span class="sk">Name</span><span class="sv">${influencerName}</span></div>
        <div class="srow"><span class="sk">Signature</span><span class="sv muted">————————</span></div>
      </div>
    </div>`
  );

  const terms = `<section class="qsec section terms-section"><div class="qh"><span class="qnum">8</span><h3 class="section-title">Terms &amp; Conditions</h3></div><ul class="terms-list">${renderTermsListHtml(data.terms)}</ul></section>`;

  const foot = `<div class="qfoot">Thinkway (ثينكواي) · CR ${escapeHtml(agency.commercialRegister)} · VAT ${escapeHtml(agency.vatNumber)} · Tax Reg. ${escapeHtml(agency.taxRegistration)} · ${escapeHtml(agency.registeredAddress)} · ${escapeHtml(agency.email)}<br>CONFIDENTIAL &amp; PROPRIETARY — THINKWAY 2026 · ${docNum}</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Thinkway · Vendor Insertion Order · ${docNum}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
${IO_CLASSIC_DOCUMENT_STYLES}
</style>
</head>
<body>
<div class="paper"><div class="doc">
${hero}
${parties}${campaign}${profile}${deliverables}${pricing}${payment}${signature}${terms}
${foot}
</div></div>
</body>
</html>`;

  return applyThinkwayLogoToDocumentHtml(html);
}
