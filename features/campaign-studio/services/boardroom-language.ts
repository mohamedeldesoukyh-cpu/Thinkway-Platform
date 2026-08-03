/**
 * Strip internal engineering vocabulary from boardroom-facing copy.
 * Does not invent facts — only rewrites labels clients should never see.
 */

const INTERNAL_PHRASES: Array<[RegExp, string]> = [
  [/\bDirector Strategy SSOT\b/gi, "the approved Director strategy"],
  [/\bDirectorStrategy\b/g, "Director strategy"],
  [/CampaignFacts\[[^\]]*\]/g, "brief evidence"],
  [/\bCampaignFacts SSOT\b/gi, "the campaign brief"],
  [/\bCampaignFacts\b/g, "the campaign brief"],
  [/\bFacts SSOT:\s*/gi, ""],
  [/\bSSOT\b/g, "source of truth"],
  [/\bper CampaignFacts\b/gi, "per the campaign brief"],
  [/\bgrounded in the campaign brief and the approved Director strategy\b/gi, "grounded in the brief and approved strategy"],
];

export function toBoardroomLanguage(text: string | null | undefined): string {
  if (!text?.trim()) return text ?? "";
  let out = text;
  for (const [pattern, replacement] of INTERNAL_PHRASES) {
    out = out.replace(pattern, replacement);
  }
  return out.replace(/\s{2,}/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
}

export function parseCompactFollowerCount(token: string): number | undefined {
  const match = token.trim().match(/^([\d,.]+)\s*([KMB])?$/i);
  if (!match?.[1]) return undefined;
  const base = Number.parseFloat(match[1].replace(/,/g, ""));
  if (!Number.isFinite(base) || base <= 0) return undefined;
  const suffix = (match[2] ?? "").toUpperCase();
  if (suffix === "B") return Math.round(base * 1_000_000_000);
  if (suffix === "M") return Math.round(base * 1_000_000);
  if (suffix === "K") return Math.round(base * 1_000);
  return Math.round(base);
}

export function humanizeCreatorHandle(handle: string): string {
  const bare = handle.replace(/^@/, "").trim();
  if (!bare) return "Creator";
  return bare
    .split(/[._]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
