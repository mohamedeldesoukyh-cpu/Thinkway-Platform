import "server-only";

import { assertOutboundEmailReady, sendEmail } from "@/lib/email/provider";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";

import {
  accessRequestIsInCooldown,
  buildClientWorkspaceAccessRequestEmail,
  normalizeClientWorkspaceAccessRequest,
  type ClientWorkspaceAccessRequestInput,
} from "./expired-access";
import { resolveClientReviewByTokenForPage } from "./load-client-workspace";

export async function requestStoppedClientWorkspaceAccess(input: {
  token: string;
  reviewId: string;
  name: string;
  email: string;
  note: string;
}): Promise<{ ok: true; alreadyRequested?: boolean } | { ok: false; message: string }> {
  const parsed = normalizeClientWorkspaceAccessRequest({
    name: input.name,
    email: input.email,
    note: input.note,
  });
  if (!parsed.ok) return parsed;

  const service = tryCreateServiceRoleClient().client;
  if (!service) {
    return { ok: false, message: "Client Workspace is temporarily unavailable." };
  }

  const resolved = await resolveClientReviewByTokenForPage(service, input.token);
  if (!resolved.ok) {
    return { ok: false, message: "This workspace link is invalid or has expired." };
  }
  if (resolved.review.id !== input.reviewId.trim()) {
    return { ok: false, message: "This workspace link is invalid or has expired." };
  }
  if (!resolved.linkExpired) {
    return { ok: false, message: "This workspace link is already active." };
  }

  const mailReady = assertOutboundEmailReady();
  if (!mailReady.ok) return { ok: false, message: mailReady.message };

  const { data: recent } = await service
    .from("campaign_client_review_events" as never)
    .select("payload, created_at")
    .eq("review_id", resolved.review.id)
    .eq("event_type", "access_requested")
    .order("created_at", { ascending: false })
    .limit(8);

  const requesterEmail = parsed.value.email.toLowerCase();
  const duplicate = ((recent ?? []) as Array<{
    payload?: { email?: string | null } | null;
    created_at?: string | null;
  }>).find((row) => {
    const email = row.payload?.email?.trim().toLowerCase();
    return email === requesterEmail && accessRequestIsInCooldown(row.created_at);
  });
  if (duplicate) {
    return { ok: true, alreadyRequested: true };
  }

  const email = buildClientWorkspaceAccessRequestEmail({
    campaignName: resolved.review.campaignName ?? "Campaign",
    brandName: resolved.review.brandName ?? "",
    clientLabel: resolved.review.clientLabel ?? "",
    requesterName: parsed.value.name,
    requesterEmail: parsed.value.email,
    note: parsed.value.note,
    reviewId: resolved.review.id,
    campaignHeaderId: resolved.review.campaignHeaderId,
  });

  const sent = await sendEmail({
    to: [{ email: email.to, name: "Thinkway Media Traffic" }],
    subject: email.subject,
    html: email.html,
    text: email.plainText,
  });
  if (!sent.ok) return { ok: false, message: sent.error };

  const { error: eventError } = await service.from("campaign_client_review_events" as never).insert({
    review_id: resolved.review.id,
    event_type: "access_requested",
    actor_kind: "client",
    actor_label: parsed.value.name || parsed.value.email,
    payload: {
      email: parsed.value.email,
      name: parsed.value.name || null,
      note: parsed.value.note || null,
    },
  } as never);
  if (eventError) {
    console.warn("[client-workspace] access_requested event insert failed", eventError.message);
  }

  return { ok: true };
}

export type { ClientWorkspaceAccessRequestInput };
