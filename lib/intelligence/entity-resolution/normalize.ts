export function normalizeName(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[@#]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s._-]/gu, "");
}

export function normalizeHandle(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toLowerCase().replace(/^@+/, "");
}

export function normalizeCampaignDocumentNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const campHash = trimmed.match(/^Camp#(\d{4})-(\d+)/i);
  if (campHash) return `TW-${campHash[1]}-${campHash[2]}`;
  const tw = trimmed.match(/TW-(\d{4})-(\d+)/i);
  if (tw) return `TW-${tw[1]}-${tw[2]}`;
  const camp = trimmed.match(/(?:\(26\)\s*)?Camp-(\d+)/i);
  if (camp) return `Camp-${camp[1]}`;
  return trimmed;
}

export function tokenize(value: string): string[] {
  return normalizeName(value)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}
