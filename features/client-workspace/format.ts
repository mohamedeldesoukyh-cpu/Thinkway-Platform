import { resolveCreatorIdentity } from "@/lib/text/decode-html-entities";

export const NOT_AVAILABLE = "Not available";
export const DATA_NOT_AVAILABLE = "Data unavailable";
export const NOT_PROVIDED = "Not provided";
export const TO_BE_CONFIRMED = "To be confirmed";
export const DELIVERABLES_TO_BE_CONFIRMED = "Deliverables to be confirmed";
export const CONTENT_UNAVAILABLE = "Recent content unavailable";
export const CONTENT_UNAVAILABLE_DETAIL =
  "No stored publications are available for this creator.";

const INTERNAL_TERM =
  /\b(ECI|Apify|fingerprint|Thinkway Score|authenticity score|DNA|CIP|Campaign Facts|Discovery Engine|vendor cost|gross profit|\bGP\b|margin|source_snapshot|Campaign Intelligence Profile)\b/gi;

export function providedText(value?: string | null, fallback = NOT_PROVIDED): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function formatCompactCount(count: number | undefined | null): string {
  if (count == null || !Number.isFinite(count)) return NOT_AVAILABLE;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return Math.round(count).toLocaleString();
}

/**
 * Client Workspace ER matches the platform engine: a percentage
 * (`2.6` = 2.6%, `0.9` = 0.9%). Values in (0, 1] are sub-1% rates, not 0–1
 * fractions. Values above 100 are a percent that was multiplied twice
 * (e.g. 193.4 → 1.934).
 */
export function normalizeClientEngagementRate(
  rate: number | undefined | null
): number | null {
  if (rate == null || !Number.isFinite(rate) || rate < 0) return null;
  let value = rate;
  if (value > 100) value /= 100;
  return value;
}

export function formatEngagementPct(rate: number | undefined | null): string {
  const value = normalizeClientEngagementRate(rate);
  if (value == null) return NOT_AVAILABLE;
  return `${value.toFixed(1)}%`;
}

export function formatOptionalEngagementPct(rate: number | undefined | null): string | null {
  if (rate == null || !Number.isFinite(rate)) return null;
  return formatEngagementPct(rate);
}

export function formatOptionalCompactCount(count: number | undefined | null): string | null {
  if (count == null || !Number.isFinite(count)) return null;
  return formatCompactCount(count);
}

/** List-card chip: followers on top, ER% underneath. Missing values stay blank. */
export function listPlatformChipMetrics(row: {
  followers?: number | null;
  engagementRate?: number | null;
}): { followers: string | null; engagementRate: string | null } {
  return {
    followers: formatOptionalCompactCount(row.followers),
    engagementRate: formatOptionalEngagementPct(row.engagementRate),
  };
}

export function formatExactCount(count: number | undefined | null): string {
  if (count == null || !Number.isFinite(count)) return NOT_AVAILABLE;
  return Math.round(count).toLocaleString();
}

export function formatMoneyOrUnavailable(
  amount: number | undefined | null,
  currency: string,
  format: (value: number, currency: string) => string
): string {
  if (amount == null || !Number.isFinite(amount)) return NOT_AVAILABLE;
  return format(amount, currency);
}

export function formatLocation(city?: string, country?: string): string | undefined {
  const parts = [city?.trim(), country?.trim()].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : undefined;
}

export function formatPlatformLabel(platform?: string): string | undefined {
  if (!platform?.trim()) return undefined;
  const value = platform.trim();
  if (value.toLowerCase() === "instagram") return "Instagram";
  if (value.toLowerCase() === "tiktok") return "TikTok";
  if (value.toLowerCase() === "youtube") return "YouTube";
  if (value.toLowerCase() === "facebook") return "Facebook";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatEngagementRateLabel(platform?: string): string {
  const name = formatPlatformLabel(platform);
  return name ? `${name} engagement rate` : "Engagement rate";
}

export function formatMatchPercent(value: number | undefined | null): string | undefined {
  if (value == null || !Number.isFinite(value) || value < 0) return undefined;
  const percent = value > 0 && value <= 1 ? value * 100 : value;
  return `${Math.round(percent)}%`;
}

export function formatConfidencePercent(value: number | undefined | null): string | undefined {
  return formatMatchPercent(value);
}

export function clientSafeParagraph(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const cleaned = raw.replace(INTERNAL_TERM, "").replace(/\s{2,}/g, " ").trim();
  if (!cleaned) return undefined;
  return cleaned.length > 600 ? `${cleaned.slice(0, 597).trim()}…` : cleaned;
}

export function clientSafeFitCopy(raw: string | undefined): string | undefined {
  const cleaned = clientSafeParagraph(raw);
  if (!cleaned) return undefined;
  const sentence = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
  return sentence.length > 220 ? `${sentence.slice(0, 217).trim()}…` : sentence;
}

export function clientCreatorCardDescription(creator: {
  bio?: string;
  matchExplanation?: string;
  fitExplanation?: string;
  audienceHighlight?: string;
}): string | undefined {
  return (
    clientSafeParagraph(creator.bio) ||
    clientSafeFitCopy(creator.matchExplanation) ||
    clientSafeFitCopy(creator.fitExplanation) ||
    clientSafeFitCopy(creator.audienceHighlight)
  );
}

export function clientFacingAllocationNote(note?: string): string | undefined {
  if (!note) return undefined;
  if (!note.includes("CampaignFacts")) return note;
  const stripped = note
    .replace(/\s*—\s*influencer-only default:.*$/i, "")
    .replace(/^100% Creator Fees — brief and CampaignFacts[^.]*\.\s*/i, "")
    .trim();
  return stripped || "Creator investment covers production inside the fee.";
}

export function clientCreatorIdentity(name?: string | null, handle?: string | null) {
  return resolveCreatorIdentity(name, handle);
}

export function formatHandleLabel(handle?: string | null): string | undefined {
  const username = handle?.trim().replace(/^@+/, "");
  if (!username) return undefined;
  return `@${username}`;
}
