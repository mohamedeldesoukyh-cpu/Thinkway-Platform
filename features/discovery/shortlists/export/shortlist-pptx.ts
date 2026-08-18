import { shortlistDocumentToQuotationDocument } from "./shortlist-as-quotation-document";
import type { ShortlistDocument } from "./shortlist-document";
import { buildQuotationPptxBuffer } from "@/features/quotations/export/quotation-pptx";

export async function buildShortlistPptxBuffer(
  doc: ShortlistDocument,
  options?: { siteOrigin?: string }
): Promise<Buffer> {
  return buildQuotationPptxBuffer(shortlistDocumentToQuotationDocument(doc), {
    siteOrigin: options?.siteOrigin,
  });
}
