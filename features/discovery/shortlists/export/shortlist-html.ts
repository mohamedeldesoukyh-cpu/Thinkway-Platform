/**
 * Enterprise shortlist HTML — preview / Word / PDF share the quotation renderer.
 */
import { shortlistDocumentToQuotationDocument } from "./shortlist-as-quotation-document";
import type { ShortlistDocument } from "./shortlist-document";
import { buildCreatorListHtml } from "./creator-list-html";
import {
  buildQuotationHtml,
  type BuildQuotationHtmlOptions,
} from "@/features/quotations/export/quotation-html";

export type BuildShortlistHtmlOptions = BuildQuotationHtmlOptions;

export function buildShortlistHtml(
  doc: ShortlistDocument,
  options?: BuildShortlistHtmlOptions
): string {
  if (doc.template === "creator-list") return buildCreatorListHtml(doc);
  return buildQuotationHtml(shortlistDocumentToQuotationDocument(doc), options);
}
