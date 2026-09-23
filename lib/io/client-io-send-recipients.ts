export type ClientIoRecipientEntry = {
  name: string;
  email: string;
  role?: "to" | "cc" | "bcc";
  documentRole?: "main" | "other";
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
    extras.push({ name: "", email, ...(recipients[index]?.role ? { role: recipients[index].role } : {}) });
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
    const role = (item as { role?: unknown }).role;
    const documentRole = (item as { documentRole?: unknown }).documentRole;
    const documentField = documentRole === "main" || documentRole === "other" ? { documentRole } : {};
    const roleField = role === "to" || role === "cc" || role === "bcc" ? { role } : {};
    // Support stored rows that accidentally contain multiple addresses.
    const emails = splitRecipientEmails(emailRaw);
    if (emails.length === 0) continue;
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i]!;
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      recipients.push({ name: i === 0 ? name : "", email, ...roleField, ...documentField } as ClientIoRecipientEntry);
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
        ...(r.role ? { role: r.role } : {}),
        ...(r.documentRole ? { documentRole: r.documentRole } : {}),
      }))
  );
}

export function seedRecipientsFromContacts(
  existing: ClientIoRecipientEntry[],
  contacts: Array<{ label: string; email: string }>,
  configured = false
): ClientIoRecipientEntry[] {
  if (configured || existing.length > 0) return existing;
  return contacts.map((contact) => ({
    name: contact.label.replace(/\s*\(Primary\)\s*$/i, "").replace(/\s+billing\s*$/i, "").trim(),
    email: contact.email,
  }));
}

/** Reject invalid rows instead of silently dropping recipients. */
export function validateClientIoRecipients(raw: string): string | null {
  try {
    const rows: unknown = JSON.parse(raw);
    if (!Array.isArray(rows)) return "Invalid recipient list.";
    for (const row of rows) {
      if (!row || typeof row !== "object" || typeof row.email !== "string" || !isValidClientIoEmail(row.email) ||
          (row.role !== undefined && !["to", "cc", "bcc"].includes(row.role)) ||
          (row.documentRole !== undefined && !["main", "other"].includes(row.documentRole))) {
        return "Enter a valid email and TO, CC or BCC role for every recipient.";
      }
      if (/[\r\n]/.test(String(row.name ?? ""))) return "Contact names must be on one line.";
    }
    const emails = rows.map(row => row.email.trim().toLowerCase());
    if (new Set(emails).size !== emails.length) return "Each email can appear only once. Choose its TO, CC or BCC role.";
    return null;
  } catch { return "Invalid recipient list."; }
}

export function clientIoDeliveryRecipients(recipients: ClientIoRecipientEntry[], senderEmail?: string | null) {
  const result = { to: [] as ClientIoRecipientEntry[], cc: [] as ClientIoRecipientEntry[], bcc: [] as ClientIoRecipientEntry[] };
  const normalized = parseSendRecipientsJson(recipients);
  for (const recipient of normalized) result[recipient.role ?? "to"].push(recipient);
  const seen = new Set(normalized.map(r => r.email.toLowerCase()));
  for (const email of ["traffic@thinkwaymedia.com", senderEmail?.trim()]) {
    if (!email || !isValidClientIoEmail(email) || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    result.bcc.push({ name: "", email, role: "bcc" });
  }
  return result;
}

/** Document contact selection is independent of email delivery role. Legacy lists use their first TO. */
export function clientIoDocumentRecipients(recipients: ClientIoRecipientEntry[]): ClientIoRecipientEntry[] {
  if (recipients.some(r => r.documentRole !== undefined)) return recipients.filter(r => r.documentRole === "main");
  const firstTo = recipients.find(r => !r.role || r.role === "to");
  return firstTo ? [firstTo] : [];
}
