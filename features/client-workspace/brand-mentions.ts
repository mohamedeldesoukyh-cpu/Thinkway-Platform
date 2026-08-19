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
      handle: brand.handle?.trim() || undefined,
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

const WEBSITE_TLDS = new Set([
  "com",
  "net",
  "org",
  "io",
  "co",
  "ae",
  "eg",
  "uk",
  "sa",
  "qa",
  "kw",
  "bh",
  "om",
  "de",
  "fr",
  "it",
  "es",
  "app",
  "shop",
]);

/** Instagram/TikTok mention handles may contain dots; those are not websites. */
export function isLikelyWebsiteDomain(value: string): boolean {
  const host = value.replace(/^@/, "").replace(/^www\./, "").trim().toLowerCase();
  const parts = host.split(".");
  if (parts.length < 2) return false;
  const tld = parts[parts.length - 1] ?? "";
  return WEBSITE_TLDS.has(tld) && parts.every((part) => part.length > 0);
}

export function brandSocialHandle(
  mention: Pick<ClientBrandMention, "name" | "handle">
): string | null {
  const fromHandle = mention.handle?.replace(/^@/, "").trim().toLowerCase() ?? "";
  if (fromHandle && /^[a-z0-9._]{1,30}$/.test(fromHandle) && !isLikelyWebsiteDomain(fromHandle)) {
    return fromHandle;
  }
  const fromName = mention.name
    .replace(/^@/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "")
    .replace(/[^a-z0-9._]/g, "");
  if (fromName && /^[a-z0-9._]{1,30}$/.test(fromName) && !isLikelyWebsiteDomain(fromName)) {
    return fromName;
  }
  return null;
}

export function isKnownBrandDomain(name: string, handle?: string): boolean {
  for (const candidate of brandLabelCandidates(name, handle)) {
    const slug = slugifyBrand(candidate);
    if (slug && KNOWN_BRAND_DOMAINS[slug]) return true;
  }
  const rawHandle = handle?.replace(/^@/, "").trim().toLowerCase() ?? "";
  return isLikelyWebsiteDomain(rawHandle);
}

export function brandLogoUrl(mention: ClientBrandMention): string {
  const domain = brandDomainGuess(mention.name, mention.handle);
  return `https://logo.clearbit.com/${encodeURIComponent(domain)}`;
}

export function brandFaviconUrl(mention: ClientBrandMention): string {
  const domain = brandDomainGuess(mention.name, mention.handle);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

const KNOWN_BRAND_DOMAINS: Record<string, string> = {
  pepsi: "pepsi.com",
  nike: "nike.com",
  adidas: "adidas.com",
  samsung: "samsung.com",
  apple: "apple.com",
  starbucks: "starbucks.com",
  bmw: "bmw.com",
  sony: "sony.com",
  oreo: "oreo.com",
  pampers: "pampers.com",
  nestle: "nestle.com",
  loreal: "loreal.com",
  nivea: "nivea.com",
  dove: "dove.com",
  garnier: "garnier.com",
  vodafone: "vodafone.com",
  etisalat: "etisalat.ae",
  orange: "orange.com",
  cocacola: "coca-cola.com",
  coca: "coca-cola.com",
  xiaomi: "xiaomi.com",
  huawei: "huawei.com",
  oppo: "oppo.com",
  vivo: "vivo.com",
  realme: "realme.com",
  oneplus: "oneplus.com",
};

const BRAND_PLACE_SUFFIXES = new Set([
  "egypt",
  "uae",
  "ksa",
  "saudi",
  "arabia",
  "emirates",
  "dubai",
  "cairo",
  "qatar",
  "kuwait",
  "bahrain",
  "oman",
  "jordan",
  "lebanon",
  "morocco",
  "tunisia",
  "algeria",
  "africa",
  "mena",
  "gcc",
  "uk",
  "usa",
  "official",
]);

export function brandDomainGuess(name: string, handle?: string): string {
  const rawHandle = handle?.replace(/^@/, "").trim().toLowerCase() ?? "";
  if (isLikelyWebsiteDomain(rawHandle)) return rawHandle.replace(/^www\./, "");

  for (const candidate of brandLabelCandidates(name, handle)) {
    const slug = slugifyBrand(candidate);
    if (slug && KNOWN_BRAND_DOMAINS[slug]) return KNOWN_BRAND_DOMAINS[slug];
  }

  const core = coreBrandLabel(name);
  const coreSlug = slugifyBrand(core);
  const fullSlug = slugifyBrand(name);
  if (coreSlug && coreSlug !== fullSlug && core.trim().split(/\s+/).length === 1) {
    return `${coreSlug}.com`;
  }
  if (rawHandle) {
    const handleSlug = slugifyBrand(rawHandle);
    return KNOWN_BRAND_DOMAINS[handleSlug] || `${handleSlug || coreSlug || "brand"}.com`;
  }
  return `${fullSlug || coreSlug || "brand"}.com`;
}

function brandLabelCandidates(name: string, handle?: string): string[] {
  const labels = [name, coreBrandLabel(name), name.trim().split(/[\s/_-]+/)[0] ?? "", handle ?? ""];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of labels) {
    const trimmed = label.replace(/^@/, "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function coreBrandLabel(name: string): string {
  const tokens = name.replace(/^@/, "").trim().split(/[\s/_-]+/).filter(Boolean);
  while (tokens.length > 1) {
    const last = slugifyBrand(tokens[tokens.length - 1] ?? "");
    if (!last || !BRAND_PLACE_SUFFIXES.has(last)) break;
    tokens.pop();
  }
  return tokens.join(" ");
}

function slugifyBrand(value: string): string {
  return value
    .replace(/^@/, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
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
