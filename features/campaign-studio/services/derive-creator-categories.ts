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

/**
 * Intrinsic parenting-creator vocabulary. These name a creator vertical no
 * matter where they appear in a brief.
 */
const PARENTING_CREATOR_VOCABULARY =
  /\b(parenting|motherhood|maternity|moms?|mums?)\b/i;

/**
 * "family" only names a creator strategy when the brief ties it to creators or
 * content — "family creators", "creators for families". A brief whose AUDIENCE
 * merely includes families ("Egyptian tea drinkers, mainly young adults and
 * families") is describing who should see the campaign, not who should make it.
 *
 * Note this is deliberately stricter than CREATOR_CATEGORY_KEYWORDS, where
 * `family: "Parenting"` is correct: that map classifies a CREATOR from their own
 * bio and tags. Here we are reading a BRIEF, so audience prose must not become a
 * Discovery category filter.
 */
const FAMILY_CREATOR_STRATEGY =
  /\bfamil(?:y|ies)[\s-]+(?:creators?|influencers?|content|bloggers?|vloggers?|accounts?|niche|category|segment|focused)\b|\b(?:creators?|influencers?|bloggers?|vloggers?)\s+(?:for|in|targeting|covering)\s+(?:the\s+)?famil(?:y|ies)\b/i;

/** True when the brief asks for parenting/family CREATORS, not just a family audience. */
export function wantsParentingCreators(text: string): boolean {
  if (PARENTING_CREATOR_VOCABULARY.test(text)) return true;
  return FAMILY_CREATOR_STRATEGY.test(text);
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
  if (wantsParentingCreators(text)) {
    addCanonical(inferred, "Parenting");
  }
  if (/\b(comedy|entertainment|music)\b/i.test(text)) {
    addCanonical(inferred, "Entertainment");
  }
  if (
    /\b(food|beverage|drinks?|tea|coffee|juice|snacks?|cooking|recipes?|restaurants?|dining|culinary|fmcg\s+food)\b/i.test(
      text
    )
  ) {
    addCanonical(inferred, "Food");
  }
  if (/\b(automotive|cars?|vehicles?|motors?)\b/i.test(text)) {
    addCanonical(inferred, "Automotive");
  }
  if (/\b(wellness|wellbeing|well-being|nutrition|healthcare|health)\b/i.test(text)) {
    addCanonical(inferred, "Health & Wellness");
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

  const preferredOrder = ["Sports", "Lifestyle", "Entertainment", "Beauty", "Fashion", "Fitness", "Food", "Travel", "Gaming", "Parenting", "Health & Wellness", "Automotive", "Tech"];
  const merged = [...new Set([...inferred, ...kept])];
  if (merged.length === 0) return [];

  return [...merged].sort((left, right) => {
    const leftRank = preferredOrder.indexOf(left);
    const rightRank = preferredOrder.indexOf(right);
    return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank);
  });
}
