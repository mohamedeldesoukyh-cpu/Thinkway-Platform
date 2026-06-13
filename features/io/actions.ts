"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchClientIoRow } from "@/lib/io/client-io-query";
import {
  buildClientIoEmailHtml,
  buildClientIoEmailPlainText,
  buildClientIoEmailSubject,
  buildClientIoPdfAttachment,
} from "@/lib/email/client-io-email";
import { getGmailFromEmail } from "@/lib/email/gmail-config";
import { sendGmailEmail } from "@/lib/email/gmail-send";
import { parseTermsText, serializeTermsText } from "@/lib/io/client-io-terms";
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

  debugIo("client-io", "ensured for campaign", { campaignHeaderId, clientIoId });
  revalidateIoPaths(campaignHeaderId);
  return { ok: true, message: "Client IO is ready for this campaign." };
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

  const subject = buildClientIoEmailSubject(clientIo);
  const html = buildClientIoEmailHtml({
    io: clientIo,
    senderName,
    approvalUrl,
  });
  const emailText = buildClientIoEmailPlainText({
    io: clientIo,
    senderName,
    approvalUrl,
  });
  const pdfAttachment = await buildClientIoPdfAttachment(clientIo.generated_pdf_url);
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

  revalidateIoPaths(campaignHeaderId);

  if (!gmailResult.ok) {
    return {
      ok: false,
      message: `IO marked as sent but email delivery failed: ${gmailResult.error}`,
    };
  }

  const recipientCount = recipients.length;
  return {
    ok: true,
    message: `Client IO sent to ${recipientCount} recipient${recipientCount === 1 ? "" : "s"} from ${senderEmail}.`,
  };
}

export async function updateVendorIoAction(
  _prev: IoActionState,
  formData: FormData
): Promise<IoActionState> {
  const id = String(formData.get("id") ?? "");
  const campaignHeaderId = String(formData.get("campaign_header_id") ?? "");
  const termsText = String(formData.get("terms_text") ?? "").trim();
  const termsHtml = String(formData.get("terms_html") ?? "").trim();
  const usageRights = String(formData.get("usage_rights") ?? "").trim();
  const exclusivity = String(formData.get("exclusivity") ?? "").trim();
  const attachmentUrl = String(formData.get("attachment_url") ?? "").trim();
  const status = String(formData.get("status") ?? "draft") as VendorIoStatus;

  if (!id || !campaignHeaderId) return { ok: false, message: "Missing IO context." };

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

  const amountRaw = formData.get("amount");
  const amount =
    amountRaw != null && String(amountRaw).trim() !== ""
      ? Number(amountRaw)
      : undefined;

  const patch: Record<string, unknown> = {
    terms_text: termsText || null,
    terms_html: termsHtml || null,
    usage_rights: usageRights || null,
    exclusivity: exclusivity || null,
    attachment_url: attachmentUrl || null,
    status,
    updated_by: user.id,
  };

  if (amount !== undefined && Number.isFinite(amount) && amount >= 0) {
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

