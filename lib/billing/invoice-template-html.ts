import type { InvoiceDocumentData, InvoiceLineItemRow } from "@/lib/billing/invoice-document-types";
import { THINKWAY_AGENCY_DEFAULTS } from "@/lib/io/thinkway-agency-defaults";
import { formatMoneyDetail } from "@/lib/finance/currency-format";
import { applyThinkwayLogoToDocumentHtml } from "@/lib/reports/document/thinkway-report-logo";
import { roundMoney } from "@/lib/vat/calculations";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function display(value: string | null | undefined, fallback = "—"): string {
  const trimmed = value?.trim();
  return trimmed ? esc(trimmed) : fallback;
}

function formatMoneyAmount(amount: number): string {
  return roundMoney(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMoney(amount: number, currency: string): string {
  return formatMoneyDetail(amount, currency);
}

function formatShortDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatLongDueDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatCampaignPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  return `${formatShortDate(start)} — ${formatShortDate(end)}`;
}

function formatTaxLabel(line: InvoiceLineItemRow): string {
  if (line.revenueVatExempt) return "Exempt";
  if (line.revenueVatPercent > 0) return `${line.revenueVatPercent}%`;
  return "—";
}

/** Prefer invoice tax fields; fall back to summing line VAT when header tax is missing. */
export function resolveInvoiceDocumentVat(data: InvoiceDocumentData): {
  subtotal: number;
  taxAmount: number;
  total: number;
  vatPercent: number;
  vatLabel: string;
} {
  const lineVatSum = roundMoney(
    data.lineItems.reduce((sum, line) => sum + Number(line.revenueVatAmount ?? 0), 0)
  );
  const lineBeforeVat = roundMoney(
    data.lineItems.reduce((sum, line) => sum + Number(line.revenueBeforeVat ?? 0), 0)
  );
  const subtotal =
    data.subtotal > 0 ? roundMoney(data.subtotal) : lineBeforeVat;
  const taxAmount =
    data.taxAmount > 0
      ? roundMoney(data.taxAmount)
      : lineVatSum > 0
        ? lineVatSum
        : 0;
  const total =
    data.total > 0
      ? roundMoney(data.total)
      : roundMoney(subtotal + taxAmount);
  const vatPercent =
    data.vatPercent > 0
      ? data.vatPercent
      : data.lineItems.find((l) => !l.revenueVatExempt && l.revenueVatPercent > 0)
          ?.revenueVatPercent ?? THINKWAY_AGENCY_DEFAULTS.defaultVatPercent;

  const vatLabel =
    taxAmount <= 0 && data.lineItems.every((l) => l.revenueVatExempt)
      ? "VAT (Exempt)"
      : `VAT (${vatPercent}%)`;

  return { subtotal, taxAmount, total, vatPercent, vatLabel };
}

const INVOICE_STYLES = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--blue:#0057ff;--navy:#0d1836;--ink:#0d1220;--muted:#7c88a4;--muted2:#9aa3b5;
--line:#eef1f9;--tint:#f6f8ff;--border:#e6ecfb;--pill:#eef3ff;--red:#d92d20;--radius:12px}
@page{size:A4;margin:0}
html,body{font-family:'Inter',sans-serif;color:var(--navy);background:#fff;
-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:13px;line-height:1.5}
.page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;position:relative;overflow:hidden}
.hdr{position:relative;overflow:hidden;color:#fff;padding:13mm 15mm 11mm;
background:radial-gradient(120% 160% at 100% 0%,#3f7bff 0%,#0057ff 45%,#003bd0 100%)}
.hdr .c1{position:absolute;right:-24mm;top:-40mm;width:120mm;height:120mm;border-radius:50%;background:rgba(255,255,255,.11)}
.hdr .c2{position:absolute;right:26mm;bottom:-52mm;width:82mm;height:82mm;border-radius:50%;background:rgba(255,255,255,.07)}
.hrow{position:relative;display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
.mk{display:flex;align-items:center;gap:11px;font-weight:800;font-size:22px;letter-spacing:-.01em}
.mkbox{width:38px;height:38px;border-radius:11px;background:#fff;position:relative;flex-shrink:0}
.mkbox::before{content:"";position:absolute;left:9px;top:9px;width:8px;height:8px;border-radius:50%;background:#0d1836}
.mkbox::after{content:"";position:absolute;right:8px;bottom:8px;width:11px;height:11px;border-radius:50%;background:#0057ff}
.htag{margin-top:14px;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:#cbdcff;font-weight:700}
.haddr{margin-top:12px;font-size:11px;color:#bcd0f6;line-height:1.7}
.haddr strong{color:#e7eeff;font-weight:600}
.tblock{text-align:right}
.itype{font-size:10.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#cbdcff}
.ititle{font-size:30px;font-weight:800;letter-spacing:-.02em;margin-top:6px}
.badge{display:inline-block;margin-top:12px;background:#fff;color:#0057ff;font-size:12px;font-weight:800;padding:5px 16px;border-radius:999px;letter-spacing:.02em}
.hmeta{margin-top:16px;display:flex;flex-direction:column;gap:5px;align-items:flex-end}
.hmeta .m{font-size:10.5px;color:#cbdcff}.hmeta .m b{color:#fff;font-weight:600}
.body{padding:9mm 15mm 12mm}
.section{margin-bottom:6mm}
.pcard,.fields,.tot-box,.due,.bank,.advgrid,.grid2b>div{page-break-inside:avoid;break-inside:avoid}
.tbl tr{page-break-inside:avoid;break-inside:avoid}
.advice{page-break-inside:avoid;break-inside:avoid}
.sect{font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--blue);
display:flex;align-items:center;gap:10px;margin-bottom:11px}
.sect::before{content:"";width:18px;height:2px;background:var(--blue)}
.sect .aft{flex:1;height:1px;background:var(--border)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.pcard{border:1px solid var(--border);border-radius:var(--radius);padding:15px 17px;border-left:3px solid var(--blue)}
.pcard.from{background:var(--tint);border-left-color:var(--navy)}
.prole{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:7px}
.pcard.from .prole{color:var(--blue)}
.pname{font-size:15px;font-weight:800;color:var(--navy);margin-bottom:5px}
.pdet{font-size:12px;color:var(--muted);line-height:1.7}
.trn{display:inline-block;margin-top:7px;background:#fff;border:1px solid var(--border);border-radius:6px;padding:3px 9px;font-size:11px;font-weight:700;color:var(--navy)}
.pcard.from .trn{background:#fff}
.fields{border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
.frow{display:grid;border-bottom:1px solid var(--border)}.frow:last-child{border-bottom:none}
.frow.c4{grid-template-columns:1fr 1fr 1fr 1fr}.frow.c3{grid-template-columns:1.6fr 1fr 1.1fr}
.fcell{padding:11px 15px;border-right:1px solid var(--border)}.fcell:last-child{border-right:none}
.fcell.sh{background:var(--tint)}
.flabel{font-size:9px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
.fval{font-size:12.5px;font-weight:600;color:var(--navy)}.fval.blue{color:var(--blue)}
.tbl{width:100%;border-collapse:collapse;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
.tbl thead th{background:var(--tint);color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase;
letter-spacing:.05em;text-align:left;padding:9px 13px;border-bottom:1.5px solid var(--border)}
.tbl thead th.r{text-align:right}
.tbl tbody td{padding:11px 13px;border-bottom:1px solid var(--line);font-size:12px;color:var(--ink);vertical-align:top}
.tbl tbody tr:last-child td{border-bottom:none}
.tbl td.r{text-align:right;font-variant-numeric:tabular-nums}
.tbl td.amt{font-weight:800;color:var(--blue);text-align:right;font-variant-numeric:tabular-nums}
.tbl td.mut{color:var(--muted)}
.dmain{font-weight:600;color:var(--navy)}
.dsub{display:block;font-size:10.5px;color:var(--muted);margin-top:3px;line-height:1.5}
.tot-wrap{display:flex;justify-content:flex-end;margin-top:13px}
.tot-box{width:82mm;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
.tot-row{display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border);font-size:12.5px}
.tot-row .k{color:var(--muted)}.tot-row .v{font-weight:700;color:var(--navy);font-variant-numeric:tabular-nums}
.tot-row.sh{background:var(--tint)}
.grand{background:linear-gradient(120deg,#0057ff,#3f7bff);color:#fff;display:flex;justify-content:space-between;align-items:center;padding:15px 18px}
.grand .k{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#dbe6ff;font-weight:700}
.grand .v{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums}
.grid2b{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.due{border:1px solid var(--border);border-left:3px solid var(--red);border-radius:var(--radius);padding:14px 16px}
.due .dl{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:5px}
.due .dd{font-size:18px;font-weight:800;color:var(--red)}
.due .dn{font-size:11px;color:var(--muted);margin-top:7px;line-height:1.6}
.pills{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}
.chip{display:inline-flex;align-items:center;gap:6px;background:var(--pill);color:var(--blue);font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px;border:1px solid var(--border)}
.chip .dot{width:5px;height:5px;border-radius:50%;background:var(--blue)}
.bank{border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
.bank .bh{background:var(--navy);color:#cbd7f0;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:9px 15px;border-left:3px solid var(--blue)}
.brow{display:flex;justify-content:space-between;gap:12px;padding:8px 15px;border-bottom:1px solid var(--line);font-size:11.5px}
.brow:last-child{border-bottom:none}.brow:nth-child(even){background:var(--tint)}
.brow .bk{color:var(--muted)}.brow .bv{font-weight:600;color:var(--navy);text-align:right;font-variant-numeric:tabular-nums}
.advice{margin-top:9mm;page-break-inside:avoid}
.advdiv{border:none;border-top:2px dashed var(--border);margin:0 0 22px;position:relative}
.advdiv::before{content:"\\2702  PAYMENT ADVICE";position:absolute;top:-9px;left:50%;transform:translateX(-50%);
background:#fff;padding:0 12px;font-size:10px;font-weight:800;letter-spacing:.14em;color:var(--muted);text-transform:uppercase}
.advgrid{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
.advl{padding:20px;border-right:1px solid var(--border)}
.advl .tl{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:8px}
.advl .tn{font-size:13px;font-weight:800;color:var(--navy);margin-bottom:5px}
.advl .td{font-size:12px;color:var(--muted);line-height:1.7}
.advr{padding:20px;background:var(--tint)}
.af{margin-bottom:13px}.af:last-child{margin-bottom:0}
.af .al{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:3px}
.af .av{font-size:13px;font-weight:700;color:var(--navy)}.af .av.lg{font-size:19px;color:var(--blue);font-weight:800}
.encl{border-bottom:1.5px solid var(--border);height:30px;margin-top:5px}
.foot{margin-top:9mm;border-top:1px solid var(--border);padding-top:12px;display:flex;justify-content:space-between;align-items:flex-end;gap:12px}
.foot .fl{font-size:10.5px;color:var(--muted);line-height:1.7}.foot .fl strong{color:var(--navy)}
.foot .fr{font-size:11px;color:var(--blue);font-weight:800}
.conf{margin-top:10px;text-align:center;font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted2)}
.note{margin-top:10px;font-size:11px;color:var(--muted);line-height:1.6}
`;

function renderLineRows(lines: InvoiceLineItemRow[], currency: string): string {
  if (lines.length === 0) {
    return `<tr><td colspan="5" class="mut">No line items on this invoice.</td></tr>`;
  }

  return lines
    .map((line) => {
      const sub = line.subDescription
        ? `<span class="dsub">${display(line.subDescription)}</span>`
        : "";
      return `<tr>
        <td><span class="dmain">${display(line.description)}</span>${sub}</td>
        <td class="r">${line.quantity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="r">${formatMoneyAmount(line.revenueBeforeVat)}</td>
        <td class="r mut">${esc(formatTaxLabel(line))}</td>
        <td class="amt">${formatMoneyAmount(line.lineTotal)}</td>
      </tr>`;
    })
    .join("");
}

export function buildInvoiceTemplateHtml(data: InvoiceDocumentData): string {
  const agency = THINKWAY_AGENCY_DEFAULTS;
  const currency = data.currencyCode;
  const docNum = display(data.documentNumber, "INV-PENDING");
  const issueDate = formatShortDate(data.issueDate);
  const dueDateShort = formatShortDate(data.dueDate);
  const dueDateLong = formatLongDueDate(data.dueDate);
  const ioRef = display(data.campaign?.clientIoReferenceDisplay);
  const poRef = display(data.campaign?.poReferenceDisplay);
  const internalRef = display(data.campaign?.internalReference);
  const clientName = display(data.client.billingName);
  const clientLegalName = display(data.client.legalName ?? data.client.name);
  const trn = display(data.client.vatNumber ?? data.client.taxId);
  const accountNumber = display(data.client.documentNumber);
  const paymentTerms = display(
    data.client.paymentTerms ?? "Net 30 Days",
    "Net 30 Days"
  );
  const vat = resolveInvoiceDocumentVat(data);
  const vatPill = `VAT ${vat.vatPercent}% Included`;

  const clientAddressLines = [
    data.client.addressLine1,
    data.client.addressLine2 ?? data.client.cityCountry,
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .map((part) => esc(part.trim()))
    .join("<br>");

  const notesBlock = data.notes?.trim()
    ? `<p class="note"><strong>Notes:</strong> ${esc(data.notes.trim())}</p>`
    : "";

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Tax Invoice — ${docNum} — Thinkway</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>${INVOICE_STYLES}</style></head><body>
<div class="page">
  <div class="hdr"><div class="c1"></div><div class="c2"></div>
  <div class="hrow">
    <div>
      <div class="mk"><span class="mkbox"></span>THINKWAY</div>
      <div class="htag">Influencer Marketing Agency · ثينكواي</div>
      <div class="haddr"><strong>${esc(agency.legalName)}</strong><br>44B Saraya Mall, Central Axis<br>
        Sheikh Zayed City, Giza, Egypt<br>CR: ${esc(agency.commercialRegister)} · Tax Reg: ${esc(agency.taxRegistration)} · VAT: ${esc(agency.vatNumber)}</div>
    </div>
    <div class="tblock">
      <div class="itype">Official Document</div>
      <div class="ititle">TAX INVOICE</div>
      <div><span class="badge">${docNum}</span></div>
      <div class="hmeta">
        <div class="m"><b>Invoice Date</b> &nbsp; ${issueDate}</div>
        <div class="m"><b>Due Date</b> &nbsp; ${dueDateShort}</div>
        <div class="m"><b>IO Reference</b> &nbsp; ${ioRef}</div>
        <div class="m"><b>Internal Ref</b> &nbsp; ${internalRef}</div>
      </div>
    </div>
  </div>
</div>
  <div class="body">
    <div class="section">
  <div class="sect">01 · Parties<span class="aft"></span></div>
  <div class="grid2">
    <div class="pcard">
      <div class="prole">Billed To</div>
      <div class="pname">${clientName}</div>
      <div class="pdet">${clientAddressLines || "—"}
        <br><span class="trn">TRN: ${trn}</span></div>
    </div>
    <div class="pcard from">
      <div class="prole">From (Supplier)</div>
      <div class="pname">${esc(agency.legalName)}</div>
      <div class="pdet">44B Saraya Mall, Central Axis<br>Sheikh Zayed City, Giza, Egypt
        <br><span class="trn">VAT: ${esc(agency.vatNumber)} · CR: ${esc(agency.commercialRegister)}</span></div>
    </div>
  </div>
</div>
    <div class="section">
  <div class="sect">02 · Invoice Details<span class="aft"></span></div>
  <div class="fields">
    <div class="frow c4">
      <div class="fcell sh"><div class="flabel">Invoice Number</div><div class="fval blue">${docNum}</div></div>
      <div class="fcell"><div class="flabel">Invoice Date</div><div class="fval">${issueDate}</div></div>
      <div class="fcell"><div class="flabel">IO / PO Reference</div><div class="fval">${poRef}</div></div>
      <div class="fcell"><div class="flabel">Account Number</div><div class="fval">${accountNumber}</div></div>
    </div>
    <div class="frow c4">
      <div class="fcell sh"><div class="flabel">Campaign No.</div><div class="fval blue">${display(data.campaign?.documentNumber)}</div></div>
      <div class="fcell sh"><div class="flabel">Campaign / Project</div><div class="fval">${display(data.campaign?.name)}</div></div>
      <div class="fcell"><div class="flabel">Client</div><div class="fval">${clientLegalName}</div></div>
      <div class="fcell"><div class="flabel">Campaign Period</div><div class="fval">${formatCampaignPeriod(data.campaign?.startDate ?? null, data.campaign?.endDate ?? null)}</div></div>
    </div>
  </div>
</div>
    <div class="section">
  <div class="sect">03 · Line Items<span class="aft"></span></div>
  <table class="tbl">
    <thead><tr><th style="width:46%">Description</th><th class="r">Qty</th>
      <th class="r">Unit Price (${esc(currency)})</th><th class="r">Tax</th><th class="r">Amount (${esc(currency)})</th></tr></thead>
    <tbody>${renderLineRows(data.lineItems, currency)}</tbody>
  </table>
  <div class="tot-wrap"><div class="tot-box">
    <div class="tot-row sh"><span class="k">Subtotal (excl. VAT)</span><span class="v">${formatMoney(vat.subtotal, currency)}</span></div>
    <div class="tot-row sh"><span class="k">${esc(vat.vatLabel)}</span><span class="v">${formatMoney(vat.taxAmount, currency)}</span></div>
    <div class="grand"><span class="k">Total Amount Due</span><span class="v">${formatMoney(vat.total, currency)}</span></div>
  </div></div>
  ${notesBlock}
</div>
    <div class="section">
  <div class="sect">04 · Payment Details<span class="aft"></span></div>
  <div class="grid2b">
    <div>
      <div class="due">
        <div class="dl">Payment Due Date</div>
        <div class="dd">${dueDateLong}</div>
        <div class="dn">Payment is due within 30 days of invoice date. Late payments may be subject to applicable charges under Egyptian law.</div>
      </div>
      <div class="pills">
        <span class="chip"><span class="dot"></span>${paymentTerms}</span>
        <span class="chip"><span class="dot"></span>Bank Transfer Only</span>
        <span class="chip"><span class="dot"></span>${esc(vatPill)}</span>
      </div>
    </div>
    <div class="bank">
      <div class="bh">Bank Transfer Details</div>
      <div class="brow"><span class="bk">Beneficiary</span><span class="bv">${esc(agency.beneficiary)}</span></div>
      <div class="brow"><span class="bk">Bank</span><span class="bv">Arab African International Bank (AAIB)</span></div>
      <div class="brow"><span class="bk">Branch</span><span class="bv">Park Street Branch</span></div>
      <div class="brow"><span class="bk">Account No.</span><span class="bv">${esc(agency.accountNumber)}</span></div>
      <div class="brow"><span class="bk">IBAN</span><span class="bv">${esc(agency.iban)}</span></div>
      <div class="brow"><span class="bk">SWIFT</span><span class="bv">${esc(agency.swift)}</span></div>
    </div>
  </div>
</div>
    <div class="advice">
  <div class="advdiv"></div>
  <div class="advgrid">
    <div class="advl">
      <div class="tl">To (Supplier)</div>
      <div class="tn">${esc(agency.legalName)}</div>
      <div class="td">44B Saraya Mall, Central Axis<br>Sheikh Zayed City, Giza, Egypt<br>
        VAT: ${esc(agency.vatNumber)} · CR: ${esc(agency.commercialRegister)}<br>Tax Reg: ${esc(agency.taxRegistration)}</div>
    </div>
    <div class="advr">
      <div class="af"><div class="al">Customer</div><div class="av">${clientName}</div></div>
      <div class="af"><div class="al">Invoice Number</div><div class="av">${docNum}</div></div>
      <div class="af"><div class="al">Amount Due</div><div class="av lg">${formatMoney(vat.total, currency)}</div></div>
      <div class="af"><div class="al">Due Date</div><div class="av">${dueDateLong}</div></div>
      <div class="af"><div class="al">Amount Enclosed</div><div class="encl"></div></div>
    </div>
  </div>
</div>
    <div class="foot">
    <div class="fl"><strong>${esc(agency.legalName)}</strong> · CR ${esc(agency.commercialRegister)} · VAT ${esc(agency.vatNumber)} · Tax Reg. ${esc(agency.taxRegistration)}<br>
      44B Saraya Mall, Central Axis, Sheikh Zayed, Giza, Egypt · ${esc(agency.email)}</div>
    <div class="fr">${docNum}</div>
  </div>
  <div class="conf">Confidential &amp; Proprietary — Thinkway ${new Date().getFullYear()}</div>
  </div>
</div>
</body></html>`;

  return applyThinkwayLogoToDocumentHtml(html);
}
