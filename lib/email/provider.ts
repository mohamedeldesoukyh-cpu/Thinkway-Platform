import { isGmailConfigured } from "@/lib/email/gmail-config";
import { sendGmailEmail } from "@/lib/email/gmail-send";
import { sendResendEmail } from "@/lib/email/resend-send";

/** Platform Client IO / Vendor IO defaults — not used by website transactional mail. */
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

export type OutboundEmailRuntimeStatus = {
  /** Resolved transport used by Client IO / Vendor IO send. */
  provider: EmailProviderId;
  /** Raw EMAIL_PROVIDER env (trimmed), or null when unset/empty. */
  envProvider: string | null;
  fromAddress: string;
  fromHeader: string;
  replyTo: string;
  resendConfigured: boolean;
  gmailConfigured: boolean;
  /** True when the active provider has the credentials required to send. */
  sendReady: boolean;
  sendBlockedReason: string | null;
};

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/**
 * Active transport for platform IO outbound mail.
 *
 * Selection (env only — no DB / feature flag):
 * 1. EMAIL_PROVIDER=resend → Resend
 * 2. EMAIL_PROVIDER=gmail → Gmail (optional mailbox path)
 * 3. Unset / empty → Resend when RESEND_API_KEY is present, else Gmail only if
 *    Gmail OAuth is configured, else Resend (platform default)
 *
 * Gmail must never be selected merely because Resend credentials are missing
 * when EMAIL_PROVIDER explicitly requests Resend.
 */
export function getEmailProvider(): EmailProviderId {
  const raw = process.env.EMAIL_PROVIDER?.trim().toLowerCase() || null;
  if (raw === "resend") return "resend";
  if (raw === "gmail") return "gmail";

  if (isResendConfigured()) return "resend";
  if (isGmailConfigured()) return "gmail";
  return "resend";
}

/** Full From header for Client IO / Vendor IO outbound mail (`Name <email>`). */
export function getEmailFromHeader(): string {
  return process.env.EMAIL_FROM?.trim() || CLIENT_IO_EMAIL_FROM_DEFAULT;
}

/** Bare from address for io_notifications.sender_email and Client IO copy. */
export function getEmailFromAddress(): string {
  const header = getEmailFromHeader();
  const angled = header.match(/<([^>]+)>/);
  return (angled?.[1] ?? header).trim();
}

/** Reply-To for Client IO / Vendor IO outbound mail. */
export function getEmailReplyTo(): string {
  return process.env.EMAIL_REPLY_TO?.trim() || CLIENT_IO_EMAIL_REPLY_TO_DEFAULT;
}

/** Runtime status for Settings / ops — never exposes secret values. */
export function getOutboundEmailRuntimeStatus(): OutboundEmailRuntimeStatus {
  const envRaw = process.env.EMAIL_PROVIDER?.trim() || null;
  const provider = getEmailProvider();
  const resendConfigured = isResendConfigured();
  const gmailConfigured = isGmailConfigured();
  const fromHeader = getEmailFromHeader();
  const fromAddress = getEmailFromAddress();
  const replyTo = getEmailReplyTo();

  let sendReady = false;
  let sendBlockedReason: string | null = null;

  if (provider === "resend") {
    if (resendConfigured) {
      sendReady = true;
    } else {
      sendBlockedReason =
        "Active provider is Resend but RESEND_API_KEY is not configured.";
    }
  } else if (gmailConfigured) {
    sendReady = true;
  } else {
    sendBlockedReason =
      "Active provider is Gmail but GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN are not configured.";
  }

  return {
    provider,
    envProvider: envRaw,
    fromAddress,
    fromHeader,
    replyTo,
    resendConfigured,
    gmailConfigured,
    sendReady,
    sendBlockedReason,
  };
}

/**
 * Guard for Client IO / Vendor IO send actions.
 * Fails closed when the active provider cannot send — never falls back across providers.
 */
export function assertOutboundEmailReady(): { ok: true } | { ok: false; message: string } {
  const status = getOutboundEmailRuntimeStatus();
  if (status.sendReady) return { ok: true };
  return {
    ok: false,
    message:
      status.sendBlockedReason ??
      "Outbound email is not configured for Client IO / Vendor IO send.",
  };
}

/**
 * Pluggable outbound email for Thinkway Platform Client IO / Vendor IO.
 * Routes strictly by getEmailProvider() — never silently falls back to Gmail
 * when Resend is the active provider.
 * Does not serve website transactional email (noreply@).
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const provider = getEmailProvider();

  if (provider === "resend") {
    if (!isResendConfigured()) {
      return {
        ok: false,
        error:
          "Resend is the active email provider but RESEND_API_KEY is not configured.",
      };
    }
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

  if (!isGmailConfigured()) {
    return {
      ok: false,
      error:
        "Gmail is the active email provider but Gmail OAuth is not configured. Set EMAIL_PROVIDER=resend to use Resend for IO send.",
    };
  }

  return sendGmailEmail({
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: input.attachments,
  });
}
