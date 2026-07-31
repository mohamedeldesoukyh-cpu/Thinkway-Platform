import { sendGmailEmail } from "@/lib/email/gmail-send";
import { sendResendEmail } from "@/lib/email/resend-send";

/** Platform Client IO defaults — not used by website transactional mail. */
export const CLIENT_IO_EMAIL_FROM_DEFAULT =
  "Thinkway Media Traffic <traffic@thinkwaymedia.com>";
export const CLIENT_IO_EMAIL_REPLY_TO_DEFAULT = "traffic@thinkwaymedia.com";

export type EmailAttachment = {
  filename: string;
  mimeType: string;
  content: Buffer;
};

export type SendEmailInput = {
  to: Array<{ name?: string; email: string }>;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
};

export type SendEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

export type EmailProviderId = "resend" | "gmail";

/** Active transport selected by EMAIL_PROVIDER (`resend` | `gmail`; default `gmail`). */
export function getEmailProvider(): EmailProviderId {
  const raw = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (raw === "resend") return "resend";
  return "gmail";
}

/** Full From header for Client IO outbound mail (`Name <email>`). */
export function getEmailFromHeader(): string {
  return process.env.EMAIL_FROM?.trim() || CLIENT_IO_EMAIL_FROM_DEFAULT;
}

/** Bare from address for io_notifications.sender_email and Client IO copy. */
export function getEmailFromAddress(): string {
  const header = getEmailFromHeader();
  const angled = header.match(/<([^>]+)>/);
  return (angled?.[1] ?? header).trim();
}

/** Reply-To for Client IO outbound mail. */
export function getEmailReplyTo(): string {
  return process.env.EMAIL_REPLY_TO?.trim() || CLIENT_IO_EMAIL_REPLY_TO_DEFAULT;
}

/**
 * Pluggable outbound email for Thinkway Platform Client IO.
 * Uses Resend when EMAIL_PROVIDER=resend; otherwise Gmail OAuth.
 * Does not serve website transactional email (noreply@).
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (getEmailProvider() === "resend") {
    return sendResendEmail({
      from: getEmailFromHeader(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: getEmailReplyTo(),
      attachments: input.attachments,
    });
  }

  return sendGmailEmail({
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: input.attachments,
  });
}
