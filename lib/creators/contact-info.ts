const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const EMAIL_VALID_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export type CreatorContactFields = {
  contact_email: string | null;
  contact_phone: string | null;
  contact_links: string[];
};

export function extractEmailFromText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const match = text.match(EMAIL_RE);
  return match?.[0]?.toLowerCase().trim() ?? null;
}

export function normalizeContactEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim();
  if (!trimmed) return null;
  if (EMAIL_VALID_RE.test(trimmed)) return trimmed.toLowerCase();
  return extractEmailFromText(trimmed);
}

export function normalizeContactPhone(phone: string | null | undefined): string | null {
  const trimmed = phone?.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[^\d+().\s-]/g, "").trim();
  const digits = cleaned.replace(/\D/g, "");
  return digits.length >= 6 ? cleaned : null;
}

export function normalizeContactLink(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (/^mailto:/i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  if (trimmed.includes(".") && !trimmed.includes("@") && !trimmed.includes(" ")) {
    return `https://${trimmed}`;
  }
  return null;
}

export function normalizeContactLinks(links: string[] | null | undefined): string[] {
  if (!links?.length) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const link of links) {
    const normalized = normalizeContactLink(link);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

/** Append unique links — never wipe existing contact URLs on partial enrichment/import. */
export function mergeContactLinks(
  existing: string[] | null | undefined,
  incoming: string[] | null | undefined
): string[] {
  return normalizeContactLinks([...(existing ?? []), ...(incoming ?? [])]);
}

export function resolveCreatorContactFields(input: {
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_links?: string[] | null;
}): CreatorContactFields {
  return {
    contact_email: normalizeContactEmail(input.contact_email),
    contact_phone: normalizeContactPhone(input.contact_phone),
    contact_links: normalizeContactLinks(input.contact_links),
  };
}

export function hasCreatorContact(contact: CreatorContactFields): boolean {
  return Boolean(
    contact.contact_email || contact.contact_phone || contact.contact_links.length > 0
  );
}

export function pickCreatorContactFromPlatforms<
  T extends {
    id?: string;
    contact_email?: string | null;
    contact_phone?: string | null;
    contact_links?: string[] | null;
  },
>(platforms: T[], preferredAccountId?: string | null): CreatorContactFields {
  const ordered =
    preferredAccountId != null
      ? [
          ...platforms.filter((platform) => platform.id === preferredAccountId),
          ...platforms.filter((platform) => platform.id !== preferredAccountId),
        ]
      : platforms;

  let contact_email: string | null = null;
  let contact_phone: string | null = null;
  let contact_links: string[] = [];

  for (const platform of ordered) {
    if (!contact_email && platform.contact_email) {
      contact_email = normalizeContactEmail(platform.contact_email);
    }
    if (!contact_phone && platform.contact_phone) {
      contact_phone = normalizeContactPhone(platform.contact_phone);
    }
    contact_links = mergeContactLinks(contact_links, platform.contact_links);
  }

  return { contact_email, contact_phone, contact_links };
}
