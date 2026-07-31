"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseFormDataWithSchema } from "@/lib/validation/form";
import { updateVendorIoSchema } from "@/lib/validation/schemas";
import {
  ensureClientIoAssignmentsSeeded,
  isClientIoComposerEditable,
  replaceClientIoAssignments,
} from "@/lib/io/client-io-assignments";
import { createClientIoAmendment } from "@/lib/io/create-client-io-amendment";
import { fetchClientIoRow } from "@/lib/io/client-io-query";
import { replaceClientIoMilestones } from "@/lib/io/client-io-milestones-service";
import type { ClientIoMilestoneDraft } from "@/lib/io/client-io-milestones";
import { syncCampaignHeaderStatus } from "@/lib/campaigns/sync-campaign-header-status";
import { emitEnterpriseTimelineEvent } from "@/lib/timeline/emit-enterprise-timeline-event";
import {
  buildClientIoEmailHtml,
  buildClientIoEmailPlainText,
  buildClientIoEmailSubject,
  buildClientIoPdfAttachmentFromBuffer,
} from "@/lib/email/client-io-email";
import { getGmailFromEmail } from "@/lib/email/gmail-config";
import { sendGmailEmail } from "@/lib/email/gmail-send";
import { CLIENT_IO_DOCUMENTS_BUCKET } from "@/lib/io/client-io-document-service";
import {
  createIoDocumentSignedUrl,
  downloadIoDocumentBuffer,
  EMAIL_SIGNED_URL_SECONDS,
} from "@/lib/io/io-document-storage";
import {
  normalizeIoTermsText,
  parseTermsText,
  serializeTermsText,
} from "@/lib/io/client-io-terms";
import {
  parseSendRecipientsField,
  serializeSendRecipients,
  type ClientIoRecipientEntry,
} from "@/lib/io/client-io-send-recipients";
import { debugIo, buildIoEmailLink } from "@/features/io/queries";
import type { ClientIoStatus, VendorIoStatus } from "@/features/io/types";

type IoActionState = {
  ok: boolean;
  message?: string;
};

async function requireAuthUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null, error: error?.message ?? "Unauthorized" };
  }
  return { supabase, user, error: null };
}

function revalidateIoPaths(campaignHeaderId?: string | null) {
  revalidatePath("/ios/client");
  revalidatePath("/ios/vendor");
  revalidatePath("/campaigns");
  if (campaignHeaderId) {
    revalidatePath(`/campaigns/${campaignHeaderId}`);
  }
}

export async function ensureClientIoForCampaignAction(
  _prev: IoActionState,
  formData: FormData
): Promise<IoActionState> {
  const campaignHeaderId = String(formData.get("campaign_header_id") ?? "").trim();
  if (!campaignHeaderId) {
    return { ok: false, message: "Missing campaign context." };
  }

  const { supabase, user, error } = await requireAuthUser();
  if (error || !user) {
    return { ok: false, message: error ?? "Unauthorized" };
  }

  const { data, error: rpcError } = await (supabase as any).rpc("ensure_client_io_for_campaign", {
    p_campaign_header_id: campaignHeaderId,
    p_actor_id: user.id,
  });

  if (rpcError) {
    return { ok: false, message: rpcError.message };
  }

  const clientIoId = data as string | null;
  if (!clientIoId) {
    return { ok: false, message: "Could not create Client IO for this campaign." };
  }

  try {
    await ensureClientIoAssignmentsSeeded(supabase, {
      clientIoId,
      campaignHeaderId,
    });
  } catch (seedError) {
    console.warn("[client-io] assignment seed failed", seedError);
  }

  debugIo("client-io", "ensured for campaign", { campaignHeaderId, clientIoId });
  revalidateIoPaths(campaignHeaderId);
  return { ok: true, message: "Client IO is ready for this campaign." };
}

