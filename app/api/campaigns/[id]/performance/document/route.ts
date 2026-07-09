import { NextResponse } from "next/server";

import {
  buildPerformanceReportExcelBuffer,
  buildPerformanceReportFileBaseName,
  buildPerformanceReportPptxBuffer,
  loadPerformanceReportDocumentData,
  renderPerformanceReportHtml,
  type PerformanceReportVariant,
} from "@/lib/performance/report";
import {
  createHtmlDocumentResponse,
  createPdfFromHtmlResponse,
  createPptxDocumentResponse,
  createXlsxDocumentResponse,
  parseReportDocumentFormat,
} from "@/lib/reports/document/report-document-response";
import { PERFORMANCE_REPORT_PDF_OPTIONS } from "@/lib/io/vendor-io-pdf";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/uuid";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function parseVariant(raw: string | null): PerformanceReportVariant {
  return raw === "influencers" ? "influencers" : "combined";
}

function parsePublicationIds(raw: string | null): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => isUuid(id));
  return ids.length > 0 ? ids : undefined;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await context.params;
  const { searchParams } = new URL(request.url);
  const format = parseReportDocumentFormat(searchParams.get("format"));
  const download = searchParams.get("download") === "1";
  const variant = parseVariant(searchParams.get("variant"));
  const publicationIds = parsePublicationIds(searchParams.get("publicationIds"));

  if (!format) {
    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  }

  if (!isUuid(campaignId)) {
    return NextResponse.json({ error: "Invalid campaign ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "analytics.read");
  if ("response" in auth) return auth.response;

  const { data: campaign, error: campaignError } = await supabase
    .from("campaign_headers")
    .select("id, document_number")
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const reportData = await loadPerformanceReportDocumentData(supabase, campaignId, variant, {
    publicationIds,
  });
  const baseName = buildPerformanceReportFileBaseName(
    reportData.campaign.name,
    reportData.campaign.documentNumber,
    variant
  );

  if (format === "html") {
    const html = renderPerformanceReportHtml(reportData);
    return createHtmlDocumentResponse(html, baseName, download);
  }

  if (format === "xlsx") {
    const buffer = await buildPerformanceReportExcelBuffer(reportData);
    return createXlsxDocumentResponse(buffer, baseName, true);
  }

  if (format === "pptx") {
    const buffer = await buildPerformanceReportPptxBuffer(reportData);
    return createPptxDocumentResponse(buffer, baseName, true);
  }

  const html = renderPerformanceReportHtml(reportData);
  return createPdfFromHtmlResponse(html, baseName, download, PERFORMANCE_REPORT_PDF_OPTIONS);
}
