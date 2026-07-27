import { NextResponse } from "next/server";

import {
  buildShortlistCsv,
} from "@/features/discovery/shortlists/export/shortlist-csv";
import {
  buildShortlistDocument,
  shortlistDocumentBaseName,
} from "@/features/discovery/shortlists/export/shortlist-document";
import {
  embedShortlistDocumentAvatars,
  resolveShortlistExportSiteOrigin,
} from "@/features/discovery/shortlists/export/shortlist-export-avatars";
import { buildShortlistExcel } from "@/features/discovery/shortlists/export/shortlist-excel";
import {
  embedShortlistDocumentPublicationShots,
  loadShortlistCreatorPublicationShots,
} from "@/features/discovery/shortlists/export/shortlist-export-publications";
import { buildShortlistHtml } from "@/features/discovery/shortlists/export/shortlist-html";
import { buildShortlistPptxBuffer } from "@/features/discovery/shortlists/export/shortlist-pptx";
import {
  isCreatorDeckTemplate,
  resolveShortlistTemplate,
} from "@/features/discovery/shortlists/export/shortlist-template";
import { getShortlistDetail } from "@/features/discovery/shortlists/queries";
import { pdfUnavailableMessage, renderHtmlToPdf } from "@/lib/io/vendor-io-pdf";
import { getClientIp, requireApiPermission } from "@/lib/auth/api-auth";
import { logAuditEvent } from "@/lib/audit/log-audit-event";
import { EMBEDDABLE_DOCUMENT_FRAME_HEADERS } from "@/lib/security/embeddable-document-headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Showcase embed + Chromium PDF can exceed 60s with many publication shots. */
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const EXPORT_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
} as const;

function withExportCacheHeaders(
  headers: Record<string, string>,
  options?: { embeddable?: boolean }
): Record<string, string> {
  return {
    ...headers,
    ...EXPORT_CACHE_HEADERS,
    ...(options?.embeddable ? EMBEDDABLE_DOCUMENT_FRAME_HEADERS : {}),
  };
}

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

function templateSuffix(template: ReturnType<typeof resolveShortlistTemplate>): string {
  if (template === "summary") return "";
  return `-${template}`;
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
      metadata: { format, download, template },
      ip: getClientIp(request),
    });

    const filteredItems =
      itemIds && itemIds.length > 0
        ? detail.creators.filter((item) => itemIds.includes(item.item_id))
        : detail.creators;

    const publicationShotsByCreatorKey =
      isCreatorDeckTemplate(template) && format !== "excel" && format !== "csv"
        ? await loadShortlistCreatorPublicationShots(supabase, filteredItems)
        : undefined;

    let doc = buildShortlistDocument(detail, {
      template,
      itemIds,
      publicationShotsByCreatorKey,
    });

    if (format !== "excel" && format !== "csv") {
      doc = await embedShortlistDocumentAvatars(doc);
      doc = await embedShortlistDocumentPublicationShots(doc);
    }

    const baseName = shortlistDocumentBaseName(doc);
    const disposition = download ? "attachment" : "inline";
    const suffix = templateSuffix(template);
    const siteOrigin = resolveShortlistExportSiteOrigin(
      request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
      request.headers.get("x-forwarded-proto")
    );

    if (format === "csv") {
      const csv = buildShortlistCsv(doc);
      return new NextResponse(csv, {
        headers: withExportCacheHeaders({
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `${disposition}; filename="${baseName}${suffix}.csv"`,
        }),
      });
    }

    if (format === "excel") {
      const buffer = await buildShortlistExcel(doc);
      return new NextResponse(buffer as unknown as BodyInit, {
        headers: withExportCacheHeaders({
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${baseName}${suffix}.xlsx"`,
        }),
      });
    }

    if (format === "pptx") {
      if (!isCreatorDeckTemplate(template)) {
        return NextResponse.json(
          { error: "PPTX export is available for Showcase and Pitch presentation templates only." },
          { status: 400 }
        );
      }
      const buffer = await buildShortlistPptxBuffer(doc);
      return new NextResponse(buffer as unknown as BodyInit, {
        headers: withExportCacheHeaders({
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "Content-Disposition": `attachment; filename="${baseName}${suffix}.pptx"`,
        }),
      });
    }

    if (format === "word") {
      const wordHtml = buildShortlistHtml(doc, { siteOrigin });
      return new NextResponse(wordHtml, {
        headers: withExportCacheHeaders({
          "Content-Type": "application/msword",
          "Content-Disposition": `attachment; filename="${baseName}${suffix}.doc"`,
        }),
      });
    }

    if (format === "pdf") {
      const pdfHtml = buildShortlistHtml(doc, { siteOrigin });
      const pdfResult = await renderHtmlToPdf(pdfHtml);
      if (!pdfResult.ok) {
        return NextResponse.json(
          { error: pdfUnavailableMessage(pdfResult.error) },
          { status: 503 }
        );
      }
      return new NextResponse(pdfResult.buffer as unknown as BodyInit, {
        headers: withExportCacheHeaders({
          "Content-Type": "application/pdf",
          "Content-Disposition": `${disposition}; filename="${baseName}${suffix}.pdf"`,
        }),
      });
    }

    const html = buildShortlistHtml(doc, { siteOrigin });
    // Inline HTML only — file downloads keep platform DENY framing.
    const isInlineHtmlPreview =
      !download && (format === "preview" || format === "html" || format === "htm");
    return new NextResponse(html, {
      headers: withExportCacheHeaders(
        {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `${disposition}; filename="${baseName}${suffix}.html"`,
        },
        { embeddable: isInlineHtmlPreview }
      ),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to export shortlist";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