export async function saveClientIoAssignmentsAction(
  _prev: IoActionState,
  formData: FormData
): Promise<IoActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const campaignHeaderId = String(formData.get("campaign_header_id") ?? "").trim();
  const selectedRaw = String(formData.get("selected_assignment_ids") ?? "").trim();

  if (!id || !campaignHeaderId) {
    return { ok: false, message: "Missing Client IO context." };
  }

  const { supabase, user, error } = await requireAuthUser();
  if (error || !user) {
    return { ok: false, message: error ?? "Unauthorized" };
  }

  const clientIo = await fetchClientIoRow(supabase, id);
  if (!clientIo) {
    return { ok: false, message: "Client IO not found." };
  }

  if (clientIo.is_superseded) {
    return {
      ok: false,
      message: "This Client IO version is superseded and immutable. Edit the current tip.",
    };
  }

  if (!isClientIoComposerEditable(clientIo.status)) {
    return {
      ok: false,
      message: "Assignment selection is locked after the Client IO is sent.",
    };
  }

  let selectedIds: string[] = [];
  if (selectedRaw) {
    try {
      const parsed = JSON.parse(selectedRaw) as unknown;
      if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "string")) {
        return { ok: false, message: "Invalid Assignment selection payload." };
      }
      selectedIds = parsed;
    } catch {
      return { ok: false, message: "Invalid Assignment selection payload." };
    }
  }

  try {
    const saved = await replaceClientIoAssignments(supabase, {
      clientIoId: id,
      campaignHeaderId,
      campaignLineIds: selectedIds,
    });

    // Selection change invalidates the prior issued snapshot until regenerate.
    if (clientIo.status === "generated") {
      await supabase
        .from("client_ios")
        .update({
          assignment_snapshot: null,
          updated_by: user.id,
        } as never)
        .eq("id", id);
    }

    debugIo("client-io", "saved assignment selection", {
      id,
      count: saved.length,
    });
    revalidateIoPaths(campaignHeaderId);
    revalidatePath(`/ios/client/${id}/preview`);
    return {
      ok: true,
      message:
        saved.length === 0
          ? "Assignment selection cleared. Select at least one Assignment before generating."
          : `Saved ${saved.length} Assignment${saved.length === 1 ? "" : "s"} for Client IO.`,
    };
  } catch (saveError) {
    return {
      ok: false,
      message:
        saveError instanceof Error ? saveError.message : "Could not save Assignment selection.",
    };
  }
}

export async function saveClientIoMilestonesAction(
  _prev: IoActionState,
  formData: FormData
): Promise<IoActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const campaignHeaderId = String(formData.get("campaign_header_id") ?? "").trim();
  const milestonesRaw = String(formData.get("milestones") ?? "").trim();

  if (!id || !campaignHeaderId) {
    return { ok: false, message: "Missing Client IO context." };
  }

  let milestones: ClientIoMilestoneDraft[] = [];
  if (milestonesRaw) {
    try {
      const parsed = JSON.parse(milestonesRaw) as unknown;
      if (!Array.isArray(parsed)) {
        return { ok: false, message: "Invalid milestones payload." };
      }
      milestones = parsed as ClientIoMilestoneDraft[];
    } catch {
      return { ok: false, message: "Invalid milestones payload." };
    }
  }

  const { supabase, user, error } = await requireAuthUser();
  if (error || !user) {
    return { ok: false, message: error ?? "Unauthorized" };
  }

  const clientIo = await fetchClientIoRow(supabase, id);
  if (!clientIo) {
    return { ok: false, message: "Client IO not found." };
  }

  try {
    const saved = await replaceClientIoMilestones(supabase, {
      clientIoId: id,
      campaignHeaderId,
      actorId: user.id,
      status: clientIo.status,
      isSuperseded: clientIo.is_superseded,
      milestones,
    });
    debugIo("client-io", "saved milestones", { id, count: saved.length });
    revalidateIoPaths(campaignHeaderId);
    revalidatePath(`/ios/client/${id}/preview`);
    return {
      ok: true,
      message:
        saved.length === 0
          ? "Billing milestones cleared."
          : `Saved ${saved.length} billing milestone${saved.length === 1 ? "" : "s"}.`,
    };
  } catch (saveError) {
    return {
      ok: false,
      message:
        saveError instanceof Error ? saveError.message : "Could not save billing milestones.",
    };
  }
}

export async function createClientIoAmendmentAction(
  _prev: IoActionState,
  formData: FormData
): Promise<IoActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const campaignHeaderId = String(formData.get("campaign_header_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!id || !campaignHeaderId) {
    return { ok: false, message: "Missing Client IO context." };
  }

  const { supabase, user, error } = await requireAuthUser();
  if (error || !user) {
    return { ok: false, message: error ?? "Unauthorized" };
  }

  const result = await createClientIoAmendment(supabase, {
    clientIoId: id,
    actorId: user.id,
    reason: reason || null,
    generateDocument: true,
  });

  if (!result.ok) {
    return { ok: false, message: result.error };
  }

  try {
    await syncCampaignHeaderStatus(supabase, campaignHeaderId);
  } catch (syncError) {
    console.warn("[client-io] status sync after amendment failed", syncError);
  }

  debugIo("client-io", "amendment created", {
    priorId: result.priorClientIoId,
    newId: result.newClientIoId,
    documentNumber: result.documentNumber,
  });

  revalidateIoPaths(campaignHeaderId);
  revalidatePath(`/ios/client/${result.newClientIoId}/preview`);
  revalidatePath(`/ios/client?io=${result.newClientIoId}`);

  return {
    ok: true,
    message: result.generated
      ? `Amendment ${result.documentNumber} created and document generated.`
      : `Amendment ${result.documentNumber} created. Generate the document to continue.`,
  };
}

