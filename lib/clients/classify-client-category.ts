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
    "airline",
    "aviation",
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
  // Marketing, advertising & media agencies
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
  ipg: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  havas: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  accenture: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "consulting_services" },
  deloitte: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "consulting_services" },

  // Retail & e-commerce
  amazon: { categorySlug: "retail_ecommerce", subcategorySlug: "online_marketplace" },
  noon: { categorySlug: "retail_ecommerce", subcategorySlug: "online_marketplace" },
  namshi: { categorySlug: "retail_ecommerce", subcategorySlug: "online_fashion_retailer" },
  jumia: { categorySlug: "retail_ecommerce", subcategorySlug: "online_marketplace" },
  carrefour: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  walmart: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  tesco: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  target: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  lulu: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "lulu hypermarket": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  aldi: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  lidl: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  spinneys: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  choithrams: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  metro: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  ikea: { categorySlug: "home_furniture", subcategorySlug: "home_furniture_interiors" },
  bestbuy: { categorySlug: "retail_ecommerce", subcategorySlug: "electronics_retail" },
  "best buy": { categorySlug: "retail_ecommerce", subcategorySlug: "electronics_retail" },
  sharaf: { categorySlug: "retail_ecommerce", subcategorySlug: "electronics_retail" },
  "sharaf dg": { categorySlug: "retail_ecommerce", subcategorySlug: "electronics_retail" },
  jarir: { categorySlug: "retail_ecommerce", subcategorySlug: "electronics_retail" },
  shein: { categorySlug: "retail_ecommerce", subcategorySlug: "online_fashion_retailer" },
  asos: { categorySlug: "retail_ecommerce", subcategorySlug: "online_fashion_retailer" },
  zalando: { categorySlug: "retail_ecommerce", subcategorySlug: "online_fashion_retailer" },

  // FMCG & food/beverage brands
  unilever: { categorySlug: "beauty_personal_care", subcategorySlug: "beauty_personal_care" },
  procter: { categorySlug: "beauty_personal_care", subcategorySlug: "beauty_personal_care" },
  "procter gamble": { categorySlug: "beauty_personal_care", subcategorySlug: "beauty_personal_care" },
  "procter & gamble": { categorySlug: "beauty_personal_care", subcategorySlug: "beauty_personal_care" },
  pg: { categorySlug: "beauty_personal_care", subcategorySlug: "beauty_personal_care" },
  "p&g": { categorySlug: "beauty_personal_care", subcategorySlug: "beauty_personal_care" },
  nestle: { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  nestlé: { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  "coca cola": { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  cocacola: { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  pepsi: { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  pepsico: { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  danone: { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  heinz: { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  kraft: { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  mondelez: { categorySlug: "retail_ecommerce", subcategorySlug: "food_snacks" },
  "johnson johnson": { categorySlug: "beauty_personal_care", subcategorySlug: "beauty_personal_care" },
  jnj: { categorySlug: "beauty_personal_care", subcategorySlug: "beauty_personal_care" },

  // Beauty & personal care
  loreal: { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  "l'oreal": { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  "estee lauder": { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  "estée lauder": { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  sephora: { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  maybelline: { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  nivea: { categorySlug: "beauty_personal_care", subcategorySlug: "skincare" },
  olay: { categorySlug: "beauty_personal_care", subcategorySlug: "skincare" },
  dove: { categorySlug: "beauty_personal_care", subcategorySlug: "beauty_personal_care" },
  mac: { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  "mac cosmetics": { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  garnier: { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  clinique: { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  chanel: { categorySlug: "beauty_personal_care", subcategorySlug: "fragrances" },
  dior: { categorySlug: "beauty_personal_care", subcategorySlug: "fragrances" },

  // Fashion & apparel
  nike: { categorySlug: "fashion_apparel", subcategorySlug: "sportswear" },
  adidas: { categorySlug: "fashion_apparel", subcategorySlug: "sportswear" },
  zara: { categorySlug: "fashion_apparel", subcategorySlug: "fashion" },
  hm: { categorySlug: "fashion_apparel", subcategorySlug: "fashion" },
  "h&m": { categorySlug: "fashion_apparel", subcategorySlug: "fashion" },
  gucci: { categorySlug: "fashion_apparel", subcategorySlug: "luxury_fashion" },
  prada: { categorySlug: "fashion_apparel", subcategorySlug: "luxury_fashion" },
  louisvuitton: { categorySlug: "fashion_apparel", subcategorySlug: "luxury_fashion" },
  "louis vuitton": { categorySlug: "fashion_apparel", subcategorySlug: "luxury_fashion" },
  puma: { categorySlug: "fashion_apparel", subcategorySlug: "sportswear" },
  underarmour: { categorySlug: "fashion_apparel", subcategorySlug: "sportswear" },
  "under armour": { categorySlug: "fashion_apparel", subcategorySlug: "sportswear" },
  uniqlo: { categorySlug: "fashion_apparel", subcategorySlug: "fashion" },
  mango: { categorySlug: "fashion_apparel", subcategorySlug: "fashion" },

  // Food & restaurant
  mcdonalds: { categorySlug: "retail_ecommerce", subcategorySlug: "food_restaurant" },
  "mcdonald's": { categorySlug: "retail_ecommerce", subcategorySlug: "food_restaurant" },
  starbucks: { categorySlug: "retail_ecommerce", subcategorySlug: "food_restaurant" },
  kfc: { categorySlug: "retail_ecommerce", subcategorySlug: "food_restaurant" },
  "burger king": { categorySlug: "retail_ecommerce", subcategorySlug: "food_restaurant" },
  subway: { categorySlug: "retail_ecommerce", subcategorySlug: "food_restaurant" },
  "pizza hut": { categorySlug: "retail_ecommerce", subcategorySlug: "food_restaurant" },
  dominos: { categorySlug: "retail_ecommerce", subcategorySlug: "food_restaurant" },
  "domino's": { categorySlug: "retail_ecommerce", subcategorySlug: "food_restaurant" },
  costa: { categorySlug: "retail_ecommerce", subcategorySlug: "food_restaurant" },
  "costa coffee": { categorySlug: "retail_ecommerce", subcategorySlug: "food_restaurant" },

  // Automotive (mapped to retail general merchandise — no dedicated auto category)
  toyota: { categorySlug: "retail_ecommerce", subcategorySlug: "general_trading" },
  bmw: { categorySlug: "retail_ecommerce", subcategorySlug: "general_trading" },
  mercedes: { categorySlug: "retail_ecommerce", subcategorySlug: "general_trading" },
  "mercedes benz": { categorySlug: "retail_ecommerce", subcategorySlug: "general_trading" },
  ford: { categorySlug: "retail_ecommerce", subcategorySlug: "general_trading" },
  honda: { categorySlug: "retail_ecommerce", subcategorySlug: "general_trading" },
  nissan: { categorySlug: "retail_ecommerce", subcategorySlug: "general_trading" },
  audi: { categorySlug: "retail_ecommerce", subcategorySlug: "general_trading" },
  volkswagen: { categorySlug: "retail_ecommerce", subcategorySlug: "general_trading" },
  hyundai: { categorySlug: "retail_ecommerce", subcategorySlug: "general_trading" },

  // Telecommunications
  stc: { categorySlug: "telecommunications", subcategorySlug: "mobile_technology" },
  etisalat: { categorySlug: "telecommunications", subcategorySlug: "mobile_technology" },
  vodafone: { categorySlug: "telecommunications", subcategorySlug: "mobile_technology" },
  orange: { categorySlug: "telecommunications", subcategorySlug: "mobile_technology" },
  du: { categorySlug: "telecommunications", subcategorySlug: "mobile_technology" },
  ooredoo: { categorySlug: "telecommunications", subcategorySlug: "mobile_technology" },
  zain: { categorySlug: "telecommunications", subcategorySlug: "mobile_technology" },
  "virgin mobile": { categorySlug: "telecommunications", subcategorySlug: "mobile_technology" },

  // Financial services & banking
  hsbc: { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  citi: { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  citibank: { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  adcb: { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  "emirates nbd": { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  enbd: { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  fab: { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  "standard chartered": { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  barclays: { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  chase: { categorySlug: "financial_services_banking", subcategorySlug: "banking" },

  // Transportation & delivery
  careem: { categorySlug: "transportation_delivery", subcategorySlug: "ride_hailing_app" },
  uber: { categorySlug: "transportation_delivery", subcategorySlug: "ride_hailing_app" },
  talabat: { categorySlug: "transportation_delivery", subcategorySlug: "delivery_services" },
  deliveroo: { categorySlug: "transportation_delivery", subcategorySlug: "delivery_services" },
  emirates: { categorySlug: "transportation_delivery", subcategorySlug: "transportation_app" },
  etihad: { categorySlug: "transportation_delivery", subcategorySlug: "transportation_app" },
  qatarairways: { categorySlug: "transportation_delivery", subcategorySlug: "transportation_app" },
  "qatar airways": { categorySlug: "transportation_delivery", subcategorySlug: "transportation_app" },
  fedex: { categorySlug: "transportation_delivery", subcategorySlug: "delivery_services" },
  dhl: { categorySlug: "transportation_delivery", subcategorySlug: "delivery_services" },

  // Healthcare & wellness
  pfizer: { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_products" },
  novartis: { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_products" },
  roche: { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_products" },
  gsk: { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_products" },
  astrazeneca: { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_products" },

  // Home & furniture
  homecentre: { categorySlug: "home_furniture", subcategorySlug: "home_furniture_interiors" },
  "home centre": { categorySlug: "home_furniture", subcategorySlug: "home_furniture_interiors" },
  potterbarn: { categorySlug: "home_furniture", subcategorySlug: "home_furniture_interiors" },
  "pottery barn": { categorySlug: "home_furniture", subcategorySlug: "home_furniture_interiors" },

  // Government, sports & nonprofit
  fifa: { categorySlug: "government_sports_nonprofit", subcategorySlug: "sports_federations_leagues" },
  uefa: { categorySlug: "government_sports_nonprofit", subcategorySlug: "sports_federations_leagues" },
  olympic: { categorySlug: "government_sports_nonprofit", subcategorySlug: "national_olympic_sports_committees" },
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

const MIN_RANK_SCORE = 1;

const TAXONOMY_SUBCATEGORY_KEYWORDS: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const category of CLIENT_CATEGORY_TAXONOMY) {
    for (const subcategory of category.subcategories) {
      const words = subcategory.label
        .toLowerCase()
        .replace(/[^a-z0-9\s&+-]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 2);
      map[subcategory.slug] = [...new Set(words)];
    }
  }
  return map;
})();

function hasWebSearchApiKey(): boolean {
  return Boolean(
    process.env.SERPER_API_KEY?.trim() ||
      process.env.BRAVE_SEARCH_API_KEY?.trim() ||
      process.env.TAVILY_API_KEY?.trim()
  );
}

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
  const subcategoryKeywords = TAXONOMY_SUBCATEGORY_KEYWORDS[subcategorySlug] ?? [];

  for (const token of labelTokens) {
    if (tokens.has(token)) {
      score += 4;
    }
    if (corpus.includes(token)) {
      score += 2;
    }
  }

  for (const keyword of [...categoryKeywords, ...subcategoryKeywords]) {
    const normalizedKeyword = keyword.toLowerCase();
    if (corpus.includes(normalizedKeyword)) {
      score += 2;
    }
    const keywordToken = normalizedKeyword.replace(/[^a-z0-9]/g, "");
    if (keywordToken.length > 2 && tokens.has(keywordToken)) {
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

function hintMatchesName(name: string, compact: string, key: string): boolean {
  const keyCompact = key.replace(/\s+/g, "");
  if (name === key || compact === keyCompact) {
    return true;
  }

  if (key.length < 4) {
    return false;
  }

  const wordBoundary = new RegExp(`(?:^|\\s)${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`);
  if (wordBoundary.test(name)) {
    return true;
  }

  return name.includes(key) || compact.includes(keyCompact);
}

function matchCompanyHint(companyName: string): ClientCategoryClassification | null {
  for (const name of companyNameVariants(companyName)) {
    const compact = name.replace(/\s+/g, "");
    const tokens = name.split(" ").filter(Boolean);

    const directHint = hintFromKey(name) ?? hintFromKey(compact);
    if (directHint) {
      return directHint;
    }

    for (const token of tokens) {
      const hint = hintFromKey(token);
      if (hint) {
        return hint;
      }
    }

    for (let n = Math.min(4, tokens.length); n >= 1; n--) {
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
      if (hintMatchesName(name, compact, key)) {
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

  const nameVariants = companyNameVariants(companyName);
  const query = buildCompanySearchQuery(companyName, input.country, input.website);
  const web =
    hasWebSearchApiKey() ? await searchCompanyOnWeb(query) : { snippets: [], source: "none" as const };

  const webCorpus = web.snippets.join(" ");
  const webHint = webCorpus ? matchCompanyHint(`${companyName} ${webCorpus}`) : null;
  if (webHint) {
    return {
      ...webHint,
      confidence: webHint.confidence === "high" ? "high" : "medium",
      source: "web_search",
    };
  }

  const corpus = [...nameVariants, companyName, ...web.snippets].join(" ").toLowerCase();
  const ranked = rankCandidates(corpus);

  if (!ranked) {
    for (const variant of nameVariants) {
      const nameOnly = rankCandidates(variant);
      if (nameOnly) {
        return {
          categorySlug: nameOnly.categorySlug,
          subcategorySlug: nameOnly.subcategorySlug,
          confidence: confidenceFromScore(nameOnly.score, web.source !== "none"),
          source: web.source === "none" ? "keyword" : "web_search",
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
