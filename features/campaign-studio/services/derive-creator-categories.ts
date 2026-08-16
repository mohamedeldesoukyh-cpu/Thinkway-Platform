import {
  resolveCanonicalCategory,
  resolveCanonicalCategories,
} from "@/lib/creator-intelligence/taxonomy";

/**
 * Creator categories are Discovery content verticals (Sports, Lifestyle, …).
 * Client / brand industry (Finance, Banking, Telecom) is commercial context —
 * it is never a creator-search category unless the brief explicitly asks for
 * finance educators.
 */

const CLIENT_INDUSTRY_CATEGORY_PATTERN =
  /^(finance(\s*&\s*banking)?|banking|bank|fintech|insurance|wealth|telecom(munications)?)$/i;

export function isClientIndustryCategory(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (resolveCanonicalCategory(trimmed)) return false;
  return CLIENT_INDUSTRY_CATEGORY_PATTERN.test(trimmed);
}

export function wantsFinanceEducatorCreators(text: string): boolean {
  return /\b(finance educator|personal finance|finfluencer|money tips|investment influencer|wealth (creator|influencer)|linkedin thought leadership)\b/i.test(
    text
  );
}

/**
 * Mass-reach creator strategy: analog sports/entertainment mix, or an explicit
 * mass audience — not merely the word "awareness" on a product brief.
 */
export function isMassAwarenessCreatorBrief(text: string): boolean {
  if (!text.trim() || wantsFinanceEducatorCreators(text)) return false;
  if (/\b(la\s*liga|laliga|premier league|\buefa\b|world cup|sports?\s+event|football event)\b/i.test(text)) {
    return true;
  }
  if (/\bstrong mix\b/i.test(text) || /\bsimilar approach\b/i.test(text)) {
    return true;
  }
  return /\bmass\s+(audience|market|reach|awareness)\b/i.test(text);
}

export type CreatorCategorySource = {
  briefText?: string;
  objective?: string;
  audience?: string;
  campaignName?: string;
  products?: string[];
  existingCategories?: string[];
};

export function collectCreatorCategorySourceText(input: CreatorCategorySource): string {
  return [
    input.briefText,
    input.objective,
    input.audience,
    input.campaignName,
    ...(input.products ?? []),
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join("\n");
}

function addCanonical(target: string[], label: string): void {
  const canonical = resolveCanonicalCategory(label);
  if (!canonical || target.includes(canonical)) return;
  target.push(canonical);
}

function keptExistingCategories(existing: string[] | undefined): string[] {
  return resolveCanonicalCategories(
    (existing ?? []).filter((value) => !isClientIndustryCategory(value))
  );
}

/**
 * Derive Discovery creator categories from brief requirements and analog
 * strategy — never from client industry.
 */
export function deriveCreatorCategoriesFromBrief(input: CreatorCategorySource): string[] {
  const text = collectCreatorCategorySourceText(input);
  const kept = keptExistingCategories(input.existingCategories);
  const inferred: string[] = [];

  if (/\b(la\s*liga|laliga|premier league|\buefa\b|world cup|football|soccer|sports?\s+event|sports?\s+mix)\b/i.test(text)) {
    addCanonical(inferred, "Sports");
  }
  if (/\b(beauty|skincare|makeup|cosmetics|dermatolog)\b/i.test(text)) {
    addCanonical(inferred, "Beauty");
  }
  if (/\b(fashion|apparel|clothing|streetwear)\b/i.test(text)) {
    addCanonical(inferred, "Fashion");
  }
  if (/\b(fitness|gym|workout)\b/i.test(text)) {
    addCanonical(inferred, "Fitness");
  }
  if (/\b(travel|tourism|destination|hospitality)\b/i.test(text)) {
    addCanonical(inferred, "Travel");
  }
  if (/\b(gaming|gamer|esports)\b/i.test(text)) {
    addCanonical(inferred, "Gaming");
  }
  if (/\b(parenting|moms?|mums?|family)\b/i.test(text)) {
    addCanonical(inferred, "Parenting");
  }
  if (/\b(comedy|entertainment|music)\b/i.test(text)) {
    addCanonical(inferred, "Entertainment");
  }

  if (isMassAwarenessCreatorBrief(text)) {
    addCanonical(inferred, "Lifestyle");
    addCanonical(inferred, "Entertainment");
    if (/\b(la\s*liga|laliga|premier league|football|soccer|sports?)\b/i.test(text)) {
      addCanonical(inferred, "Sports");
    }
  }

  if (wantsFinanceEducatorCreators(text)) {
    addCanonical(inferred, "Lifestyle");
    addCanonical(inferred, "Tech");
  }

  const preferredOrder = ["Sports", "Lifestyle", "Entertainment", "Beauty", "Fashion", "Fitness", "Travel", "Gaming", "Parenting", "Tech"];
  const merged = [...new Set([...inferred, ...kept])];
  if (merged.length === 0) return [];

  return [...merged].sort((left, right) => {
    const leftRank = preferredOrder.indexOf(left);
    const rightRank = preferredOrder.indexOf(right);
    return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank);
  });
}
