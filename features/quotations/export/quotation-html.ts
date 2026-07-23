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
  return buildQuotationTemplateHtml(doc, options);
}
