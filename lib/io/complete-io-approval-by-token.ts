import { headers } from "next/headers";

import { sendIoApprovalConfirmationEmails } from "@/lib/email/io-approval-emails";
import { buildClientIoPdfAttachmentFromBuffer } from "@/lib/email/client-io-email";
import { buildVendorIoPdfAttachmentFromBuffer } from "@/lib/email/vendor-io-email";
import { syncCampaignHeaderStatus } from "@/lib/campaigns/sync-campaign-header-status";
import { CLIENT_IO_DOCUMENTS_BUCKET } from "@/lib/io/client-io-document-service";
import { VENDOR_IO_DOCUMENTS_BUCKET } from "@/lib/io/vendor-io-document-service";
import { downloadIoDocumentBuffer } from "@/lib/io/io-document-storage";
import {
  mapApprovalRpcErrorToOutcome,
  type IoApprovalFailureCode,
} from "@/lib/io/io-approval-outcomes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";
import { emitEnterpriseTimelineEvent } from "@/lib/timeline/emit-enterprise-timeline-event";
import { debugIo } from "@/features/io/queries";

export type OneClickApprovalResult =
  | {
      ok: true;
      outcome: "approved" | "already_approved";
      documentNumber: string | null;
    }
  | {
      ok: false;
      outcome: IoApprovalFailureCode;
      documentNumber?: string | null;
    };

type ApproveRpcPayload = {
  io_id?: string;
  already_approved?: boolean;
};

async function resolveRequestIp(): Promise<string | null> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwarded || h.get("x-real-ip")?.trim() || null;
  } catch {
    return null;
  }
}

function normalizeApproverEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase() ?? "";
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

export function parseApproveRpcPayload(data: unknown): ApproveRpcPayload | null {
  if (typeof data === "string" && /^[0-9a-f-]{36}$/i.test(data.trim())) {
    return { io_id: data.trim(), already_approved: false };
  }
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const ioId = typeof row.io_id === "string" ? row.io_id : null;
  if (!ioId) return null;
  return {
    io_id: ioId,
    already_approved: Boolean(row.already_approved),
  };
}

function approvalDbClient() {
  const { client, reason } = tryCreateServiceRoleClient();
  if (!client) {
    debugIo("io-approval", "service role unavailable; falling back to anon", reason);
  }
  return client;
}

export async function completeClientIoApprovalByToken(input: {
  token: string;
  approverEmail?: string | null;
}): Promise<OneClickApprovalResult> {
  const token = input.token.trim();
  if (!token) {
    return { ok: false, outcome: "invalid" };
  }

  // Anonymous visitors hit this page — RPC is granted to anon (SECURITY DEFINER).
  const anon = await createSupabaseServerClient();
  const ip = await resolveRequestIp();
  const approverEmail = normalizeApproverEmail(input.approverEmail);
  const approvedByName = approverEmail || "Email approver";

  const { data, error } = await (anon as any).rpc("approve_client_io_by_token", {
    p_token: token,
    p_approved_by_name: approvedByName,
    p_approval_ip: ip,
  });

  if (error) {
    const outcome = mapApprovalRpcErrorToOutcome(error.message);
    debugIo("io-approval", "client one-click approval failed", {
      message: error.message,
      outcome,
    });
    return { ok: false, outcome };
  }

  const payload = parseApproveRpcPayload(data);
  if (!payload?.io_id) {
    return { ok: false, outcome: "invalid" };
  }

  // Post-approve reads/writes must bypass RLS (anon has no client_ios SELECT).
  const db = approvalDbClient() ?? anon;

  const { data: cio, error: cioError } = await db
    .from("client_ios")
    .select(
      "id, campaign_header_id, document_number, revision_number, approved_at, generated_pdf_url, campaign:campaign_headers!client_ios_campaign_header_id_fkey(name)"
    )
    .eq("id", payload.io_id)
    .maybeSingle();

  if (cioError) {
    debugIo("io-approval", "client io load after approve failed", cioError.message);
  }

  const typed = cio as {
    id: string;
    campaign_header_id: string;
    document_number: string | null;
    revision_number: number | null;
    approved_at: string | null;
    generated_pdf_url: string | null;
    campaign: { name: string } | { name: string }[] | null;
  } | null;

  if (!typed) {
    return {
      ok: true,
      outcome: payload.already_approved ? "already_approved" : "approved",
      documentNumber: null,
    };
  }

  if (payload.already_approved) {
    return {
      ok: true,
      outcome: "already_approved",
      documentNumber: typed.document_number,
    };
  }

  const campaign = Array.isArray(typed.campaign)
    ? typed.campaign[0] ?? null
    : typed.campaign;

  if (approverEmail) {
    await db
      .from("client_ios")
      .update({ approved_by_email: approverEmail } as never)
      .eq("id", typed.id);
  }

  try {
    await emitEnterpriseTimelineEvent(db, {
      campaignHeaderId: typed.campaign_header_id,
      entityType: "client_ios",
      entityId: typed.id,
      action: "update",
      metadata: {
        event: "client_io.approved",
        summary: `Client IO ${typed.document_number ?? typed.id} approved${
          approverEmail ? ` by ${approverEmail}` : ""
        }`,
        module: "client_io",
        client_io_id: typed.id,
        version: typed.revision_number ?? 0,
      },
      newData: {
        status: "approved",
        approved_by_name: approvedByName,
        approved_by_email: approverEmail,
        approved_revision_number: typed.revision_number ?? 0,
        approval_ip: ip,
      },
    });
  } catch {
    // Non-blocking
  }

  try {
    await syncCampaignHeaderStatus(db, typed.campaign_header_id);
  } catch (syncError) {
    debugIo("io-approval", "campaign status sync after client approve failed", syncError);
  }

  // Always attempt confirmation when we have an email (from the approval link).
  if (approverEmail) {
    const pdfBuffer = await downloadIoDocumentBuffer(
      db,
      CLIENT_IO_DOCUMENTS_BUCKET,
      typed.generated_pdf_url
    );
    try {
      await sendIoApprovalConfirmationEmails({
        supabase: db,
        kind: "client",
        ioId: typed.id,
        documentNumber: typed.document_number,
        campaignName: campaign?.name ?? null,
        approvedAt: typed.approved_at ?? new Date().toISOString(),
        approvedByEmail: approverEmail,
        approvedByName,
        pdfAttachment: buildClientIoPdfAttachmentFromBuffer(pdfBuffer),
      });
    } catch (emailError) {
      debugIo("io-approval", "client confirmation email failed", emailError);
    }
  } else {
    debugIo("io-approval", "client confirmation skipped — no approver email on link");
  }

  return {
    ok: true,
    outcome: "approved",
    documentNumber: typed.document_number,
  };
}

