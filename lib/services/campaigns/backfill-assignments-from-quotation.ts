/**
 * Release 2.0 Phase 1 — Backfill wizard helpers (detect → dry-run → execute).
 * Never automatic; always user-driven and audited.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { logAuditEvent } from "@/lib/audit/log-audit-event";
import type { Database } from "@/types/database";

import {
  convertQuotationToAssignments,
  type ConvertQuotationToAssignmentsResult,
} from "./convert-quotation-to-assignments";

export type LegacyCampaignBackfillDetection = {
  eligible: boolean;
  campaignId: string;
  documentNumber: string;
  quotationId: string | null;
  quotationSerial: string | null;
  quotationStatus: string | null;
  lineCount: number;
  vendorLinkCount: number;
  vendorIoCount: number;
  invoiceLinkCount: number;
  reason: string;
  warnings: string[];
};

export async function detectLegacyCampaignForBackfill(
  supabase: SupabaseClient<Database>,
  campaignId: string
): Promise<LegacyCampaignBackfillDetection> {
  const { data: header, error } = await supabase
    .from("campaign_headers")
    .select("id, document_number, quotation_id")
    .eq("id", campaignId)
    .maybeSingle();

  if (error || !header) {
    return {
      eligible: false,
      campaignId,
      documentNumber: "",
      quotationId: null,
      quotationSerial: null,
      quotationStatus: null,
      lineCount: 0,
      vendorLinkCount: 0,
      vendorIoCount: 0,
      invoiceLinkCount: 0,
      reason: error?.message ?? "Campaign not found.",
      warnings: [],
    };
  }

  const [{ count: lineCount }, { count: vendorLinkCount }] = await Promise.all([
    supabase
      .from("campaign_lines")
      .select("id", { count: "exact", head: true })
      .eq("campaign_header_id", campaignId),
    supabase
      .from("campaign_influencers")
      .select("id", { count: "exact", head: true })
      .eq("campaign_header_id", campaignId),
  ]);

  const lines = lineCount ?? 0;
  const vendors = vendorLinkCount ?? 0;

  let vendorIoCount = 0;
  let invoiceLinkCount = 0;
  if (lines > 0) {
    const { data: lineRows } = await supabase
      .from("campaign_lines")
      .select("vendor_io_id, invoice_id")
      .eq("campaign_header_id", campaignId);
    for (const row of lineRows ?? []) {
      if ((row as { vendor_io_id?: string | null }).vendor_io_id) vendorIoCount += 1;
      if ((row as { invoice_id?: string | null }).invoice_id) invoiceLinkCount += 1;
    }
  }

  const quotationId = (header as { quotation_id?: string | null }).quotation_id ?? null;
  let quotationSerial: string | null = null;
  let quotationStatus: string | null = null;
  if (quotationId) {
    const { data: quote } = await supabase
      .from("quotations")
      .select("serial_number, status")
      .eq("id", quotationId)
      .maybeSingle();
    quotationSerial = (quote as { serial_number?: string | null } | null)?.serial_number ?? null;
    quotationStatus = (quote as { status?: string | null } | null)?.status ?? null;
  }

  const warnings: string[] = [];
  if (vendorIoCount > 0) {
    warnings.push("Vendor IO already exists on some lines — backfill will not modify them.");
  }
  if (invoiceLinkCount > 0) {
    warnings.push("Billing links already exist — backfill will not modify invoices.");
  }
  if (vendors > 0 && lines === 0) {
    warnings.push(
      `${vendors} vendor link(s) exist without Assignments (pre–Release 2.0 Path A shape).`
    );
  }

  const documentNumber =
    (header as { document_number?: string }).document_number ?? "";

  if (!quotationId) {
    return {
      eligible: false,
      campaignId,
      documentNumber,
      quotationId: null,
      quotationSerial,
      quotationStatus,
      lineCount: lines,
      vendorLinkCount: vendors,
      vendorIoCount,
      invoiceLinkCount,
      reason: "Campaign has no linked quotation — cannot backfill from quote.",
      warnings,
    };
  }

  if (lines > 0) {
    return {
      eligible: false,
      campaignId,
      documentNumber,
      quotationId,
      quotationSerial,
      quotationStatus,
      lineCount: lines,
      vendorLinkCount: vendors,
      vendorIoCount,
      invoiceLinkCount,
      reason: "Campaign already has Assignments.",
      warnings,
    };
  }

  if (quotationStatus !== "approved") {
    return {
      eligible: false,
      campaignId,
      documentNumber,
      quotationId,
      quotationSerial,
      quotationStatus,
      lineCount: lines,
      vendorLinkCount: vendors,
      vendorIoCount,
      invoiceLinkCount,
      reason: `Linked quotation status is "${quotationStatus ?? "unknown"}" — only approved quotations can backfill.`,
      warnings,
    };
  }

  return {
    eligible: true,
    campaignId,
    documentNumber,
    quotationId,
    quotationSerial,
    quotationStatus,
    lineCount: lines,
    vendorLinkCount: vendors,
    vendorIoCount,
    invoiceLinkCount,
    reason:
      "This Campaign was created before Release 2.0 and does not contain Assignments.",
    warnings,
  };
}

export async function previewBackfillAssignmentsFromQuotation(
  supabase: SupabaseClient<Database>,
  userId: string,
  campaignId: string
): Promise<ConvertQuotationToAssignmentsResult | { ok: false; message: string }> {
  const detection = await detectLegacyCampaignForBackfill(supabase, campaignId);
  if (!detection.eligible || !detection.quotationId) {
    return { ok: false, message: detection.reason };
  }

  const result = await convertQuotationToAssignments(supabase, userId, {
    quotationId: detection.quotationId,
    reuseHeaderId: campaignId,
    dryRun: true,
  });

  if (result.ok) {
    return {
      ...result,
      warnings: [...detection.warnings, ...result.warnings],
    };
  }
  return result;
}

export async function executeBackfillAssignmentsFromQuotation(
  supabase: SupabaseClient<Database>,
  userId: string,
  campaignId: string
): Promise<ConvertQuotationToAssignmentsResult | { ok: false; message: string }> {
  const detection = await detectLegacyCampaignForBackfill(supabase, campaignId);
  if (!detection.eligible || !detection.quotationId) {
    return { ok: false, message: detection.reason };
  }

  // Preserve billing/VIO: detection already requires zero lines.
  const result = await convertQuotationToAssignments(supabase, userId, {
    quotationId: detection.quotationId,
    reuseHeaderId: campaignId,
    dryRun: false,
  });

  await logAuditEvent(supabase, {
    userId,
    action: "update",
    entityType: "campaign_header",
    entityId: campaignId,
    metadata: {
      audit_action: "release_2_0_backfill_assignments",
      quotation_id: detection.quotationId,
      ok: result.ok,
      lines_created: result.ok ? result.linesCreated : 0,
      already_exists: result.ok ? Boolean(result.alreadyExists) : false,
      warnings: result.ok ? result.warnings : [result.message],
    },
  });

  return result;
}
