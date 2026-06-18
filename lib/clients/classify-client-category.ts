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
  "group m": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_investment_management" },
  wavemaker: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  essence: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  hogarth: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_production" },
  kantar: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "consulting_services" },
  landor: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "creative_agency" },
  mullenlowe: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  "mullen lowe": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  vmly: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "creative_agency" },
  "wpp media": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
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

const LEGAL_SUFFIX_TOKENS = new Set([
  "ltd",
  "limited",
  "llc",
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "plc",
  "gmbh",
  "bv",
  "sa",
  "ag",
  "nv",
  "lp",
  "llp",
  "co",
  "company",
  "pty",
  "pte",
  "srl",
  "spa",
  "ab",
  "as",
  "kg",
]);

const REGIONAL_SUFFIX_TOKENS = new Set([
  "egypt",
  "uae",
  "ksa",
  "qatar",
  "kuwait",
  "bahrain",
  "oman",
  "jordan",
  "lebanon",
  "morocco",
  "tunisia",
  "algeria",
  "emirates",
]);

const MIN_RANK_SCORE = 2;

const SORTED_COMPANY_HINTS = Object.entries(COMPANY_HINTS).sort(
  (a, b) => b[0].length - a[0].length
);

function normalizeCompanyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLegalSuffixes(name: string): string {
  const tokens = name.split(" ").filter(Boolean);
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1]!;
    if (LEGAL_SUFFIX_TOKENS.has(last) || REGIONAL_SUFFIX_TOKENS.has(last)) {
      tokens.pop();
      continue;
    }
    break;
  }
  return tokens.join(" ");
}

function companyNameVariants(companyName: string): string[] {
  const normalized = normalizeCompanyKey(companyName);
  const stripped = stripLegalSuffixes(normalized);
  return [...new Set([normalized, stripped].filter(Boolean))];
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

  if (!best || best.score < MIN_RANK_SCORE) {
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

function hintFromKey(key: string): ClientCategoryClassification | null {
  const hint = COMPANY_HINTS[key];
  if (!hint) {
    return null;
  }
  return {
    ...hint,
    confidence: "high",
    source: "keyword",
  };
}

function matchCompanyHint(companyName: string): ClientCategoryClassification | null {
  for (const name of companyNameVariants(companyName)) {
    const compact = name.replace(/\s+/g, "");
    const tokens = name.split(" ").filter(Boolean);

    for (const token of tokens) {
      const hint = hintFromKey(token);
      if (hint) {
        return hint;
      }
    }

    for (let n = Math.min(3, tokens.length); n >= 1; n--) {
      for (let i = 0; i <= tokens.length - n; i++) {
        const phrase = tokens.slice(i, i + n).join(" ");
        const phraseCompact = tokens.slice(i, i + n).join("");
        const hint = hintFromKey(phrase) ?? hintFromKey(phraseCompact);
        if (hint) {
          return hint;
        }
      }
    }

    for (const [key, hint] of SORTED_COMPANY_HINTS) {
      const keyCompact = key.replace(/\s+/g, "");
      if (
        name.includes(key) ||
        compact.includes(keyCompact) ||
        (keyCompact.length >= 4 && compact.includes(keyCompact))
      ) {
        return {
          ...hint,
          confidence: "high",
          source: "keyword",
        };
      }
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
  const nameVariants = companyNameVariants(companyName);
  const corpus = [...nameVariants, companyName, ...web.snippets].join(" ").toLowerCase();
  const ranked = rankCandidates(corpus);

  if (!ranked) {
    for (const variant of nameVariants) {
      const nameOnly = rankCandidates(variant);
      if (nameOnly) {
        return {
          categorySlug: nameOnly.categorySlug,
          subcategorySlug: nameOnly.subcategorySlug,
          confidence: confidenceFromScore(nameOnly.score, false),
          source: "keyword",
        };
      }
    }
    return null;
  }

  return {
    categorySlug: ranked.categorySlug,
    subcategorySlug: ranked.subcategorySlug,
    confidence: confidenceFromScore(ranked.score, web.source !== "none"),
    source: web.source === "none" ? "keyword" : "web_search",
  };
}