export async function completeVendorIoApprovalByToken(input: {
  token: string;
  approverEmail?: string | null;
}): Promise<OneClickApprovalResult> {
  const token = input.token.trim();
  if (!token) {
    return { ok: false, outcome: "invalid" };
  }

  const anon = await createSupabaseServerClient();
  const ip = await resolveRequestIp();
  const approverEmail = normalizeApproverEmail(input.approverEmail);
  const approvedByName = approverEmail || "Email approver";

  const { data, error } = await (anon as any).rpc("approve_vendor_io_by_token", {
    p_token: token,
    p_approved_by_name: approvedByName,
    p_approval_ip: ip,
  });

  if (error) {
    const outcome = mapApprovalRpcErrorToOutcome(error.message);
    debugIo("io-approval", "vendor one-click approval failed", {
      message: error.message,
      outcome,
    });
    return { ok: false, outcome };
  }

  const payload = parseApproveRpcPayload(data);
  if (!payload?.io_id) {
    return { ok: false, outcome: "invalid" };
  }

  const db = approvalDbClient() ?? anon;

  const { data: vio, error: vioError } = await db
    .from("vendor_ios")
    .select(
      "id, campaign_header_id, document_number, revision_number, approved_at, generated_pdf_url, influencer_id, campaign:campaign_headers!vendor_ios_campaign_header_id_fkey(name), influencers:influencers!vendor_ios_influencer_id_fkey(email, display_name)"
    )
    .eq("id", payload.io_id)
    .maybeSingle();

  if (vioError) {
    debugIo("io-approval", "vendor io load after approve failed", vioError.message);
  }

  const typed = vio as {
    id: string;
    campaign_header_id: string;
    document_number: string | null;
    revision_number: number | null;
    approved_at: string | null;
    generated_pdf_url: string | null;
    campaign: { name: string } | { name: string }[] | null;
    influencers:
      | { email: string | null; display_name: string | null }
      | { email: string | null; display_name: string | null }[]
      | null;
  } | null;

  if (!typed) {
    return {
      ok: true,
      outcome: payload.already_approved ? "already_approved" : "approved",
      documentNumber: null,
    };
  }

  if (payload.already_approved) {
    return {
      ok: true,
      outcome: "already_approved",
      documentNumber: typed.document_number,
    };
  }

  const campaign = Array.isArray(typed.campaign)
    ? typed.campaign[0] ?? null
    : typed.campaign;
  const influencer = Array.isArray(typed.influencers)
    ? typed.influencers[0] ?? null
    : typed.influencers;
  const resolvedEmail =
    approverEmail || normalizeApproverEmail(influencer?.email) || null;

  if (resolvedEmail) {
    await db
      .from("vendor_ios")
      .update({ approved_by_email: resolvedEmail } as never)
      .eq("id", typed.id);
  }

  try {
    await emitEnterpriseTimelineEvent(db, {
      campaignHeaderId: typed.campaign_header_id,
      entityType: "vendor_ios",
      entityId: typed.id,
      action: "update",
      metadata: {
        event: "vendor_io.approved",
        summary: `Vendor IO ${typed.document_number ?? typed.id} approved${
          resolvedEmail ? ` by ${resolvedEmail}` : ""
        }`,
        module: "vendor_io",
        version: typed.revision_number ?? 0,
      },
      newData: {
        status: "approved",
        approved_by_name: approvedByName,
        approved_by_email: resolvedEmail,
        approved_revision_number: typed.revision_number ?? 0,
        approval_ip: ip,
        vendor_io_id: typed.id,
      },
    });
  } catch {
    // Non-blocking
  }

  try {
    await syncCampaignHeaderStatus(db, typed.campaign_header_id);
  } catch (syncError) {
    debugIo("io-approval", "campaign status sync after vendor approve failed", syncError);
  }

  if (resolvedEmail) {
    const pdfBuffer = await downloadIoDocumentBuffer(
      db,
      VENDOR_IO_DOCUMENTS_BUCKET,
      typed.generated_pdf_url
    );
    try {
      await sendIoApprovalConfirmationEmails({
        supabase: db,
        kind: "vendor",
        ioId: typed.id,
        documentNumber: typed.document_number,
        campaignName: campaign?.name ?? null,
        approvedAt: typed.approved_at ?? new Date().toISOString(),
        approvedByEmail: resolvedEmail,
        approvedByName: influencer?.display_name ?? approvedByName,
        pdfAttachment: buildVendorIoPdfAttachmentFromBuffer(pdfBuffer),
      });
    } catch (emailError) {
      debugIo("io-approval", "vendor confirmation email failed", emailError);
    }
  }

  return {
    ok: true,
    outcome: "approved",
    documentNumber: typed.document_number,
  };
}