export async function updateClientIoAction(
  _prev: IoActionState,
  formData: FormData
): Promise<IoActionState> {
  const id = String(formData.get("id") ?? "");
  const campaignHeaderId = String(formData.get("campaign_header_id") ?? "");
  const termsTextRaw = String(formData.get("terms_text") ?? "").trim();
  const sendRecipientsRaw = String(formData.get("send_recipients") ?? "").trim();
  const billingTerms = String(formData.get("billing_terms") ?? "").trim();
  const attachmentUrl = String(formData.get("attachment_url") ?? "").trim();
  const status = String(formData.get("status") ?? "draft") as ClientIoStatus;

  if (!id || !campaignHeaderId) return { ok: false, message: "Missing IO context." };

  let termsText: string | null = null;
  if (termsTextRaw) {
    const parsed = parseTermsText(termsTextRaw);
    if (!parsed) {
      return { ok: false, message: "Terms must be a valid JSON list of title and body pairs." };
    }
    termsText = serializeTermsText(parsed);
  }

  const sendRecipients = parseSendRecipientsField(sendRecipientsRaw);
  if (sendRecipientsRaw && sendRecipients.length === 0) {
    return { ok: false, message: "Recipients must include at least one valid email address." };
  }

  const { supabase, user, error } = await requireAuthUser();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  const existing = await fetchClientIoRow(supabase, id);
  if (existing?.is_superseded) {
    return {
      ok: false,
      message: "This Client IO version is superseded and immutable. Edit the current tip.",
    };
  }

  const { error: updateError } = await supabase
    .from("client_ios")
    .update({
      terms_text: termsText,
      send_recipients: sendRecipients,
      billing_terms: billingTerms || null,
      attachment_url: attachmentUrl || null,
      status,
      updated_by: user.id,
    } as never)
    .eq("id", id);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  debugIo("client-io", "updated draft", { id, status });
  revalidateIoPaths(campaignHeaderId);
  return { ok: true, message: "Client IO saved." };
}

