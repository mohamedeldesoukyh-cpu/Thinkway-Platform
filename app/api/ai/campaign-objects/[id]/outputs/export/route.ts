import { NextResponse } from "next/server";

import {
  getApprovedSnapshot,
  prepareCampaignObjectForExport,
} from "@/features/campaign-intelligence/services/campaign-export";
import { enrichCampaignObjectQuotationContext } from "@/features/campaign-outputs/hydration/enrich-quotation-commercials-context";
import { embedMediaPlanContentAvatars } from "@/features/campaign-outputs/export/media-plan-export-avatars";
import { buildMediaPlanExcel } from "@/features/campaign-outputs/export/media-plan-excel";
import { buildMediaPlanHtml } from "@/features/campaign-outputs/export/media-plan-html";
import { resolveMediaPlanCampaignContext } from "@/features/campaign-outputs/generators/media-plan";
import { MEDIA_PLAN_PDF_OPTIONS } from "@/features/campaign-outputs/export/media-plan-pdf";
import { buildMediaPlanPptxBuffer } from "@/features/campaign-outputs/export/media-plan-pptx";
import { resolveThinkwayReportLogoSrcsForExport } from "@/lib/reports/document/thinkway-report-logo-embed";
import { mediaPlanExportBaseName } from "@/features/campaign-outputs/export/media-plan-export-utils";
import {
  generateCampaignOutput,
  getOutputContentForDisplay,
} from "@/features/campaign-outputs/output-registry";
import type { CampaignOutputKind } from "@/features/campaign-outputs/output-types";
import { getOutputDefinition } from "@/features/campaign-outputs/output-catalog";
import {
  createHtmlDocumentResponse,
  createPdfFromHtmlResponse,
  createPptxDocumentResponse,
  createXlsxDocumentResponse,
} from "@/lib/reports/document/report-document-response";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Landscape calendar PDF can exceed the default limit. */
export const maxDuration = 120;
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const EXPORT_KINDS = new Set<CampaignOutputKind>(["media_plan"]);

function resolveExportKind(raw: string | null): CampaignOutputKind | null {
  if (raw === "media_plan") return "media_plan";
  return null;
}

function resolveExportFormat(raw: string | null): "html" | "pdf" | "excel" | "pptx" | null {
  if (raw === "html" || raw === "pdf" || raw === "excel" || raw === "pptx") return raw;
  return null;
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const kind = resolveExportKind(url.searchParams.get("kind"));
  const format = resolveExportFormat(url.searchParams.get("format"));
  const conversationId = url.searchParams.get("conversationId") ?? undefined;
  const download = url.searchParams.get("download") !== "0";

  if (!kind || !EXPORT_KINDS.has(kind)) {
    return NextResponse.json({ error: "Unsupported output kind for export." }, { status: 400 });
  }
  if (!format) {
    return NextResponse.json({ error: "Unsupported export format." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.read");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const snapshot = await getApprovedSnapshot(supabase, {
      campaignObjectId: id,
      conversationId,
    });

    if (!snapshot) {
      return NextResponse.json({ error: "Campaign object not found." }, { status: 404 });
    }

    let campaignObject = prepareCampaignObjectForExport(snapshot);

    let workspaceType: string | undefined;
    let workspaceId: string | undefined;
    if (conversationId) {
      const { data: conversationRow } = await supabase
        .from("ai_conversations")
        .select("workspace_type, workspace_id")
        .eq("id", conversationId)
        .maybeSingle();
      workspaceType = (conversationRow as { workspace_type?: string } | null)?.workspace_type;
      workspaceId = (conversationRow as { workspace_id?: string | null } | null)?.workspace_id ?? undefined;
    }

    campaignObject = await enrichCampaignObjectQuotationContext(supabase, campaignObject, {
      workspaceType,
      workspaceId,
    });
    const definition = getOutputDefinition(kind);
    if (!definition?.generate) {
      return NextResponse.json({ error: "This output cannot be exported yet." }, { status: 400 });
    }

    let content = getOutputContentForDisplay(campaignObject, kind);
    if (!content) {
      const generated = generateCampaignOutput(campaignObject, kind);
      campaignObject = generated.campaignObject;
      content = generated.record.content;
    }

    if (!content) {
      return NextResponse.json({ error: "Output content is unavailable." }, { status: 404 });
    }

    const baseName = mediaPlanExportBaseName(content);

    if (format === "excel") {
      const buffer = await buildMediaPlanExcel(content);
      return createXlsxDocumentResponse(buffer, baseName, download);
    }

    const contextOverride = resolveMediaPlanCampaignContext(campaignObject);

    if (format === "pptx") {
      const exportContent = await embedMediaPlanContentAvatars(content);
      const buffer = await buildMediaPlanPptxBuffer(exportContent, { contextOverride });
      return createPptxDocumentResponse(buffer, baseName, download);
    }

    let exportContent = content;
    if (format === "pdf") {
      exportContent = await embedMediaPlanContentAvatars(content);
    }

    const logoSrcs = format === "pdf" ? resolveThinkwayReportLogoSrcsForExport() : undefined;
    const html = buildMediaPlanHtml(exportContent, {
      logoSrcs,
      contextOverride,
    });

    if (format === "pdf") {
      return createPdfFromHtmlResponse(html, baseName, download, MEDIA_PLAN_PDF_OPTIONS);
    }

    return createHtmlDocumentResponse(html, baseName, download);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
