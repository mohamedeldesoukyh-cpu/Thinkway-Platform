import { getGmailConfig, type GmailConfig } from "@/lib/email/gmail-config";

export type GmailAttachment = {
  filename: string;
  mimeType: string;
  content: Buffer;
};

export type SendGmailEmailInput = {
  to: Array<{ name?: string; email: string }>;
  subject: string;
  html: string;
  text?: string;
  attachments?: GmailAttachment[];
};

export type SendGmailEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function fetchAccessToken(config: GmailConfig): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description || payload.error || "Gmail OAuth token refresh failed."
    );
  }

  cachedAccessToken = {
    token: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  };

  return payload.access_token;
}

function formatAddress(name: string | undefined, email: string): string {
  const trimmed = email.trim();
  if (!name?.trim()) return trimmed;
  const safeName = name.replace(/"/g, '\\"');
  return `"${safeName}" <${trimmed}>`;
}

function toBase64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildMimeMessage(input: SendGmailEmailInput, config: GmailConfig): string {
  const boundary = `thinkway_${Date.now()}`;
  const toHeader = input.to.map((r) => formatAddress(r.name, r.email)).join(", ");
  const fromHeader = formatAddress(config.fromName, config.fromEmail);
  const textBody = input.text ?? input.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const lines: string[] = [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: multipart/alternative; boundary="alt"',
    "",
    "--alt",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    textBody,
    "",
    "--alt",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    input.html,
    "",
    "--alt--",
  ];

  for (const attachment of input.attachments ?? []) {
    lines.push(
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      "",
      attachment.content.toString("base64"),
      ""
    );
  }

  lines.push(`--${boundary}--`);
  return lines.join("\r\n");
}

export async function sendGmailEmail(input: SendGmailEmailInput): Promise<SendGmailEmailResult> {
  const config = getGmailConfig();
  if (!config) {
    return {
      ok: false,
      error:
        "Gmail is not configured. Add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN in environment settings.",
    };
  }

  if (input.to.length === 0) {
    return { ok: false, error: "At least one recipient is required." };
  }

  try {
    const accessToken = await fetchAccessToken(config);
    const raw = buildMimeMessage(input, config);
    const encoded = toBase64Url(Buffer.from(raw, "utf8"));

    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encoded }),
    });

    const payload = (await response.json()) as { id?: string; error?: { message?: string } };

    if (!response.ok || !payload.id) {
      return {
        ok: false,
        error: payload.error?.message ?? "Gmail API send failed.",
      };
    }

    return { ok: true, messageId: payload.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Gmail send failed.",
    };
  }
}
