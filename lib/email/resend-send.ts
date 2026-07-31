export type ResendAttachment = {
  filename: string;
  mimeType: string;
  content: Buffer;
};

export type SendResendEmailInput = {
  from: string;
  to: Array<{ name?: string; email: string }>;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: ResendAttachment[];
};

export type SendResendEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

function formatAddress(name: string | undefined, email: string): string {
  const trimmed = email.trim();
  if (!name?.trim()) return trimmed;
  const safeName = name.replace(/"/g, '\\"');
  return `${safeName} <${trimmed}>`;
}

export async function sendResendEmail(
  input: SendResendEmailInput
): Promise<SendResendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Resend is not configured. Add RESEND_API_KEY in environment settings.",
    };
  }

  if (!input.from.trim()) {
    return {
      ok: false,
      error: "A From address is required for Resend (EMAIL_FROM).",
    };
  }

  if (input.to.length === 0) {
    return { ok: false, error: "At least one recipient is required." };
  }

  const payload: Record<string, unknown> = {
    from: input.from.trim(),
    to: input.to.map((r) => formatAddress(r.name, r.email)),
    subject: input.subject,
    html: input.html,
  };

  if (input.text?.trim()) {
    payload.text = input.text;
  }

  if (input.replyTo?.trim()) {
    payload.reply_to = input.replyTo.trim();
  }

  if (input.attachments?.length) {
    payload.attachments = input.attachments.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content.toString("base64"),
      content_type: attachment.mimeType,
    }));
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json()) as {
      id?: string;
      message?: string;
      name?: string;
      error?: { message?: string };
    };

    if (!response.ok || !body.id) {
      return {
        ok: false,
        error:
          body.error?.message ||
          body.message ||
          body.name ||
          "Resend API send failed.",
      };
    }

    return { ok: true, messageId: body.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Resend send failed.",
    };
  }
}
