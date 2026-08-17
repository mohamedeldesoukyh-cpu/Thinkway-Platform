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

export function formatEngagementPct(rate: number | undefined | null): string {
  if (rate == null || !Number.isFinite(rate)) return NOT_AVAILABLE;
  const value = rate > 0 && rate <= 1 ? rate * 100 : rate;
  return `${value.toFixed(1)}%`;
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

export function clientFacingAllocationNote(note?: string): string | undefined {
  if (!note) return undefined;
  if (!note.includes("CampaignFacts")) return note;
  const stripped = note
    .replace(/\s*—\s*influencer-only default:.*$/i, "")
    .replace(/^100% Creator Fees — brief and CampaignFacts[^.]*\.\s*/i, "")
    .trim();
  return stripped || "Creator investment covers production inside the fee.";
}
