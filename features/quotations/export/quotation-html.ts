import { omitReportPages } from "@/features/discovery/document-preview/report-page-selection";
import { isPricedCreatorListTemplate } from "./quotation-template";
import { buildQuotationCreatorListHtml } from "./quotation-creator-list";
import { isQuotationListTemplate } from "./quotation-template";
import { applyMobileDocumentLayout } from "@/lib/reports/document/mobile-document-layout";
/**
 * Enterprise client quotation HTML — cover, commercial grid, summary, terms, signatures.
 * Preview / Word / PDF share this renderer (puppeteer via vendor-io-pdf).
 */
import type { QuotationDocument } from "./quotation-document";
import {
  buildQuotationTemplateHtml,
  type BuildQuotationTemplateHtmlOptions,
} from "@/features/quotations/templates/quotation-template-html";
import type { ThinkwayReportLogoSrcs } from "@/lib/reports/document/thinkway-report-logo";

export type BuildQuotationHtmlOptions = BuildQuotationTemplateHtmlOptions & {
  logoSrcs?: ThinkwayReportLogoSrcs;
  excludedPages?: number[];
};

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

export function buildQuotationHtml(
  doc: QuotationDocument,
  options?: BuildQuotationHtmlOptions
): string {
  if (isQuotationListTemplate(doc.template)) {
    const html = omitReportPages(withOtherServices(buildQuotationCreatorListHtml(doc), doc), options?.excludedPages ?? []);
    return isPricedCreatorListTemplate(doc.template) ? html : applyMobileDocumentLayout(html);
  }
  return applyMobileDocumentLayout(withOtherServices(buildQuotationTemplateHtml(doc, options), doc));
}

/** Supplier scope stays visible in every report, without fabricated social metrics. */
function withOtherServices(html: string, doc: QuotationDocument): string {
  const rows = doc.otherServiceRows ?? [];
  if (!rows.length) return html;
  const showPrices = !["client-list-by-name", "pitch", "showcase", "creator-list-package"].includes(doc.template);
  const pages: string[] = [];
  const batches: typeof rows[] = [];
  for (const row of rows) {
    const last = batches.at(-1);
    if (!last || last.length >= 5 || last.reduce((n, r) => n + r.serviceDescription.length + 100, 0) + row.serviceDescription.length > 2200) batches.push([row]);
    else last.push(row);
  }
  for (const batch of batches) {
    pages.push(`<section class="page cpage other-services-page" style="padding:40px;box-sizing:border-box;break-before:page;break-inside:avoid"><h1 style="font-size:28px;margin:0 0 12px">Others</h1><p>${esc(doc.serial)} · ${esc(doc.name)}</p><table style="width:100%;border-collapse:collapse;margin-top:24px;font-size:16px;line-height:1.4"><thead><tr><th style="text-align:left;padding:12px;border-bottom:1px solid currentColor">Service / description</th>${showPrices ? '<th style="text-align:right;padding:12px;border-bottom:1px solid currentColor">Total price</th>' : ''}</tr></thead><tbody>${batch.map(row => `<tr><td style="padding:16px 12px;border-bottom:1px solid #cbd5e1;white-space:pre-wrap;overflow-wrap:anywhere">${esc(row.serviceDescription)}</td>${showPrices ? `<td style="padding:16px 12px;border-bottom:1px solid #cbd5e1;text-align:right;white-space:nowrap">${esc(row.totalInvestment)}</td>` : ''}</tr>`).join('')}</tbody></table><p style="margin-top:24px;font-size:13px">${showPrices ? 'Included in the quotation total. Amounts before VAT.' : 'Additional services included in this quotation.'}</p></section>`);
  }
  // Keep the closing/total page last in creator-list reports.
  const closing = '<section class="page page--end">';
  if (html.includes(closing)) {
    const withFooters = pages.map(page => page.replace('</section>', `<footer><span>${esc(doc.serial)}</span><s></s><span>0 / 0</span></footer></section>`));
    const result = html.replace(closing, `${withFooters.join('')}${closing}`);
    const footerPattern = /(<footer><span>[^<]*<\/span><s><\/s><span>)\d+ \/ \d+(<\/span><\/footer>)/g;
    const total = [...result.matchAll(footerPattern)].length;
    let page = 0;
    return result.replace(footerPattern, (_match, before, after) => `${before}${++page} / ${total}${after}`);
  }
  return html.replace('</body>', `${pages.join('')}</body>`);
}
