import {
  CLIENT_CATEGORY_TAXONOMY,
  tokenizeForMatching,
  type ClientCategoryTaxonomyEntry,
} from "@/lib/clients/client-category-taxonomy";
import {
  buildCompanySearchQuery,
  searchCompanyOnWeb,
} from "@/lib/clients/company-web-search";

export type ClientCategoryClassification = {
  categorySlug: string;
  subcategorySlug: string;
  confidence: "high" | "medium" | "low";
  source: "web_search" | "keyword";
};

type ScoredCandidate = {
  categorySlug: string;
  subcategorySlug: string;
  score: number;
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  marketing_advertising_media_agencies: [
    "agency",
    "advertising",
    "marketing",
    "media",
    "creative",
    "digital",
    "communications",
    "pr",
    "production",
    "consulting",
    "crm",
    "software",
    "platform",
    "social",
    "podcast",
    "branding",
    "events",
  ],
  retail_ecommerce: [
    "retail",
    "store",
    "shop",
    "ecommerce",
    "e-commerce",
    "marketplace",
    "franchise",
    "trading",
    "merchandise",
    "supermarket",
    "mall",
    "grocery",
    "restaurant",
    "food",
    "beverage",
    "jewelry",
    "electronics",
    "furniture",
    "lifestyle",
  ],
  beauty_personal_care: [
    "beauty",
    "cosmetic",
    "skincare",
    "fragrance",
    "perfume",
    "makeup",
    "personal care",
    "oral",
    "toothpaste",
    "loreal",
    "l'oreal",
    "maybelline",
    "nivea",
  ],
  fashion_apparel: [
    "fashion",
    "apparel",
    "clothing",
    "footwear",
    "shoes",
    "sportswear",
    "luxury",
    "couture",
    "wear",
    "nike",
    "adidas",
    "zara",
    "h&m",
  ],
  healthcare_wellness: [
    "health",
    "healthcare",
    "wellness",
    "medical",
    "hospital",
    "clinic",
    "pharma",
    "pharmaceutical",
    "medicine",
  ],
  financial_services_banking: [
    "bank",
    "banking",
    "finance",
    "financial",
    "insurance",
    "investment",
    "accounting",
    "fintech",
    "capital",
    "holding",
  ],
  pet_animal_products: ["pet", "animal", "veterinary", "paws"],
  transportation_delivery: [
    "transport",
    "transportation",
    "delivery",
    "logistics",
    "courier",
    "ride",
    "hailing",
    "mobility",
    "uber",
    "careem",
    "talabat",
    "noon",
  ],
  home_furniture: [
    "furniture",
    "interior",
    "home",
    "contracting",
    "construction",
    "real estate",
    "property",
    "developer",
    "ikea",
  ],
  telecommunications: [
    "telecom",
    "telecommunications",
    "mobile",
    "esim",
    "network",
    "carrier",
    "etisalat",
    "stc",
    "vodafone",
  ],
  government_sports_nonprofit: [
    "government",
    "authority",
    "ministry",
    "municipality",
    "ngo",
    "nonprofit",
    "non-profit",
    "foundation",
    "olympic",
    "sports",
    "federation",
    "league",
    "university",
    "school",
    "education",
  ],
};

