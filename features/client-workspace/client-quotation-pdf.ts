import { buildQuotationDocument } from "@/features/quotations/export/quotation-document";
import {
  enrichQuotationDetailForExport,
  resolveQuotationExportSiteOrigin,
} from "@/features/quotations/export/quotation-export-avatars";
import { buildQuotationHtml } from "@/features/quotations/export/quotation-html";
import { QUOTATION_PDF_OPTIONS } from "@/features/quotations/export/quotation-pdf";
import { quotationExportFilenameRevision } from "@/features/quotations/export/quotation-template";
import { resolveRateToEgp } from "@/lib/commercial/fx-server";
import { pdfUnavailableMessage, renderHtmlToPdf } from "@/lib/io/vendor-io-pdf";
import { resolveThinkwayReportLogoSrcsForExport } from "@/lib/reports/document/thinkway-report-logo-embed";
import { getQuotationDetail } from "@/lib/services/quotations/quotation-document-service";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function renderExistingQuotationPdf(input: {
  supabase: SupabaseClient<Database>;
  quotationId: string;
  host?: string | null;
  proto?: string | null;
}): Promise<
  | { ok: true; buffer: Buffer; filename: string }
  | { ok: false; message: string }
> {
  const detail = await getQuotationDetail(input.supabase, input.quotationId);
  if (!detail) return { ok: false, message: "Quotation not found." };
  const enriched = await enrichQuotationDetailForExport(input.supabase, detail);
  const displayFxRateToEgp = await resolveRateToEgp(input.supabase, enriched.currency || "EGP");
  const doc = buildQuotationDocument(enriched, { displayFxRateToEgp });
  const siteOrigin = resolveQuotationExportSiteOrigin(input.host, input.proto);
  const logoSrcs = resolveThinkwayReportLogoSrcsForExport();
  const html = buildQuotationHtml(doc, { siteOrigin, logoSrcs, forPdf: true });
  const pdfResult = await renderHtmlToPdf(html, QUOTATION_PDF_OPTIONS);
  if (!pdfResult.ok) return { ok: false, message: pdfUnavailableMessage(pdfResult.error) };
  const filename = `${doc.serial}-${quotationExportFilenameRevision(detail.updated_at)}.pdf`;
  return { ok: true, buffer: pdfResult.buffer, filename };
}
