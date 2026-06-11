const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export function extractEmailFromBio(bio: string | undefined): string | undefined {
  if (!bio) return undefined;
  const match = bio.match(EMAIL_RE);
  return match?.[0]?.toLowerCase();
}

export function parseCompactCount(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().toLowerCase().replace(/,/g, "");
  const m = cleaned.match(/^([\d.]+)\s*([kmb])?$/i);
  if (!m) {
    const digits = Number(cleaned.replace(/[^\d.]/g, ""));
    return Number.isFinite(digits) ? Math.round(digits) : undefined;
  }
  const base = Number(m[1]);
  if (!Number.isFinite(base)) return undefined;
  const suffix = m[2]?.toLowerCase();
  if (suffix === "k") return Math.round(base * 1_000);
  if (suffix === "m") return Math.round(base * 1_000_000);
  if (suffix === "b") return Math.round(base * 1_000_000_000);
  return Math.round(base);
}

export function extractMetaContent(html: string, property: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  return html.match(re)?.[1];
}

export function extractHashtags(text: string): string[] {
  const tags = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return [...new Set(tags.map((t) => t.slice(1).toLowerCase()))];
}
