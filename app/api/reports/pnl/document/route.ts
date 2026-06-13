import { NextResponse } from "next/server";

import {
  getPnLReport,
  parsePnLReportSearchParams,
} from "@/lib/analytics/queries/pnl-report";
import {
  buildPnlReportExcelBuffer,
  buildPnlReportFileBaseNameSafe,
  buildPnlReportHtml,
} from "@/lib/reports/document/pnl-report-document";
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

    const query = parsePnLReportSearchParams(queryParams);
    const report = await getPnLReport(query);
    const baseName = buildPnlReportFileBaseNameSafe(report);

    if (format === "html") {
      const html = buildPnlReportHtml(report);
      return createHtmlDocumentResponse(html, baseName, download);
    }

    if (format === "xlsx") {
      const buffer = await buildPnlReportExcelBuffer(report);
      return createXlsxDocumentResponse(buffer, baseName, true);
    }

    const html = buildPnlReportHtml(report);
    return createPdfFromHtmlResponse(html, baseName, download);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export P&L report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
