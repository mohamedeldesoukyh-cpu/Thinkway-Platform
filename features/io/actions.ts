"use server";

import { revalidatePath } from "next/cache";

import { formDataDefersRevalidate } from "@/components/workspace/bulk-operations/bulk-defer-revalidate";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseFormDataWithSchema } from "@/lib/validation/form";
import { updateVendorIoSchema } from "@/lib/validation/schemas";
import {
  ensureClientIoAssignmentsSeeded,
  isClientIoComposerEditable,
  isClientIoRegenerateAllowed,
  replaceClientIoAssignments,
} from "@/lib/io/client-io-assignments";
import { createClientIoAmendment } from "@/lib/io/create-client-io-amendment";
import { fetchClientIoRow } from "@/lib/io/client-io-query";
import { replaceClientIoMilestones } from "@/lib/io/client-io-milestones-service";
import {
  buildClientIoMilestoneTemplate,
  type ClientIoMilestoneDraft,
  type ClientIoMilestoneTemplateId,
} from "@/lib/io/client-io-milestones";
import { generateClientIoDocument } from "@/lib/io/client-io-document-service";
import { CLIENT_IO_DEFAULT_TERMS } from "@/lib/io/client-io-default-terms";
import {
  applyPaymentTermsClause,
  getClientIoPaymentTermsPreset,
  type ClientIoPaymentTermsPresetId,
} from "@/lib/io/client-io-payment-terms";
import { syncCampaignHeaderStatus } from "@/lib/campaigns/sync-campaign-header-status";
import { emitEnterpriseTimelineEvent } from "@/lib/timeline/emit-enterprise-timeline-event";
import {
  buildClientIoEmailHtml,
  buildClientIoEmailPlainText,
  buildClientIoEmailSubject,
  buildClientIoPdfAttachmentFromBuffer,
} from "@/lib/email/client-io-email";
import {
  buildVendorIoEmailHtml,
  buildVendorIoEmailPlainText,
  buildVendorIoEmailSubject,
  buildVendorIoPdfAttachmentFromBuffer,
} from "@/lib/email/vendor-io-email";
import { buildIoDeliveryNotificationMeta } from "@/lib/email/delivery-notification";
import {
  assertOutboundEmailReady,
  getEmailFromAddress,
  sendEmail,
} from "@/lib/email/provider";
import { CLIENT_IO_DOCUMENTS_BUCKET } from "@/lib/io/client-io-document-service";
import {
  hasValidVendorEmail,
  VENDOR_IO_MANUAL_DELIVERY_RECIPIENT,
} from "@/lib/io/vendor-io-delivery";
import { VENDOR_IO_DOCUMENTS_BUCKET } from "@/lib/io/vendor-io-document-service";
import { downloadIoDocumentBuffer } from "@/lib/io/io-document-storage";
import { sumClientIoSnapshotAgreedAmount } from "@/lib/email/io-email-summary";
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

const PAYMENT_PRESET_TO_MILESTONE: Record<
  Exclude<ClientIoPaymentTermsPresetId, "custom">,
  ClientIoMilestoneTemplateId
> = {
  advance: "approval_100",
  net_30: "net_30",
  net_60: "net_60",
  net_90: "net_90",
};

/**
 * One-click ready payment terms: milestones + billing_terms + Payment Terms clause,
 * then regenerate document so preview / export / send stay in sync.
 */
