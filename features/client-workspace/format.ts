export function formatCompactCount(count: number | undefined): string {
  if (count == null || !Number.isFinite(count)) return "—";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return Math.round(count).toLocaleString();
}

export function formatEngagementPct(rate: number | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  const value = rate > 0 && rate <= 1 ? rate * 100 : rate;
  return `${value.toFixed(2)}%`;
}

export function clientSafeFitCopy(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const cleaned = raw
    .replace(/\b(ECI|Apify|fingerprint|Thinkway Score|authenticity score|DNA|CIP)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
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
