import { TRAFFIC_OPERATIONS_EMAIL } from "@/lib/email/io-approval-emails";
import {
  appendThinkwayEmailPlainTextFooter,
  renderEmailSummaryTable,
  wrapThinkwayEmailDocument,
} from "@/lib/email/layout";
import { isValidClientIoEmail } from "@/lib/io/client-io-send-recipients";

export const CLIENT_WORKSPACE_EXPIRED_TITLE = "This workspace link has expired";

export const CLIENT_WORKSPACE_EXPIRED_BODY =
  "Access to this Client Workspace is no longer active. The campaign materials remain on file with Thinkway. If you still need to review this work, request access and our team will follow up.";

export const CLIENT_WORKSPACE_REQUEST_ACCESS_LEAD =
  "Request access and Thinkway Traffic will restore the link if it is still appropriate.";

export const CLIENT_WORKSPACE_REQUEST_ACCESS_LABEL = "Request access";

export const CLIENT_WORKSPACE_ACCESS_REQUESTED_TITLE = "Request received";

export const CLIENT_WORKSPACE_ACCESS_REQUESTED_BODY =
  "Thank you. Your request has been sent to Thinkway Traffic. Our team will be in touch shortly.";

export const CLIENT_WORKSPACE_ACCESS_REQUEST_COOLDOWN_MS = 15 * 60 * 1000;

export type ClientWorkspaceAccessRequestInput = {
  name: string;
  email: string;
  note: string;
};

export function normalizeClientWorkspaceAccessRequest(
  input: Partial<ClientWorkspaceAccessRequestInput>
): { ok: true; value: ClientWorkspaceAccessRequestInput } | { ok: false; message: string } {
  const name = (input.name ?? "").trim().slice(0, 120);
  const email = (input.email ?? "").trim();
  const note = (input.note ?? "").trim().slice(0, 1000);
  if (!isValidClientIoEmail(email)) {
    return { ok: false, message: "Enter a valid work email so we can reach you." };
  }
  return { ok: true, value: { name, email, note } };
}

export function accessRequestIsInCooldown(
  lastRequestedAt: string | null | undefined,
  now = Date.now()
): boolean {
  if (!lastRequestedAt?.trim()) return false;
  const at = new Date(lastRequestedAt).getTime();
  if (Number.isNaN(at)) return false;
  return now - at < CLIENT_WORKSPACE_ACCESS_REQUEST_COOLDOWN_MS;
}

export function buildClientWorkspaceAccessRequestSubject(campaignName: string): string {
  const campaign = campaignName.trim() || "Campaign";
  return `Client Workspace access requested — ${campaign}`;
}

export function buildClientWorkspaceAccessRequestEmail(input: {
  campaignName: string;
  brandName: string;
  clientLabel: string;
  requesterName: string;
  requesterEmail: string;
  note: string;
  reviewId: string;
  campaignHeaderId?: string | null;
}): { subject: string; html: string; plainText: string; to: string } {
  const campaign = input.campaignName.trim() || "Campaign";
  const subject = buildClientWorkspaceAccessRequestSubject(campaign);
  const requester = input.requesterName.trim() || "Not provided";
  const note = input.note.trim() || "—";
  const rows = [
    { label: "Campaign", value: campaign },
    { label: "Brand", value: input.brandName.trim() || "—" },
    { label: "Client", value: input.clientLabel.trim() || "—" },
    { label: "Requester", value: requester },
    { label: "Email", value: input.requesterEmail.trim() },
    { label: "Note", value: note },
    { label: "Review", value: input.reviewId },
  ];
  if (input.campaignHeaderId?.trim()) {
    rows.push({ label: "Campaign ID", value: input.campaignHeaderId.trim() });
  }

  const bodyHtml = `
    <p style="margin:0 0 16px;">A client requested access to a Client Workspace link that is currently expired.</p>
    ${renderEmailSummaryTable(rows)}
    <p style="margin:0 0 8px;font-size:14px;color:#374151;">
      Restore the link from the campaign list Client link control if access should continue.
    </p>
  `;

  const html = wrapThinkwayEmailDocument({
    documentTitle: "Client Workspace access request",
    documentKind: "Client Workspace access request",
    bodyHtml,
  });

  const plainText = appendThinkwayEmailPlainTextFooter([
    "A client requested access to a Client Workspace link that is currently expired.",
    "",
    `Campaign: ${campaign}`,
    `Brand: ${input.brandName.trim() || "—"}`,
    `Client: ${input.clientLabel.trim() || "—"}`,
    `Requester: ${requester}`,
    `Email: ${input.requesterEmail.trim()}`,
    `Note: ${note}`,
    `Review: ${input.reviewId}`,
    input.campaignHeaderId?.trim() ? `Campaign ID: ${input.campaignHeaderId.trim()}` : null,
    "",
    "Restore the link from the campaign list Client link control if access should continue.",
  ]);

  return {
    subject,
    html,
    plainText,
    to: TRAFFIC_OPERATIONS_EMAIL,
  };
}
