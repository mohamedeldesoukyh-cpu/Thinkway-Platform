import { NextResponse } from "next/server";

import {
  getRevenueByFunctionReport,
  parseRevenueByFunctionSearchParams,
} from "@/lib/analytics/queries/revenue-by-function-report";
import {
  buildRevenueByFunctionFileBaseNameSafe,
  buildRevenueByFunctionReportExcelBuffer,
  buildRevenueByFunctionReportHtml,
} from "@/lib/reports/document/revenue-by-function-document";
import {
  createHtmlDocumentResponse,
  createPdfFromHtmlResponse,
  createXlsxDocumentResponse,
  parseReportDocumentFormat,
} from "@/lib/reports/document/report-document-response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = parseReportDocumentFormat(searchParams.get("format"));
  const download = searchParams.get("download") === "1";

  if (!format) {
    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const queryParams: Record<string, string | string[] | undefined> = {};
    searchParams.forEach((value, key) => {
      if (key !== "format" && key !== "download") {
        queryParams[key] = value;
      }
    });

    const query = parseRevenueByFunctionSearchParams(queryParams);
    const report = await getRevenueByFunctionReport(query);
    const baseName = buildRevenueByFunctionFileBaseNameSafe(report);

    if (format === "html") {
      const html = buildRevenueByFunctionReportHtml(report);
      return createHtmlDocumentResponse(html, baseName, download);
    }

    if (format === "xlsx") {
      const buffer = await buildRevenueByFunctionReportExcelBuffer(report);
      return createXlsxDocumentResponse(buffer, baseName, true);
    }

    const html = buildRevenueByFunctionReportHtml(report);
    return createPdfFromHtmlResponse(html, baseName, download);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to export revenue by function report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
