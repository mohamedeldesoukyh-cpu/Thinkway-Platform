import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isClientIoRegenerateAllowed,
  listClientIoAssignmentIds,
} from "@/lib/io/client-io-assignments";
import { buildClientIoAssignmentSnapshot } from "@/lib/io/client-io-assignment-snapshot";
import { buildIoDocumentStoragePath } from "@/lib/io/io-document-storage";
import { loadClientIoDocumentData } from "@/lib/io/client-io-document-data";
import { renderHtmlToPdf } from "@/lib/io/vendor-io-pdf";
import { renderClientIoHtml } from "@/lib/io/client-io-template-render";
import type { ClientIoDocumentLayout } from "@/lib/io/client-io-document-layout";
import { emitEnterpriseTimelineEvent } from "@/lib/timeline/emit-enterprise-timeline-event";

export const CLIENT_IO_DOCUMENTS_BUCKET = "client-io-documents";

export type ClientIoDocumentResult = {
  clientIoId: string;
  documentNumber: string;
  html: string;
  htmlUrl: string | null;
  pdfUrl: string | null;
  generatedAt: string;
};

async function uploadDocument(
  supabase: SupabaseClient,
  clientIoId: string,
  fileName: string,
  body: Buffer | string,
  contentType: string
): Promise<string> {
  const path = buildIoDocumentStoragePath(clientIoId, fileName);
  const payload = typeof body === "string" ? Buffer.from(body, "utf8") : body;

  const { error } = await supabase.storage.from(CLIENT_IO_DOCUMENTS_BUCKET).upload(path, payload, {
    contentType,
    upsert: true,
    cacheControl: "3600",
  });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return path;
}

async function captureAssignmentSnapshot(
  supabase: SupabaseClient,
  clientIoId: string,
  campaignHeaderId: string,
  selectedCampaignLineIds: string[],
  capturedAt: string
) {
  const { data: lines, error: linesError } = await supabase
    .from("campaign_lines")
    .select(
      "id, document_number, name, metadata, revenue_before_vat, revenue, usage_rights_amount, agency_fee_amount, agency_fee_percent, revenue_vat_percent, revenue_vat_exempt, currency_code, sort_order"
    )
    .eq("campaign_header_id", campaignHeaderId)
    .in("id", selectedCampaignLineIds)
    .order("sort_order", { ascending: true });

  if (linesError) {
    throw new Error(linesError.message);
  }

  const typedLines = (lines ?? []) as Array<{
    id: string;
    document_number: string | null;
    name: string;
    metadata: Record<string, unknown> | null;
    revenue_before_vat: number | null;
    revenue: number | null;
    usage_rights_amount: number | null;
    agency_fee_amount: number | null;
    agency_fee_percent: number | null;
    revenue_vat_percent: number | null;
    revenue_vat_exempt: boolean | null;
    currency_code: string;
    sort_order: number | null;
  }>;

  const { data: deliverables, error: deliverablesError } = selectedCampaignLineIds.length
    ? await supabase
        .from("assignment_deliverables")
        .select(
          "platform, deliverable_type, quantity, live_date, campaign_line_id, sort_order"
        )
        .in("campaign_line_id", selectedCampaignLineIds)
        .order("sort_order", { ascending: true })
    : { data: [], error: null };

  if (deliverablesError) {
    throw new Error(deliverablesError.message);
  }

  return buildClientIoAssignmentSnapshot({
    capturedAt,
    selectedCampaignLineIds,
    lines: typedLines.map((line) => ({
      id: line.id,
      document_number: line.document_number,
      name: line.name,
      metadata: line.metadata,
      revenue_before_vat: line.revenue_before_vat,
      revenue: line.revenue,
      usage_rights_amount: line.usage_rights_amount,
      agency_fee_amount: line.agency_fee_amount,
      agency_fee_percent: line.agency_fee_percent,
      revenue_vat_percent: line.revenue_vat_percent,
      revenue_vat_exempt: line.revenue_vat_exempt,
      currency_code: line.currency_code,
      sort_order: line.sort_order,
    })),
    deliverables: ((deliverables ?? []) as Array<{
      platform: string;
      deliverable_type: string;
      quantity: number;
      live_date: string | null;
      campaign_line_id: string;
      sort_order: number | null;
    }>).map((row) => ({
      platform: row.platform,
      deliverable_type: row.deliverable_type,
      quantity: row.quantity,
      live_date: row.live_date,
      campaign_line_id: row.campaign_line_id,
      sort_order: row.sort_order,
    })),
  });
}