export async function applyClientIoPaymentTermsPresetAction(
  _prev: IoActionState,
  formData: FormData
): Promise<IoActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const campaignHeaderId = String(formData.get("campaign_header_id") ?? "").trim();
  const presetId = String(formData.get("preset_id") ?? "").trim() as ClientIoPaymentTermsPresetId;

  if (!id || !campaignHeaderId) {
    return { ok: false, message: "Missing Client IO context." };
  }
  if (presetId === "custom" || !(presetId in PAYMENT_PRESET_TO_MILESTONE)) {
    return { ok: false, message: "Choose Advance, 30, 60, or 90 days — Custom is edited manually." };
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

  const preset = getClientIoPaymentTermsPreset(presetId);
  const milestoneTemplate = PAYMENT_PRESET_TO_MILESTONE[presetId];
  const milestones = buildClientIoMilestoneTemplate(milestoneTemplate);

  const existingTerms =
    parseTermsText(clientIo.terms_text) ??
    parseTermsText(clientIo.client_io_terms_text) ??
    CLIENT_IO_DEFAULT_TERMS;
  const nextTerms = applyPaymentTermsClause(existingTerms, preset.clauseBody);

  try {
    await replaceClientIoMilestones(supabase, {
      clientIoId: id,
      campaignHeaderId,
      actorId: user.id,
      status: clientIo.status,
      isSuperseded: clientIo.is_superseded,
      milestones,
    });

    const { error: updateError } = await supabase
      .from("client_ios")
      .update({
        billing_terms: preset.billingTerms,
        terms_text: serializeTermsText(nextTerms),
        updated_by: user.id,
      } as never)
      .eq("id", id);

    if (updateError) {
      return { ok: false, message: updateError.message };
    }

    let regenerated = false;
    if (
      isClientIoRegenerateAllowed(clientIo.status) &&
      (clientIo.document_generated_at ||
        clientIo.generated_html_url ||
        clientIo.terms_html)
    ) {
      await generateClientIoDocument(supabase, id, user.id);
      regenerated = true;
    }

    debugIo("client-io", "applied payment terms preset", { id, presetId, regenerated });
    revalidateIoPaths(campaignHeaderId);
    revalidatePath(`/ios/client/${id}/preview`);

    return {
      ok: true,
      message: regenerated
        ? `${preset.label} payment terms saved and document refreshed.`
        : `${preset.label} payment terms saved. Generate the document to refresh preview.`,
    };
  } catch (applyError) {
    return {
      ok: false,
      message:
        applyError instanceof Error
          ? applyError.message
          : "Could not apply payment terms preset.",
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

    let regenerated = false;
    if (
      isClientIoRegenerateAllowed(clientIo.status) &&
      (clientIo.document_generated_at ||
        clientIo.generated_html_url ||
        clientIo.terms_html)
    ) {
      await generateClientIoDocument(supabase, id, user.id);
      regenerated = true;
    }

    debugIo("client-io", "saved milestones", { id, count: saved.length, regenerated });
    revalidateIoPaths(campaignHeaderId);
    revalidatePath(`/ios/client/${id}/preview`);
    return {
      ok: true,
      message:
        saved.length === 0
          ? regenerated
            ? "Billing milestones cleared and document refreshed."
            : "Billing milestones cleared."
          : regenerated
            ? `Saved ${saved.length} billing milestone${saved.length === 1 ? "" : "s"} and refreshed the document.`
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

  // Persist recipients used for this send (e.g. contact-seeded, not yet saved as draft).
  const { error: recipientsPersistError } = await supabase
    .from("client_ios")
    .update({
      send_recipients: recipients,
      updated_by: user.id,
    } as never)
    .eq("id", id);
  if (recipientsPersistError) {
    return { ok: false, message: recipientsPersistError.message };
  }

  const emailReady = assertOutboundEmailReady();
  if (!emailReady.ok) {
    return { ok: false, message: emailReady.message };
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

  const [{ data: campaignDates }, { data: cioExtras }] = await Promise.all([
    supabase
      .from("campaign_headers")
      .select("start_date, end_date, currency_code, brand:brands(currency_code)")
      .eq("id", campaignHeaderId)
      .maybeSingle(),
    supabase
      .from("client_ios")
      .select("assignment_snapshot")
      .eq("id", id)
      .maybeSingle(),
  ]);

  const campaignMeta = campaignDates as {
    start_date: string | null;
    end_date: string | null;
    currency_code: string | null;
    brand?: { currency_code?: string | null } | null;
  } | null;
  const agreed = sumClientIoSnapshotAgreedAmount(
    (cioExtras as { assignment_snapshot?: unknown } | null)?.assignment_snapshot
  );
  const syncedCurrency =
    campaignMeta?.brand?.currency_code?.trim() ||
    campaignMeta?.currency_code?.trim() ||
    agreed?.currencyCode ||
    null;

  const emailSummary = {
    campaign_name: clientIo.campaign_name,
    brand_name: clientIo.brand_name,
    campaign_start_date: campaignMeta?.start_date ?? null,
    campaign_end_date: campaignMeta?.end_date ?? null,
    agreed_amount: agreed?.amount ?? null,
    currency_code: syncedCurrency,
    document_number: clientIo.document_number,
  };

  const subject = buildClientIoEmailSubject(clientIo);
  const pdfBuffer = await downloadIoDocumentBuffer(
    supabase,
    CLIENT_IO_DOCUMENTS_BUCKET,
    clientIo.generated_pdf_url
  );
  const pdfAttachment = buildClientIoPdfAttachmentFromBuffer(pdfBuffer);

  const sendBatchId = crypto.randomUUID();
  const senderEmail = getEmailFromAddress();
  const sentAt = new Date().toISOString();

  let anyEmailOk = false;
  let lastEmailError: string | null = null;

  for (const recipient of recipients) {
    const approvalUrl = token
      ? buildIoEmailLink("client", token, { email: recipient.email })
      : null;
    const html = buildClientIoEmailHtml({
      io: emailSummary,
      senderName,
      approvalUrl,
    });
    const emailText = buildClientIoEmailPlainText({
      io: emailSummary,
      senderName,
      approvalUrl,
    });
    const emailResult = await sendEmail({
      to: [recipient],
      subject,
      html,
      text: emailText,
      attachments: pdfAttachment ? [pdfAttachment] : undefined,
    });

    if (emailResult.ok) anyEmailOk = true;
    else lastEmailError = emailResult.error;

    const clientDeliveryStatus = emailResult.ok ? "sent" : "failed";
    const deliveryMeta = buildIoDeliveryNotificationMeta({
      deliveryMethod: "email",
      deliveryStatus: clientDeliveryStatus,
      recipient: recipient.email,
      subject,
      messageId: emailResult.ok ? emailResult.messageId : null,
      sentAt,
    });
    await supabase.from("io_notifications").insert({
      io_type: "client",
      io_id: id,
      event_type: "client_io_sent",
      recipient_email: recipient.email,
      recipient_name: recipient.name || null,
      sender_email: senderEmail,
      subject,
      gmail_message_id: emailResult.ok ? emailResult.messageId : null,
      send_batch_id: sendBatchId,
      sent_by: user.id,
      delivery_status: clientDeliveryStatus,
      delivery_error: emailResult.ok ? null : emailResult.error,
      payload: {
        document_number: clientIo.document_number,
        pdf_url: clientIo.generated_pdf_url,
        approval_url: approvalUrl,
        campaign_header_id: campaignHeaderId,
        email_html: html,
        email_text: emailText,
        sender_display_name: senderName,
        ...deliveryMeta,
      },
      sent_at: sentAt,
    } as never);
  }

  debugIo("io-email", "client io send", {
    id,
    recipients: recipients.map((r) => r.email),
    gmailOk: anyEmailOk,
    lastEmailError,
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

  if (!anyEmailOk) {
    return {
      ok: false,
      message: `IO marked under client review but email delivery failed: ${lastEmailError ?? "unknown error"}`,
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
    .select(
      `
      document_number, amount, currency_code, created_at, document_generated_at,
      generated_html_url, generated_pdf_url, influencer_id,
      campaign:campaign_header_id(
        name, start_date, end_date,
        brands:brand_id(name),
        clients:client_id(name, legal_name)
      ),
      influencers:influencer_id(email, display_name)
    `
    )
    .eq("id", id)
    .maybeSingle();

  type ClientRel = { name: string; legal_name: string | null };
  type BrandRel = { name: string };
  type CampaignRel = {
    name: string;
    start_date: string | null;
    end_date: string | null;
    brands: BrandRel | BrandRel[] | null;
    clients: ClientRel | ClientRel[] | null;
  };
  type InfluencerRel = { email: string | null; display_name: string | null };

  const typed = vendorIo as {
    document_number: string | null;
    amount: number;
    currency_code: string;
    created_at: string;
    document_generated_at: string | null;
    generated_html_url: string | null;
    generated_pdf_url: string | null;
    campaign: CampaignRel | CampaignRel[] | null;
    influencers: InfluencerRel | InfluencerRel[] | null;
  } | null;

  if (!typed) return { ok: false, message: "Vendor IO not found." };

  const influencer = Array.isArray(typed.influencers)
    ? typed.influencers[0] ?? null
    : typed.influencers;
  const campaign = Array.isArray(typed.campaign) ? typed.campaign[0] ?? null : typed.campaign;
  const clientRel = Array.isArray(campaign?.clients)
    ? campaign?.clients[0] ?? null
    : campaign?.clients ?? null;
  const brandRel = Array.isArray(campaign?.brands)
    ? campaign?.brands[0] ?? null
    : campaign?.brands ?? null;

  const recipientEmail = influencer?.email?.trim() ?? "";
  const sendByEmail = hasValidVendorEmail(recipientEmail);

  if (sendByEmail) {
    const emailReady = assertOutboundEmailReady();
    if (!emailReady.ok) {
      return { ok: false, message: emailReady.message };
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const senderName = (profile as { full_name?: string | null } | null)?.full_name ?? null;

  const { data, error: rpcError } = await (supabase as any).rpc("send_vendor_io", {
    p_vendor_io_id: id,
    p_actor_id: user.id,
  });

  if (rpcError) return { ok: false, message: rpcError.message };
  const token = (data as string | null) ?? "";
  const recipientEmailNormalized = recipientEmail.toLowerCase();
  const approvalUrl = token
    ? buildIoEmailLink("vendor", token, { email: recipientEmailNormalized || null })
    : null;

  const deliveredAt = new Date().toISOString();
  const sendBatchId = crypto.randomUUID();
  const senderEmail = getEmailFromAddress();
  const influencerName = influencer?.display_name?.trim() || "Vendor";
  const clientName =
    clientRel?.legal_name?.trim() || clientRel?.name?.trim() || "Client";
  const brandName = brandRel?.name?.trim() || null;

  if (!sendByEmail) {
    const deliveryMeta = buildIoDeliveryNotificationMeta({
      deliveryMethod: "manual",
      deliveryStatus: "completed",
      recipient: VENDOR_IO_MANUAL_DELIVERY_RECIPIENT,
      subject: null,
      messageId: null,
      sentAt: deliveredAt,
    });

    await supabase
      .from("vendor_ios")
      .update({
        delivery_method: "manual",
        delivery_status: "completed",
        delivery_error: null,
        delivered_at: deliveredAt,
        delivery_recipient: VENDOR_IO_MANUAL_DELIVERY_RECIPIENT,
      } as never)
      .eq("id", id);

    await supabase.from("io_notifications").insert({
      io_type: "vendor",
      io_id: id,
      event_type: "vendor_io_sent",
      recipient_email: null,
      recipient_name: influencerName,
      sender_email: senderEmail,
      subject: null,
      gmail_message_id: null,
      send_batch_id: sendBatchId,
      sent_by: user.id,
      delivery_status: "completed",
      delivery_error: null,
      payload: {
        document_number: typed.document_number,
        pdf_url: typed.generated_pdf_url,
        approval_url: approvalUrl,
        campaign_header_id: campaignHeaderId,
        sender_display_name: senderName,
        ...deliveryMeta,
      },
      sent_at: deliveredAt,
    } as never);

    debugIo("io-email", "vendor io manual send", { id, approvalUrl });
    if (!formDataDefersRevalidate(formData)) {
      revalidateIoPaths(campaignHeaderId);
    }
    return { ok: true, message: "Delivered Manually" };
  }

  const emailIo = {
    document_number: typed.document_number,
    campaign_name: campaign?.name ?? "Campaign",
    brand_name: brandName,
    client_name: clientName,
    influencer_name: influencerName,
    amount: Number(typed.amount) || 0,
    currency_code: typed.currency_code || "USD",
    campaign_start_date: campaign?.start_date ?? null,
    campaign_end_date: campaign?.end_date ?? null,
    issue_date: typed.document_generated_at ?? typed.created_at,
    generated_html_url: typed.generated_html_url,
    generated_pdf_url: typed.generated_pdf_url,
  };

  const pdfBuffer = await downloadIoDocumentBuffer(
    supabase,
    VENDOR_IO_DOCUMENTS_BUCKET,
    typed.generated_pdf_url
  );
  const pdfAttachment = buildVendorIoPdfAttachmentFromBuffer(pdfBuffer);
  const hasPdfAttachment = Boolean(pdfAttachment);

  const subject = buildVendorIoEmailSubject(emailIo);
  const html = buildVendorIoEmailHtml({
    io: emailIo,
    senderName,
    approvalUrl,
    hasPdfAttachment,
  });
  const emailText = buildVendorIoEmailPlainText({
    io: emailIo,
    senderName,
    approvalUrl,
    hasPdfAttachment,
  });

  const emailResult = await sendEmail({
    to: [{ email: recipientEmail, name: influencerName }],
    subject,
    html,
    text: emailText,
    attachments: pdfAttachment ? [pdfAttachment] : undefined,
  });

  const vendorDeliveryStatus = emailResult.ok ? "sent" : "failed";
  const deliveryMeta = buildIoDeliveryNotificationMeta({
    deliveryMethod: "email",
    deliveryStatus: vendorDeliveryStatus,
    recipient: recipientEmail,
    subject,
    messageId: emailResult.ok ? emailResult.messageId : null,
    sentAt: deliveredAt,
  });

  await supabase
    .from("vendor_ios")
    .update({
      delivery_method: "email",
      delivery_status: vendorDeliveryStatus,
      delivery_error: emailResult.ok ? null : emailResult.error,
      delivered_at: deliveredAt,
      delivery_recipient: recipientEmail,
    } as never)
    .eq("id", id);

  await supabase.from("io_notifications").insert({
    io_type: "vendor",
    io_id: id,
    event_type: "vendor_io_sent",
    recipient_email: recipientEmail,
    recipient_name: influencerName,
    sender_email: senderEmail,
    subject,
    gmail_message_id: emailResult.ok ? emailResult.messageId : null,
    send_batch_id: sendBatchId,
    sent_by: user.id,
    delivery_status: vendorDeliveryStatus,
    delivery_error: emailResult.ok ? null : emailResult.error,
    payload: {
      document_number: typed.document_number,
      pdf_url: typed.generated_pdf_url,
      approval_url: approvalUrl,
      campaign_header_id: campaignHeaderId,
      email_html: html,
      email_text: emailText,
      sender_display_name: senderName,
      has_pdf_attachment: hasPdfAttachment,
      ...deliveryMeta,
    },
    sent_at: deliveredAt,
  } as never);

  debugIo("io-email", "vendor io send", {
    id,
    approvalUrl,
    recipients: [recipientEmail],
    gmailOk: emailResult.ok,
  });
  if (!formDataDefersRevalidate(formData)) {
    revalidateIoPaths(campaignHeaderId);
  }

  if (!emailResult.ok) {
    return {
      ok: false,
      message: `Vendor IO marked as sent but email delivery failed: ${emailResult.error}`,
    };
  }

  return { ok: true, message: "Email Sent" };
}