const COMPANY_HINTS: Record<string, { categorySlug: string; subcategorySlug: string }> = {
  google: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "technology_software" },
  meta: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "social_media_platform" },
  facebook: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "social_media_platform" },
  instagram: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "social_media_platform" },
  tiktok: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "social_media_platform" },
  snap: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "social_media_platform" },
  omnicom: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  wpp: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  mindshare: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  "mind share": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  mediacom: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  groupm: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_investment_management" },
  publicis: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  dentsu: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  nike: { categorySlug: "fashion_apparel", subcategorySlug: "sportswear" },
  adidas: { categorySlug: "fashion_apparel", subcategorySlug: "sportswear" },
  loreal: { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  "l'oreal": { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  unilever: { categorySlug: "beauty_personal_care", subcategorySlug: "beauty_personal_care" },
  amazon: { categorySlug: "retail_ecommerce", subcategorySlug: "online_marketplace" },
  noon: { categorySlug: "retail_ecommerce", subcategorySlug: "online_marketplace" },
  namshi: { categorySlug: "retail_ecommerce", subcategorySlug: "online_fashion_retailer" },
  careem: { categorySlug: "transportation_delivery", subcategorySlug: "ride_hailing_app" },
  uber: { categorySlug: "transportation_delivery", subcategorySlug: "ride_hailing_app" },
  talabat: { categorySlug: "transportation_delivery", subcategorySlug: "delivery_services" },
  stc: { categorySlug: "telecommunications", subcategorySlug: "mobile_technology" },
  etisalat: { categorySlug: "telecommunications", subcategorySlug: "mobile_technology" },
  emirates: { categorySlug: "transportation_delivery", subcategorySlug: "transportation_app" },
  ikea: { categorySlug: "home_furniture", subcategorySlug: "home_furniture_interiors" },
};

function normalizeCompanyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreSubcategory(
  category: ClientCategoryTaxonomyEntry,
  subcategoryLabel: string,
  subcategorySlug: string,
  corpus: string,
  tokens: Set<string>
): number {
  let score = 0;
  const labelTokens = tokenizeForMatching(subcategoryLabel);
  const categoryKeywords = CATEGORY_KEYWORDS[category.slug] ?? [];

  for (const token of labelTokens) {
    if (tokens.has(token)) {
      score += 4;
    }
    if (corpus.includes(token)) {
      score += 2;
    }
  }

  for (const keyword of categoryKeywords) {
    const normalizedKeyword = keyword.toLowerCase();
    if (corpus.includes(normalizedKeyword)) {
      score += 2;
    }
    if (tokens.has(normalizedKeyword.replace(/[^a-z0-9]/g, ""))) {
      score += 1;
    }
  }

  if (corpus.includes(subcategoryLabel.toLowerCase())) {
    score += 8;
  }

  return score;
}

function rankCandidates(corpus: string): ScoredCandidate | null {
  const tokens = new Set(tokenizeForMatching(corpus));
  let best: ScoredCandidate | null = null;

  for (const category of CLIENT_CATEGORY_TAXONOMY) {
    for (const subcategory of category.subcategories) {
      const score = scoreSubcategory(
        category,
        subcategory.label,
        subcategory.slug,
        corpus,
        tokens
      );
      if (!best || score > best.score) {
        best = {
          categorySlug: category.slug,
          subcategorySlug: subcategory.slug,
          score,
        };
      }
    }
  }

  if (!best || best.score < 3) {
    return null;
  }

  return best;
}

function confidenceFromScore(score: number, usedWebSearch: boolean): ClientCategoryClassification["confidence"] {
  if (score >= 12) {
    return "high";
  }
  if (score >= 6 || usedWebSearch) {
    return "medium";
  }
  return "low";
}

function matchCompanyHint(companyName: string): ClientCategoryClassification | null {
  const normalized = normalizeCompanyKey(companyName);
  const compact = normalized.replace(/\s+/g, "");
  const tokens = normalized.split(" ").filter(Boolean);

  for (const token of tokens) {
    const hint = COMPANY_HINTS[token];
    if (hint) {
      return {
        ...hint,
        confidence: "high",
        source: "keyword",
      };
    }
  }

  for (const [key, hint] of Object.entries(COMPANY_HINTS)) {
    const keyCompact = key.replace(/\s+/g, "");
    if (
      normalized.includes(key) ||
      compact.includes(keyCompact) ||
      keyCompact.length >= 4 && compact.includes(keyCompact)
    ) {
      return {
        ...hint,
        confidence: "high",
        source: "keyword",
      };
    }
  }

  return null;
}

export async function classifyClientCategory(input: {
  name: string;
  country?: string | null;
  website?: string | null;
}): Promise<ClientCategoryClassification | null> {
  const companyName = input.name.trim();
  if (companyName.length < 2) {
    return null;
  }

  const hint = matchCompanyHint(companyName);
  if (hint) {
    return hint;
  }

  const query = buildCompanySearchQuery(companyName, input.country, input.website);
  const web = await searchCompanyOnWeb(query);
  const corpus = [companyName, ...web.snippets].join(" ").toLowerCase();
  const ranked = rankCandidates(corpus);

  if (!ranked) {
    const nameOnly = rankCandidates(companyName.toLowerCase());
    if (!nameOnly) {
      return null;
    }
    return {
      categorySlug: nameOnly.categorySlug,
      subcategorySlug: nameOnly.subcategorySlug,
      confidence: confidenceFromScore(nameOnly.score, false),
      source: "keyword",
    };
  }

  return {
    categorySlug: ranked.categorySlug,
    subcategorySlug: ranked.subcategorySlug,
    confidence: confidenceFromScore(ranked.score, web.source !== "none"),
    source: web.source === "none" ? "keyword" : "web_search",
  };
}
