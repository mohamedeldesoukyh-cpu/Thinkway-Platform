export type ClientIoRecipientEntry = {
  name: string;
  email: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidClientIoEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/**
 * Split a pasted blob (comma / semicolon / whitespace) into distinct emails.
 * Used when operators paste many addresses into one recipient field.
 */
export function splitRecipientEmails(raw: string): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    const email = part.trim();
    if (!email || !EMAIL_RE.test(email)) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(email);
  }
  return emails;
}

/**
 * Apply an email-field edit. If the value contains multiple addresses, expand
 * into additional recipient rows so every address is sent.
 */
export function applyRecipientEmailEdit(
  recipients: ClientIoRecipientEntry[],
  index: number,
  rawEmail: string
): ClientIoRecipientEntry[] {
  const emails = splitRecipientEmails(rawEmail);
  if (emails.length <= 1) {
    return recipients.map((row, i) =>
      i === index ? { ...row, email: rawEmail } : row
    );
  }

  const next = recipients.map((row, i) =>
    i === index ? { ...row, email: emails[0]! } : row
  );
  const existing = new Set(
    next.map((r) => r.email.trim().toLowerCase()).filter(Boolean)
  );
  const extras: ClientIoRecipientEntry[] = [];
  for (const email of emails.slice(1)) {
    const key = email.toLowerCase();
    if (existing.has(key)) continue;
    existing.add(key);
    extras.push({ name: "", email });
  }
  if (extras.length === 0) return next;
  next.splice(index + 1, 0, ...extras);
  return next;
}

export function parseSendRecipientsJson(raw: unknown): ClientIoRecipientEntry[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const recipients: ClientIoRecipientEntry[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const name = String((item as { name?: unknown }).name ?? "").trim();
    const emailRaw = String((item as { email?: unknown }).email ?? "").trim();
    // Support stored rows that accidentally contain multiple addresses.
    const emails = splitRecipientEmails(emailRaw);
    if (emails.length === 0) continue;
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i]!;
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      recipients.push({ name: i === 0 ? name : "", email });
    }
  }

  return recipients;
}

export function parseSendRecipientsField(value: string | null | undefined): ClientIoRecipientEntry[] {
  const trimmed = value?.trim();
  if (!trimmed) return [];
  try {
    return parseSendRecipientsJson(JSON.parse(trimmed));
  } catch {
    return [];
  }
}

export function serializeSendRecipients(recipients: ClientIoRecipientEntry[]): string {
  return JSON.stringify(
    recipients
      .map((r) => ({
        name: r.name.trim(),
        email: r.email.trim(),
      }))
      .filter((r) => r.email)
  );
}

export function seedRecipientsFromContacts(
  existing: ClientIoRecipientEntry[],
  contacts: Array<{ label: string; email: string }>
): ClientIoRecipientEntry[] {
  if (existing.length > 0) return existing;
  return contacts.map((contact) => ({
    name: contact.label.replace(/\s*\(Primary\)\s*$/i, "").replace(/\s+billing\s*$/i, "").trim(),
    email: contact.email,
  }));
}
