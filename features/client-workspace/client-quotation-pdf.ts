import { loadClientWorkspaceDisplayFlags } from "@/lib/commercial/client-original-currency-persist";
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

export async function renderExistingQuotationHtml(input: {
  supabase: SupabaseClient<Database>;
  quotationId: string;
  host?: string | null;
  proto?: string | null;
}): Promise<
  | { ok: true; html: string; filename: string }
  | { ok: false; message: string }
> {
  const detail = await getQuotationDetail(input.supabase, input.quotationId);
  if (!detail) return { ok: false, message: "Quotation not found." };
  const enriched = await enrichQuotationDetailForExport(input.supabase, detail);
  const displayFxRateToEgp = await resolveRateToEgp(input.supabase, enriched.currency || "EGP");
  const flags = await loadClientWorkspaceDisplayFlags(input.supabase, { quotationId: input.quotationId, shortlistId: detail.shortlist_id });
  const doc = buildQuotationDocument({ ...enriched, hideCostAndFees: flags.hideCostAndFees }, { displayFxRateToEgp, showOriginalCurrency: flags.showOriginalCurrency });
  const siteOrigin = resolveQuotationExportSiteOrigin(input.host, input.proto);
  const logoSrcs = resolveThinkwayReportLogoSrcsForExport();
  const html = buildQuotationHtml(doc, { siteOrigin, logoSrcs, forPdf: true });
  return { ok: true, html, filename: `${doc.serial}-${quotationExportFilenameRevision(detail.updated_at)}.pdf` };
}

export async function renderExistingQuotationPdf(input: Parameters<typeof renderExistingQuotationHtml>[0]): Promise<
  | { ok: true; buffer: Buffer; filename: string }
  | { ok: false; message: string }
> {
  const rendered = await renderExistingQuotationHtml(input);
  if (!rendered.ok) return rendered;
  const pdfResult = await renderHtmlToPdf(rendered.html, QUOTATION_PDF_OPTIONS);
  if (!pdfResult.ok) return { ok: false, message: pdfUnavailableMessage(pdfResult.error) };
  const filename = rendered.filename;
  return { ok: true, buffer: pdfResult.buffer, filename };
}