export async function sendClientIoAction(
  _prev: IoActionState,
  formData: FormData
): Promise<IoActionState> {
  const id = String(formData.get("id") ?? "");
  const campaignHeaderId = String(formData.get("campaign_header_id") ?? "");
  const recipientsRaw = String(formData.get("send_recipients") ?? "").trim();
  if (!id || !campaignHeaderId) return { ok: false, message: "Missing IO context." };

  const { supabase, user, error } = await requireAuthUser();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  const clientIo = await fetchClientIoRow(supabase, id);
  if (!clientIo) return { ok: false, message: "Client IO not found." };

  const hasDocument = Boolean(
    clientIo.document_generated_at || clientIo.generated_html_url || clientIo.generated_pdf_url
  );
  if (!hasDocument) {
    return { ok: false, message: "Generate the Client IO document before sending." };
  }

  let recipients: ClientIoRecipientEntry[] = parseSendRecipientsField(recipientsRaw);
  if (recipients.length === 0) {
    recipients = clientIo.send_recipients ?? [];
  }
  if (recipients.length === 0) {
    return { ok: false, message: "Add at least one recipient with a valid email address." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const senderName = (profile as { full_name?: string | null } | null)?.full_name ?? null;

  const { data, error: rpcError } = await (supabase as any).rpc("send_client_io", {
    p_client_io_id: id,
    p_actor_id: user.id,
  });

  if (rpcError) return { ok: false, message: rpcError.message };
  const token = (data as string | null) ?? "";
  const approvalUrl = token ? buildIoEmailLink("client", token) : null;

  const documentViewUrl =
    (await createIoDocumentSignedUrl(
      supabase,
      CLIENT_IO_DOCUMENTS_BUCKET,
      clientIo.generated_html_url,
      EMAIL_SIGNED_URL_SECONDS
    )) ??
    (await createIoDocumentSignedUrl(
      supabase,
      CLIENT_IO_DOCUMENTS_BUCKET,
      clientIo.generated_pdf_url,
      EMAIL_SIGNED_URL_SECONDS
    ));

  const subject = buildClientIoEmailSubject(clientIo);
  const html = buildClientIoEmailHtml({
    io: clientIo,
    senderName,
    approvalUrl,
    documentViewUrl,
  });
  const emailText = buildClientIoEmailPlainText({
    io: clientIo,
    senderName,
    approvalUrl,
    documentViewUrl,
  });
  const pdfBuffer = await downloadIoDocumentBuffer(
    supabase,
    CLIENT_IO_DOCUMENTS_BUCKET,
    clientIo.generated_pdf_url
  );
  const pdfAttachment = buildClientIoPdfAttachmentFromBuffer(pdfBuffer);
  const gmailResult = await sendGmailEmail({
    to: recipients,
    subject,
    html,
    attachments: pdfAttachment ? [pdfAttachment] : undefined,
  });

  const sendBatchId = crypto.randomUUID();
  const senderEmail = getGmailFromEmail();
  const sentAt = new Date().toISOString();

  for (const recipient of recipients) {
    await supabase.from("io_notifications").insert({
      io_type: "client",
      io_id: id,
      event_type: "client_io_sent",
      recipient_email: recipient.email,
      recipient_name: recipient.name || null,
      sender_email: senderEmail,
      subject,
      gmail_message_id: gmailResult.ok ? gmailResult.messageId : null,
      send_batch_id: sendBatchId,
      sent_by: user.id,
      delivery_status: gmailResult.ok ? "sent" : "failed",
      delivery_error: gmailResult.ok ? null : gmailResult.error,
      payload: {
        document_number: clientIo.document_number,
        pdf_url: clientIo.generated_pdf_url,
        approval_url: approvalUrl,
        campaign_header_id: campaignHeaderId,
        email_html: html,
        email_text: emailText,
        sender_display_name: senderName,
      },
      sent_at: sentAt,
    } as never);
  }

  debugIo("io-email", "client io send", {
    id,
    approvalUrl,
    recipients: recipients.map((r) => r.email),
    gmailOk: gmailResult.ok,
  });

  try {
    await emitEnterpriseTimelineEvent(supabase, {
      campaignHeaderId,
      actorId: user.id,
      entityType: "client_ios",
      entityId: id,
      action: "update",
      metadata: {
        event: "client_io.sent",
        summary: `Client IO ${clientIo.document_number ?? id} sent to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`,
        module: "client_io",
        client_io_id: id,
      },
      newData: { status: "sent", recipient_count: recipients.length },
    });
    await emitEnterpriseTimelineEvent(supabase, {
      campaignHeaderId,
      actorId: user.id,
      entityType: "client_ios",
      entityId: id,
      action: "update",
      metadata: {
        event: "client_io.under_client_review",
        summary: `Client IO ${clientIo.document_number ?? id} under client review`,
        module: "client_io",
        client_io_id: id,
      },
      newData: { status: "under_client_review" },
    });
  } catch (timelineError) {
    console.warn("[client-io] Timeline emit after send failed", timelineError);
  }

  try {
    await syncCampaignHeaderStatus(supabase, campaignHeaderId);
  } catch (syncError) {
    console.warn("[client-io] status sync after send failed", syncError);
  }

  revalidateIoPaths(campaignHeaderId);

  if (!gmailResult.ok) {
    return {
      ok: false,
      message: `IO marked under client review but email delivery failed: ${gmailResult.error}`,
    };
  }

  const recipientCount = recipients.length;
  return {
    ok: true,
    message: `Client IO sent to ${recipientCount} recipient${recipientCount === 1 ? "" : "s"} and is now under client review.`,
  };
}

export async function updateVendorIoAction(
  _prev: IoActionState,
  formData: FormData
): Promise<IoActionState> {
  const parsed = parseFormDataWithSchema(formData, updateVendorIoSchema);
  if (!parsed.ok) {
    return { ok: false, message: parsed.message };
  }

  const {
    id,
    campaign_header_id: campaignHeaderId,
    terms_text: termsTextRaw,
    usage_rights: usageRightsRaw,
    exclusivity: exclusivityRaw,
    attachment_url: attachmentUrlRaw,
    status,
    amount,
  } = parsed.data;

  const termsRaw = (termsTextRaw ?? "").trim();
  let termsText: string | null = null;
  if (termsRaw) {
    termsText = normalizeIoTermsText(termsRaw);
    if (!termsText) {
      return {
        ok: false,
        message: "Terms must be a valid JSON list of title and body pairs.",
      };
    }
  }

  const usageRights = (usageRightsRaw ?? "").trim();
  const exclusivity = (exclusivityRaw ?? "").trim();
  const attachmentUrl = (attachmentUrlRaw ?? "").trim();

  const { supabase, user, error } = await requireAuthUser();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  const { data: existing, error: loadError } = await supabase
    .from("vendor_ios")
    .select("id, is_superseded, revision_number")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, message: loadError?.message ?? "Vendor IO not found." };
  }

  if ((existing as { is_superseded?: boolean }).is_superseded) {
    return {
      ok: false,
      message: "This Vendor IO revision is superseded. Edit the active revision only.",
    };
  }

  // Do not touch terms_html here — document generation owns the full HTML blob.
  const patch: Record<string, unknown> = {
    terms_text: termsText,
    usage_rights: usageRights || null,
    exclusivity: exclusivity || null,
    attachment_url: attachmentUrl || null,
    status: status as VendorIoStatus,
    updated_by: user.id,
  };

  if (amount !== undefined) {
    patch.amount = amount;
  }

  const { error: updateError } = await supabase
    .from("vendor_ios")
    .update(patch as never)
    .eq("id", id)
    .eq("is_superseded", false);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  debugIo("vendor-io", "updated draft", { id, status });
  revalidateIoPaths(campaignHeaderId);
  return { ok: true, message: "Vendor IO saved." };
}

