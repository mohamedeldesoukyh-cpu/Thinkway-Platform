import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  applyClientIoDocumentLayout,
  resolveClientIoDeliverableRows,
  type ClientIoDocumentLayout,
  type ClientIoPricingRow,
} from "@/lib/io/client-io-document-layout";
import type { ClientIoDocumentData } from "@/lib/io/client-io-document-types";
import { formatClientIoMilestoneTrigger } from "@/lib/io/client-io-milestones";
import { renderTermsListHtml } from "@/lib/io/client-io-terms";
import { IO_CLASSIC_DOCUMENT_STYLES } from "@/lib/io/io-classic-document-styles";
import { THINKWAY_AGENCY_DEFAULTS } from "@/lib/io/thinkway-agency-defaults";
import { formatMoneyDetail } from "@/lib/finance/currency-format";
import { applyThinkwayLogoToDocumentHtml } from "@/lib/reports/document/thinkway-report-logo";

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

function formatIssuedMeta(issuedAt: string, country: string): string {
  const parsed = new Date(issuedAt);
  const monthYear = Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return `Issued ${monthYear} · ${escapeHtml(country)}`;
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

function partyLeftLabel(
  agencyOrDirect: ClientIoDocumentData["client"]["agencyOrDirect"]
): string {
  if (agencyOrDirect === "direct") return "Client / Advertiser";
  return "Agency / Advertiser";
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

function renderDeliverableRows(
  data: ClientIoDocumentData,
  layout: ClientIoDocumentLayout
): string {
  const rows = resolveClientIoDeliverableRows(data, layout);
  if (rows.length === 0) {
    return `<tr><td colspan="5" class="muted">No deliverables on campaign assignment lines.</td></tr>`;
  }
  return rows
    .map(
      (row) => `
          <tr>
            <td class="hh">${display(row.influencerName)}</td>
            <td>${display(platformLabel(row.platform))}</td>
            <td>${display(row.deliverableType)}</td>
            <td class="r">${row.quantity}</td>
            <td class="r">${display(row.scheduledDates)}</td>
          </tr>`
    )
    .join("");
}

function renderDeliverableScope(data: ClientIoDocumentData): string {
  const rows = data.influencerNotes ?? [];
  if (rows.length === 0) {
    return `<p class="muted">No deliverable scope notes on selected Assignments.</p>`;
  }
  return rows
    .map((row) => {
      const bullets = (row.fullDescription || "——")
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join("");
      const usage = row.usagePeriod?.trim()
        ? `<li>Usage period: ${escapeHtml(row.usagePeriod)}</li>`
        : "";
      return `<div class="dlv-item"><h4>${display(row.influencerName)}<span></span></h4><ul>${bullets}${usage}</ul></div>`;
    })
    .join("");
}

function renderPricingBlocks(rows: ClientIoPricingRow[], currency: string): string {
  const blocks: string[] = [];
  let currentHead: string | null = null;
  let lines: string[] = [];

  const flush = () => {
    if (!currentHead && lines.length === 0) return;
    const head = currentHead
      ? `<div class="fhead"><span>${escapeHtml(currentHead)}</span><span class="fref"></span></div>`
      : "";
    blocks.push(`<div class="fee-block">${head}${lines.join("")}</div>`);
    currentHead = null;
    lines = [];
  };

  for (const row of rows) {
    if (row.variant === "header") {
      flush();
      currentHead = row.label;
      continue;
    }
    if (
      row.variant === "subtotal" ||
      row.variant === "total" ||
      /^VAT\b/i.test(row.label)
    ) {
      flush();
      continue;
    }
    const amount =
      row.amount == null
        ? ""
        : `<b class="tabular">${escapeHtml(formatMoney(row.amount, currency))}</b>`;
    lines.push(
      `<div class="fee-line"><span>${escapeHtml(row.label)}</span>${amount}</div>`
    );
  }
  flush();

  const subtotal = rows.find((r) => r.variant === "subtotal");
  const vat = rows.find(
    (r) => r.variant !== "total" && r.variant !== "subtotal" && /^VAT/i.test(r.label)
  );
  const total = rows.find((r) => r.variant === "total");

  const totals = `<div class="qtotals"><div class="qtbox">
    ${
      subtotal?.amount != null
        ? `<div class="qtrow"><span>Subtotal</span><b class="tabular">${escapeHtml(formatMoney(subtotal.amount, currency))}</b></div>`
        : ""
    }
    ${
      vat?.amount != null
        ? `<div class="qtrow"><span>${escapeHtml(vat.label)}</span><b class="tabular">${escapeHtml(formatMoney(vat.amount, currency))}</b></div>`
        : ""
    }
    ${
      total?.amount != null
        ? `<div class="qgrand"><span class="gk">Total Amount Due · ${escapeHtml(currency)}</span><span class="gv tabular">${escapeHtml(formatMoney(total.amount, currency))}</span></div>`
        : ""
    }
  </div></div>`;

  return `${blocks.join("")}${totals}`;
}

function paymentTriggerLabel(data: ClientIoDocumentData): string {
  const first = data.billingMilestones?.[0];
  if (!first) return "On approval";
  return formatClientIoMilestoneTrigger(first);
}

/** Shell kept for PDF print-CSS contract tests. */
export function loadClientIoTemplate(): string {
  return readFileSync(TEMPLATE_PATH, "utf8");
}

export function renderClientIoHtml(
  data: ClientIoDocumentData,
  layout: ClientIoDocumentLayout = "detailed"
): string {
  const agency = THINKWAY_AGENCY_DEFAULTS;
  const docNum = escapeHtml(data.documentNumber);
  const currency = data.currencyCode;
  const clientName = display(data.client.legalName ?? data.client.name);
  const { pricingRows } = applyClientIoDocumentLayout(data, layout);
  const paymentSchedule = display(data.paymentSchedule);
  const vatPill = data.pricing.vatExempt
    ? "VAT Exempt"
    : `VAT ${data.pricing.vatPercent}% Included`;
  const scope =
    "Influencer identification, contracting, briefing, content review, posting coordination, and performance reporting.";

  const hero = `<div class="hero-c"><div class="top">
   <div><div class="mkw"><span class="mk"></span><div class="logo-text">THINK<span>WAY</span></div></div><div class="subttl">Influencer Marketing Agency · Cairo, EG</div></div>
   <div><div class="doctype">Client Insertion Order</div><div style="text-align:right"><span class="ciopill">${docNum}</span></div><div class="issue">${formatIssuedMeta(data.issuedAt, data.issuedCountry || agency.country)} · ${escapeHtml(currency)}</div></div>
 </div></div>`;

  const parties = sec(
    "1",
    "Parties",
    `<div class="qgrid2">
   ${card(
     partyLeftLabel(data.client.agencyOrDirect),
     fld("Company", clientName) +
       fld("CR / License", display(data.client.tradeLicense)) +
       fld("Email", display(data.client.email)) +
       fld("Contact", display(data.client.contactPerson)) +
       `<div class="qf"><span class="k">Address</span><span class="v" style="max-width:60%">${display(data.client.address)}</span></div>`
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
       fld("Agency Contact", display(data.agencyContact.fullName)) +
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
     fld("Brand", display(data.campaign.brandName)) +
       fld("Campaign", display(data.campaign.name)) +
       fld("Duration", formatDuration(data.campaign.startDate, data.campaign.endDate))
   )}
   ${card(
     "Targeting",
     fld("Target Market", display(data.campaign.targetMarket)) +
       fld("Channel", display(data.campaign.channels)) +
       fld("Currency", escapeHtml(currency))
   )}
 </div><div style="margin-top:14px">${card("Scope of Services", `<p>${escapeHtml(scope)}</p>`)}</div>`
  );

  const roster = sec(
    "3",
    "Influencer Roster & Deliverables",
    `<table class="qtable deliv-table"><thead><tr><th>Influencer</th><th>Platform</th><th>Deliverable</th><th class="r">Posts</th><th class="r">Scheduled</th></tr></thead><tbody>${renderDeliverableRows(data, layout)}</tbody></table>
    <div style="margin-top:14px" class="qcard"><div class="ct">Deliverable scope — full description</div>${renderDeliverableScope(data)}</div>`
  );

  const pricing = sec("4", "Pricing & Fees", renderPricingBlocks(pricingRows, currency));

  const payment = sec(
    "5",
    "Payment Terms",
    `<div class="qgrid2">
   ${card(
     "Schedule & Method",
     fld("Schedule", paymentSchedule) +
       fld("Trigger", escapeHtml(paymentTriggerLabel(data))) +
       fld("Method", escapeHtml(agency.paymentMethod)) +
       fld("VAT", escapeHtml(data.pricing.vatExempt ? "Exempt" : `${data.pricing.vatPercent}% included`))
   )}
   ${card(
     "Beneficiary Bank",
     fld("Beneficiary", escapeHtml(agency.beneficiary)) +
       fld("Bank", escapeHtml(agency.bankName)) +
       fld("Account", escapeHtml(agency.accountNumber)) +
       fld("SWIFT", escapeHtml(agency.swift)) +
       fld("IBAN", escapeHtml(agency.iban))
   )}
 </div>
 <div class="terms-pills">
   <span class="pill"><span class="dot"></span>${paymentSchedule}</span>
   <span class="pill"><span class="dot"></span>${escapeHtml(agency.paymentMethod)}</span>
   <span class="pill"><span class="dot"></span>${escapeHtml(vatPill)}</span>
   <span class="pill"><span class="dot"></span>${escapeHtml(currency)} Currency</span>
 </div>`
  );

  const approve = sec(
    "6",
    "Content Approval Process",
    `<div class="approve-grid">
      <div class="approve-item"><div class="ah">Influencer Shortlist Approval</div><p>Thinkway will share the proposed influencer list with the Client. Client approval or feedback is required within <strong>2 business days</strong>. No response = approved.</p></div>
      <div class="approve-item"><div class="ah">Content Review</div><p>All influencer content is shared prior to publishing. Client feedback is required within <strong>2 business days</strong>. No response = approved.</p></div>
      <div class="approve-item"><div class="ah">Re-shoot Policy</div><p>Subject to influencer discretion and may incur additional fees. Thinkway makes best efforts but assumes no obligation.</p></div>
      <div class="approve-item"><div class="ah">Cancellation Notice</div><p>Minimum <strong>7 business days</strong> written notice prior to the scheduled campaign launch date.</p></div>
    </div>`
  );

  const ack = sec(
    "7",
    "Client Acknowledgement",
    `<div class="qack"><span class="badge">Deemed acceptance · 3 business days</span>
   <p>This Client Insertion Order (Ref: <strong>${docNum}</strong>) has been issued by Thinkway to the Client named above. If the Client does not submit a written request for amendment or raise any objection within three (3) business days of receipt of this IO, the Client shall be deemed to have reviewed, accepted, and agreed to all terms, campaign details, deliverables, and pricing set forth herein. Thinkway will proceed with campaign execution accordingly.</p></div>`
  );

  const terms = `<section class="qsec section" style="page-break-before:always;break-before:page"><div class="qh"><span class="qnum">8</span><h3 class="section-title">Terms &amp; Conditions</h3></div><ul class="terms-list">${renderTermsListHtml(data.terms)}</ul></section>`;

  const foot = `<div class="qfoot">Thinkway (ثينكواي) · CR ${escapeHtml(agency.commercialRegister)} · VAT ${escapeHtml(agency.vatNumber)} · Tax Reg. ${escapeHtml(agency.taxRegistration)} · ${escapeHtml(agency.registeredAddress)} · ${escapeHtml(agency.email)}<br>CONFIDENTIAL &amp; PROPRIETARY — THINKWAY 2026 · ${docNum}</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Client Insertion Order — ${docNum} — Thinkway</title>
<style>
${IO_CLASSIC_DOCUMENT_STYLES}
</style>
</head>
<body>
<div class="stage"><div class="paper"><div class="doc">
${hero}
${parties}${campaign}${roster}${pricing}${payment}${approve}${ack}${terms}
${foot}
</div></div></div>
</body>
</html>`;

  return applyThinkwayLogoToDocumentHtml(html);
}
