import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOverviewReport } from "@/lib/reports/queries/get-overview-report";
import { buildOverviewReportExcelBuffer, buildOverviewReportHtml } from "@/lib/reports/document/overview-report-document";
import { createHtmlDocumentResponse, createPdfFromHtmlResponse, createXlsxDocumentResponse, THINKWAY_REPORT_PDF_OPTIONS } from "@/lib/reports/document/report-document-response";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const format = params.get("format");
  if (!["html", "pdf", "xlsx"].includes(format ?? "")) return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "analytics.read");
  if ("response" in auth) return auth.response;
  try {
    const report = await getOverviewReport(Object.fromEntries(params), supabase);
    const name = `TW-Overview-${report.filters.asOf}`;
    const download = params.get("download") === "1";
    if (format === "xlsx") return createXlsxDocumentResponse(await buildOverviewReportExcelBuffer(report), name, true);
    const html = buildOverviewReportHtml(report);
    if (format === "html") return createHtmlDocumentResponse(html, name, download);
    return await createPdfFromHtmlResponse(html, name, download, { ...THINKWAY_REPORT_PDF_OPTIONS, width: "297mm", height: "210mm", viewport: { width: 1123, height: 794, deviceScaleFactor: 1 } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to export overview report" }, { status: 500 });
  }
}