/** Persist current structured terms onto the influencer as vendor defaults. */
export async function saveVendorIoTermsAsVendorDefaultAction(input: {
  influencerId: string;
  termsText: string;
  campaignHeaderId?: string | null;
}): Promise<IoActionState> {
  const termsText = normalizeIoTermsText(input.termsText);
  if (!termsText) {
    return {
      ok: false,
      message: "Terms must be a valid JSON list of title and body pairs.",
    };
  }

  const { supabase, user, error } = await requireAuthUser();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  const permission = await requirePermission(supabase, "influencers.write");
  if ("error" in permission) {
    return { ok: false, message: permission.error };
  }

  const { error: updateError } = await supabase
    .from("influencers")
    .update({ vendor_io_terms_text: termsText } as never)
    .eq("id", input.influencerId);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${input.influencerId}`);
  revalidateIoPaths(input.campaignHeaderId);
  return { ok: true, message: "Saved as vendor default terms for future Vendor IOs." };
}

export async function sendVendorIoAction(
  _prev: IoActionState,
  formData: FormData
): Promise<IoActionState> {
  const id = String(formData.get("id") ?? "");
  const campaignHeaderId = String(formData.get("campaign_header_id") ?? "");
  if (!id || !campaignHeaderId) return { ok: false, message: "Missing IO context." };

  const { supabase, user, error } = await requireAuthUser();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  const { data: vendorIo } = await supabase
    .from("vendor_ios")
    .select("document_number, generated_pdf_url, influencer_id, influencers:influencer_id(email)")
    .eq("id", id)
    .maybeSingle();

  const { data, error: rpcError } = await (supabase as any).rpc("send_vendor_io", {
    p_vendor_io_id: id,
    p_actor_id: user.id,
  });

  if (rpcError) return { ok: false, message: rpcError.message };
  const token = (data as string | null) ?? "";
  const approvalUrl = token ? buildIoEmailLink("vendor", token) : null;

  const typed = vendorIo as {
    document_number: string | null;
    generated_pdf_url: string | null;
    influencers: { email: string | null } | null;
  } | null;

  await supabase.from("io_notifications").insert({
    io_type: "vendor",
    io_id: id,
    event_type: "vendor_io_sent",
    recipient_email: typed?.influencers?.email ?? null,
    delivery_status: "queued",
    payload: {
      document_number: typed?.document_number,
      pdf_url: typed?.generated_pdf_url,
      approval_url: approvalUrl,
      campaign_header_id: campaignHeaderId,
    },
    sent_at: new Date().toISOString(),
  } as never);

  debugIo("io-email", "vendor io send trigger", { id, approvalUrl });
  revalidateIoPaths(campaignHeaderId);
  return { ok: true, message: "Vendor IO sent with PDF attachment link when available." };
}

