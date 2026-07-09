import { NextResponse } from "next/server";

import {
  buildShortlistCsv,
} from "@/features/discovery/shortlists/export/shortlist-csv";
import {
  buildShortlistDocument,
  embedShortlistDocumentAvatars,
  shortlistDocumentBaseName,
} from "@/features/discovery/shortlists/export/shortlist-document";
import { buildShortlistExcel } from "@/features/discovery/shortlists/export/shortlist-excel";
import { buildShortlistHtml } from "@/features/discovery/shortlists/export/shortlist-html";
import { resolveShortlistTemplate } from "@/features/discovery/shortlists/export/shortlist-template";
import { getShortlistDetail } from "@/features/discovery/shortlists/queries";
import { pdfUnavailableMessage, renderHtmlToPdf } from "@/lib/io/vendor-io-pdf";
import { getClientIp, requireApiPermission } from "@/lib/auth/api-auth";
import { logAuditEvent } from "@/lib/audit/log-audit-event";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseItemIds(raw: string | null): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const ids = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "preview";
  const download = searchParams.get("download") === "1";
  const template = resolveShortlistTemplate(searchParams.get("template"));
  const itemIds = parseItemIds(searchParams.get("items"));

  const supabase = await createSupabaseServerClient();
  const auth = await requireApiPermission(supabase, "discovery.read");
  if ("response" in auth) return auth.response;

  try {
    const detail = await getShortlistDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Shortlist not found" }, { status: 404 });
    }

    void logAuditEvent(supabase, {
      userId: auth.userId,
      action: "export",
      entityType: "shortlist",
      entityId: id,
      metadata: { format, download },
      ip: getClientIp(request),
    });

    const doc = buildShortlistDocument(detail, { template, itemIds });
    const baseName = shortlistDocumentBaseName(doc);
    const disposition = download ? "attachment" : "inline";
    const templateSuffix = template === "detailed" ? "-detailed" : "";

    if (format === "csv") {
      const csv = buildShortlistCsv(doc);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `${disposition}; filename="${baseName}${templateSuffix}.csv"`,
        },
      });
    }

    if (format === "excel") {
      const buffer = await buildShortlistExcel(doc);
      return new NextResponse(buffer as unknown as BodyInit, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${baseName}${templateSuffix}.xlsx"`,
        },
      });
    }

    if (format === "word") {
      const exportDoc = await embedShortlistDocumentAvatars(doc);
      const wordHtml = buildShortlistHtml(exportDoc);
      return new NextResponse(wordHtml, {
        headers: {
          "Content-Type": "application/msword",
          "Content-Disposition": `attachment; filename="${baseName}${templateSuffix}.doc"`,
        },
      });
    }

    if (format === "pdf") {
      const exportDoc = await embedShortlistDocumentAvatars(doc);
      const pdfHtml = buildShortlistHtml(exportDoc);
      const pdfResult = await renderHtmlToPdf(pdfHtml);
      if (!pdfResult.ok) {
        return NextResponse.json(
          { error: pdfUnavailableMessage(pdfResult.error) },
          { status: 503 }
        );
      }
      return new NextResponse(pdfResult.buffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${disposition}; filename="${baseName}${templateSuffix}.pdf"`,
        },
      });
    }

    const exportDoc = await embedShortlistDocumentAvatars(doc);
    const html = buildShortlistHtml(exportDoc);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `${disposition}; filename="${baseName}${templateSuffix}.html"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to export shortlist";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
