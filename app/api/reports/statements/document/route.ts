import { NextResponse } from "next/server";

import {
  buildStatementsReportExcelBuffer,
  buildStatementsReportFileBaseName,
  buildStatementsReportHtml,
} from "@/lib/reports/document/statements-report-document";
import {
  createHtmlDocumentResponse,
  createPdfFromHtmlResponse,
  createXlsxDocumentResponse,
  parseReportDocumentFormat,
} from "@/lib/reports/document/report-document-response";
import {
  getStatementsReport,
  parseStatementsReportSearchParams,
} from "@/lib/reports/queries/get-statements-report";
import { requireApiPermission } from "@/lib/auth/api-auth";
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
  const auth = await requireApiPermission(supabase, "analytics.read");
  if ("response" in auth) return auth.response;

  try {
    const queryParams: Record<string, string | string[] | undefined> = {};
    searchParams.forEach((value, key) => {
      if (key !== "format" && key !== "download") {
        queryParams[key] = value;
      }
    });

    const query = parseStatementsReportSearchParams(queryParams);

    if (!query.entityId) {
      return NextResponse.json(
        { error: "entityId is required for statement export" },
        { status: 400 }
      );
    }

    const report = await getStatementsReport(query);
    const baseName = buildStatementsReportFileBaseName(report);

    if (format === "html") {
      const html = buildStatementsReportHtml(report);
      return createHtmlDocumentResponse(html, baseName, download);
    }

    if (format === "xlsx") {
      const buffer = await buildStatementsReportExcelBuffer(report);
      return createXlsxDocumentResponse(buffer, baseName, true);
    }

    const html = buildStatementsReportHtml(report);
    return createPdfFromHtmlResponse(html, baseName, download);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to export statement report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
