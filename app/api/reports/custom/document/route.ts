import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCustomReport } from "@/lib/reports/queries/get-custom-report";
import { CUSTOM_CURRENCIES } from "@/lib/reports/custom/custom-report";
import { buildCustomReportHtml, buildCustomReportExcelBuffer, parseCustomDocumentColumns } from "@/lib/reports/document/custom-report-document";
import { createHtmlDocumentResponse, createPdfFromHtmlResponse, createXlsxDocumentResponse, THINKWAY_REPORT_PDF_OPTIONS } from "@/lib/reports/document/report-document-response";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const format = params.get("format");
  const keys = parseCustomDocumentColumns(params);
  if (!keys.length || !["html", "pdf", "xlsx"].includes(format ?? "")) return NextResponse.json({ error: "Select at least one column and a supported format." }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "analytics.read");
  if ("response" in auth) return auth.response;
  try {
    const currency = CUSTOM_CURRENCIES.find(c => c === params.get("currency")) ?? "EGP";
    const report = await getCustomReport(Object.fromEntries(params), currency, supabase);
    const name = `TW-Custom-Report-${report.asOf}-${currency}`;
    const download = params.get("download") === "1";
    if (format === "xlsx") return createXlsxDocumentResponse(await buildCustomReportExcelBuffer(report, keys, params.get("reportName") ?? "Custom Report"), name, true);
    const html = buildCustomReportHtml(report, keys, params);
    if (format === "html") return createHtmlDocumentResponse(html, name, download);
    return await createPdfFromHtmlResponse(html, name, download, { ...THINKWAY_REPORT_PDF_OPTIONS, width: "297mm", height: "210mm", viewport: { width: 1123, height: 794, deviceScaleFactor: 1 }, waitForDocumentAttribute: { name: "data-custom-report-ready", value: "true" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to export custom report" }, { status: 500 });
  }
}
