/**
 * Enterprise shortlist HTML — preview / Word / PDF share the quotation renderer.
 */
import { shortlistDocumentToQuotationDocument } from "./shortlist-as-quotation-document";
import type { ShortlistDocument } from "./shortlist-document";
import {
  buildQuotationHtml,
  type BuildQuotationHtmlOptions,
} from "@/features/quotations/export/quotation-html";

export type BuildShortlistHtmlOptions = BuildQuotationHtmlOptions;

export function buildShortlistHtml(
  doc: ShortlistDocument,
  options?: BuildShortlistHtmlOptions
): string {
  return buildQuotationHtml(shortlistDocumentToQuotationDocument(doc), options);
}
