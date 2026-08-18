import type { CreatorIntelligenceBundle } from "@/lib/enterprise-creator-intelligence";

import type { ClientContentCategory } from "./types";

const BLOCKED_LABEL =
  /^(other|unknown|general|n\/a|na|none|can't|cant|null|undefined|misc|miscellaneous)$/i;

export type CategoryFamily =
  | "lifestyle"
  | "fitness"
  | "health"
  | "food"
  | "photography"
  | "fashion"
  | "beauty"
  | "travel"
  | "tech"
  | "gaming"
  | "sports"
  | "family"
  | "auto"
  | "music"
  | "art"
  | "entertainment"
  | "education"
  | "business"
  | "pets"
  | "other";

const FAMILY_THEME: Record<CategoryFamily, { bg: string; color: string }> = {
  lifestyle: { bg: "#eef2ff", color: "#4338ca" },
  fitness: { bg: "#ecfdf5", color: "#047857" },
  health: { bg: "#f0fdf4", color: "#15803d" },
  food: { bg: "#fff7ed", color: "#c2410c" },
  photography: { bg: "#f5f3ff", color: "#6d28d9" },
  fashion: { bg: "#fdf2f8", color: "#be185d" },
  beauty: { bg: "#fdf4ff", color: "#a21caf" },
  travel: { bg: "#ecfeff", color: "#0e7490" },
  tech: { bg: "#eff6ff", color: "#1d4ed8" },
  gaming: { bg: "#f5f3ff", color: "#5b21b6" },
  sports: { bg: "#fefce8", color: "#a16207" },
  family: { bg: "#fff1f2", color: "#be123c" },
  auto: { bg: "#f8fafc", color: "#334155" },
  music: { bg: "#faf5ff", color: "#7e22ce" },
  art: { bg: "#fffbeb", color: "#b45309" },
  entertainment: { bg: "#eef2ff", color: "#3730a3" },
  education: { bg: "#f0f9ff", color: "#0369a1" },
  business: { bg: "#f1f5f9", color: "#0f172a" },
  pets: { bg: "#fef3c7", color: "#92400e" },
  other: { bg: "#eef2f7", color: "#334155" },
};

const OTHER_PALETTE = [
  { bg: "#e0e7ff", color: "#3730a3" },
  { bg: "#ccfbf1", color: "#0f766e" },
  { bg: "#ffe4e6", color: "#9f1239" },
  { bg: "#fef3c7", color: "#92400e" },
  { bg: "#dbeafe", color: "#1e40af" },
];

export function isDisplayableCategory(label: string): boolean {
  const trimmed = label.trim();
  if (trimmed.length < 3) return false;
  if (BLOCKED_LABEL.test(trimmed)) return false;
  if (/^[0-9]+$/.test(trimmed)) return false;
  return true;
}

export function contentCategoriesFromShares(
  shares?: Array<{ category: string; percent: number; postCount?: number }> | null
): ClientContentCategory[] {
  if (!shares?.length) return [];
  return shares
    .filter((share) => isDisplayableCategory(share.category) && Number.isFinite(share.percent) && share.percent > 0)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 6)
    .map((share) => ({
      label: share.category.trim(),
      percent: Math.round(share.percent),
      postCount:
        share.postCount != null && Number.isFinite(share.postCount) && share.postCount > 0
          ? share.postCount
          : undefined,
    }));
}

export function contentCategoriesFromBundle(
  bundle: CreatorIntelligenceBundle | null | undefined
): ClientContentCategory[] {
  return contentCategoriesFromShares(bundle?.categoryBrand.windows.lifetime.categories);
}

export function contentCategoriesForDisplay(
  rich?: ClientContentCategory[] | null,
  fallback?: Array<string | null | undefined> | null
): ClientContentCategory[] {
  if (rich?.some((item) => isDisplayableCategory(item.label))) {
    const seen = new Set<string>();
    const items: ClientContentCategory[] = [];
    for (const item of rich) {
      const label = item.label.trim();
      if (!isDisplayableCategory(label)) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        label,
        percent: finitePercent(item.percent),
        postCount: finiteCount(item.postCount),
      });
    }
    return items.slice(0, 6);
  }
  const seen = new Set<string>();
  const items: ClientContentCategory[] = [];
  for (const value of fallback ?? []) {
    const label = value?.trim() ?? "";
    if (!isDisplayableCategory(label)) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ label });
  }
  return items.slice(0, 6);
}

export function categoriesNeedRefresh(
  categories?: string[] | null,
  contentCategories?: ClientContentCategory[] | null
): boolean {
  if (!contentCategories?.length) return true;
  if ((categories ?? []).some((label) => !isDisplayableCategory(label))) return true;
  return false;
}

export function categoryFamily(label: string): CategoryFamily {
  const text = label.toLowerCase();
  if (/photo|camera|film|lens/.test(text)) return "photography";
  if (/yoga|wellness|health|meditat|nutrition/.test(text)) return "health";
  if (/fit|gym|workout/.test(text)) return "fitness";
  if (/food|cook|recipe|chef|kitchen/.test(text)) return "food";
  if (/fashion|style|ootd|outfit/.test(text)) return "fashion";
  if (/beauty|makeup|skin|cosmetic/.test(text)) return "beauty";
  if (/travel|tour|holiday/.test(text)) return "travel";
  if (/tech|gadget|software/.test(text)) return "tech";
  if (/game|gaming|esport/.test(text)) return "gaming";
  if (/sport|football|athlete|soccer/.test(text)) return "sports";
  if (/parent|family|mom|mum|kid|baby/.test(text)) return "family";
  if (/car|auto|motor/.test(text)) return "auto";
  if (/music|dj|song/.test(text)) return "music";
  if (/\bart\b|design|creativ/.test(text)) return "art";
  if (/entertain|comedy|humor|humour/.test(text)) return "entertainment";
  if (/educat|learn|school/.test(text)) return "education";
  if (/business|financ|career/.test(text)) return "business";
  if (/pet|animal|dog|cat/.test(text)) return "pets";
  if (/life/.test(text)) return "lifestyle";
  return "other";
}

export function categoryTheme(label: string): { family: CategoryFamily; bg: string; color: string } {
  const family = categoryFamily(label);
  if (family !== "other") return { family, ...FAMILY_THEME[family] };
  const index = hashLabel(label) % OTHER_PALETTE.length;
  return { family, ...OTHER_PALETTE[index]! };
}

function finitePercent(value: number | undefined): number | undefined {
  return value != null && Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;
}

function finiteCount(value: number | undefined): number | undefined {
  return value != null && Number.isFinite(value) && value > 0 ? value : undefined;
}

function hashLabel(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
