import { NextResponse } from "next/server";

import {
  buildUnsettledReportExcelBuffer,
  buildUnsettledReportFileBaseName,
  buildUnsettledReportHtml,
} from "@/lib/reports/document/unsettled-report-document";
import {
  createHtmlDocumentResponse,
  createPdfFromHtmlResponse,
  createXlsxDocumentResponse,
  parseReportDocumentFormat,
} from "@/lib/reports/document/report-document-response";
import {
  getUnsettledReport,
  parseUnsettledReportSearchParams,
} from "@/lib/reports/queries/get-unsettled-report";
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

    const query = parseUnsettledReportSearchParams(queryParams);

    if (!query.entityId) {
      return NextResponse.json(
        { error: "entityId is required for unsettled report export" },
        { status: 400 }
      );
    }

    const report = await getUnsettledReport(query);
    const baseName = buildUnsettledReportFileBaseName(report);

    if (format === "html") {
      const html = buildUnsettledReportHtml(report);
      return createHtmlDocumentResponse(html, baseName, download);
    }

    if (format === "xlsx") {
      const buffer = await buildUnsettledReportExcelBuffer(report);
      return createXlsxDocumentResponse(buffer, baseName, true);
    }

    const html = buildUnsettledReportHtml(report);
    return createPdfFromHtmlResponse(html, baseName, download);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to export unsettled report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
