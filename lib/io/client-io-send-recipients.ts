export type ClientIoRecipientEntry = {
  name: string;
  email: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseSendRecipientsJson(raw: unknown): ClientIoRecipientEntry[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const recipients: ClientIoRecipientEntry[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const name = String((item as { name?: unknown }).name ?? "").trim();
    const email = String((item as { email?: unknown }).email ?? "").trim();
    if (!email || !EMAIL_RE.test(email)) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push({ name, email });
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