export async function generateClientIoDocument(
  supabase: SupabaseClient,
  clientIoId: string,
  actorId?: string,
  layout: ClientIoDocumentLayout = "detailed"
): Promise<ClientIoDocumentResult> {
  const { data: existing, error: existingError } = await supabase
    .from("client_ios")
    .select("document_number, status, campaign_header_id, is_superseded")
    .eq("id", clientIoId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }
  if (!existing) {
    throw new Error("Client IO not found");
  }

  const typedExisting = existing as {
    document_number: string | null;
    status: string;
    campaign_header_id: string;
    is_superseded?: boolean | null;
  };

  if (typedExisting.is_superseded) {
    throw new Error("Superseded Client IO versions are immutable.");
  }

  if (!isClientIoRegenerateAllowed(typedExisting.status)) {
    throw new Error(
      "This Client IO can no longer be regenerated in place. Create an amendment to open a new tip."
    );
  }

  const selectedIds = await listClientIoAssignmentIds(supabase, clientIoId);
  if (selectedIds.length === 0) {
    throw new Error("Select at least one Assignment before generating the Client IO document.");
  }

  if (!typedExisting.document_number) {
    await supabase
      .from("client_ios")
      .update({ updated_by: actorId ?? null } as never)
      .eq("id", clientIoId);
  }

  const generatedAt = new Date().toISOString();
  const snapshot = await captureAssignmentSnapshot(
    supabase,
    clientIoId,
    typedExisting.campaign_header_id,
    selectedIds,
    generatedAt
  );

  const { error: snapshotError } = await supabase
    .from("client_ios")
    .update({
      assignment_snapshot: snapshot,
      updated_by: actorId ?? null,
    } as never)
    .eq("id", clientIoId);

  if (snapshotError) {
    throw new Error(snapshotError.message);
  }

  const data = await loadClientIoDocumentData(supabase, clientIoId, actorId, {
    forceLive: true,
  });
  const html = renderClientIoHtml(data, layout);

  let htmlUrl: string | null = null;
  let pdfUrl: string | null = null;

  try {
    htmlUrl = await uploadDocument(
      supabase,
      clientIoId,
      "document.html",
      html,
      "text/html; charset=utf-8"
    );
  } catch (error) {
    console.warn("[client-io-document] HTML storage failed", error);
  }

  const pdfResult = await renderHtmlToPdf(html);
  if (pdfResult.ok) {
    try {
      pdfUrl = await uploadDocument(
        supabase,
        clientIoId,
        "document.pdf",
        pdfResult.buffer,
        "application/pdf"
      );
    } catch (error) {
      console.warn("[client-io-document] PDF storage failed", error);
    }
  }

  const { error: updateError } = await supabase
    .from("client_ios")
    .update({
      terms_html: html,
      generated_html_url: htmlUrl,
      generated_pdf_url: pdfUrl,
      document_generated_at: generatedAt,
      status: "generated",
      updated_by: actorId ?? null,
    } as never)
    .eq("id", clientIoId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  try {
    await emitEnterpriseTimelineEvent(supabase, {
      campaignHeaderId: typedExisting.campaign_header_id,
      actorId,
      entityType: "client_ios",
      entityId: clientIoId,
      action: "update",
      metadata: {
        event: "client_io.generated",
        summary: `Client IO ${data.documentNumber} generated (${selectedIds.length} Assignment${selectedIds.length === 1 ? "" : "s"})`,
        module: "client_io",
        client_io_id: clientIoId,
        selected_assignment_ids: selectedIds,
      },
      newData: {
        document_number: data.documentNumber,
        status: "generated",
        selected_assignment_count: selectedIds.length,
      },
    });
  } catch (error) {
    console.warn("[client-io-document] Timeline emit failed", error);
  }

  return {
    clientIoId,
    documentNumber: data.documentNumber,
    html,
    htmlUrl,
    pdfUrl,
    generatedAt,
  };
}
