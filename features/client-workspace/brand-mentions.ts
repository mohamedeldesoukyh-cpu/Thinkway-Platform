import type { CreatorIntelligenceBundle } from "@/lib/enterprise-creator-intelligence";

import type { ClientBrandMention } from "./types";

const VISIBLE_LOGOS = 8;

export function normalizeBrandMentions(
  value?: Array<string | ClientBrandMention> | null
): ClientBrandMention[] {
  if (!value?.length) return [];
  const seen = new Set<string>();
  const mentions: ClientBrandMention[] = [];
  for (const row of value) {
    const mention = typeof row === "string" ? { name: row.trim() } : row;
    const name = mention.name?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    mentions.push({
      name,
      handle: mention.handle?.trim() || undefined,
      mentionCount: finiteCount(mention.mentionCount),
      mentionsLast180Days: finiteCount(mention.mentionsLast180Days),
    });
  }
  return mentions;
}

export function brandMentionsFromBundle(
  bundle: CreatorIntelligenceBundle | null | undefined
): ClientBrandMention[] {
  if (!bundle?.categoryBrand.brands.length) return [];
  return bundle.categoryBrand.brands
    .filter((brand) => brand.brandName.trim() && brand.mentionCount > 0)
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, 12)
    .map((brand) => ({
      name: brand.brandName.trim(),
      mentionCount: brand.mentionCount,
      mentionsLast180Days: finiteCount(brand.windows.last_180_days),
    }));
}

export function brandMentionsForDisplay(mentions: ClientBrandMention[]): {
  brands: ClientBrandMention[];
  windowDays: 180 | null;
  extraCount: number;
} {
  const withWindow = mentions.filter((item) => (item.mentionsLast180Days ?? 0) > 0);
  const brands = withWindow.length > 0 ? withWindow : mentions;
  return {
    brands,
    windowDays: withWindow.length > 0 ? 180 : null,
    extraCount: Math.max(0, brands.length - VISIBLE_LOGOS),
  };
}

export function visibleBrandLogos(mentions: ClientBrandMention[]): ClientBrandMention[] {
  return brandMentionsForDisplay(mentions).brands.slice(0, VISIBLE_LOGOS);
}

export function brandLogoUrl(mention: ClientBrandMention): string {
  const domain = brandDomainGuess(mention.name, mention.handle);
  return `https://logo.clearbit.com/${encodeURIComponent(domain)}`;
}

export function brandFaviconUrl(mention: ClientBrandMention): string {
  const domain = brandDomainGuess(mention.name, mention.handle);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

export function brandDomainGuess(name: string, handle?: string): string {
  const raw = (handle || name).replace(/^@/, "").trim().toLowerCase();
  if (!raw) return "example.com";
  if (raw.includes(".")) return raw.replace(/^www\./, "");
  const slug = raw.replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
  return `${slug || "brand"}.com`;
}

export function brandMentionsInsight(mentions: ClientBrandMention[]): {
  count: number;
  windowDays: 180 | null;
  badge?: { className: string; text: string };
  explanation: string;
} | null {
  const { brands, windowDays } = brandMentionsForDisplay(mentions);
  if (brands.length === 0) return null;
  const count = brands.length;
  const windowCopy =
    windowDays === 180 ? "over the past 180 days" : "on this proposal";
  if (count >= 9) {
    return {
      count,
      windowDays,
      badge: { className: "opt", text: "Optimal" },
      explanation: `This creator is associated with ${count} brands ${windowCopy}. That frequency shows commercial experience while leaving room for a new collaboration to stand out.`,
    };
  }
  if (count >= 4) {
    return {
      count,
      windowDays,
      badge: { className: "avg", text: "Average" },
      explanation: `This creator is associated with ${count} brands ${windowCopy}, a moderate collaboration history that still leaves space for a campaign to be distinctive.`,
    };
  }
  return {
    count,
    windowDays,
    badge: { className: "avg", text: "Average" },
    explanation: `This creator is associated with ${count} brand${count === 1 ? "" : "s"} ${windowCopy}. The mention history is limited, so a new campaign can take a more prominent place in the feed.`,
  };
}

function finiteCount(value: number | undefined | null): number | undefined {
  return value != null && Number.isFinite(value) && value > 0 ? value : undefined;
}
