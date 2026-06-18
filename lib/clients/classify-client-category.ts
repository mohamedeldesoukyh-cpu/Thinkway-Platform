import {
  CLIENT_CATEGORY_TAXONOMY,
  tokenizeForMatching,
  type ClientCategoryTaxonomyEntry,
} from "@/lib/clients/client-category-taxonomy";
import {
  companyNameVariants,
  normalizeCompanyKey,
  stripLegalSuffixes,
} from "@/lib/clients/normalize-company-name";
import { GLOBAL_COMPANY_HINTS } from "@/lib/clients/company-hints-global";
import {
  classifyClientCategoryWithAi,
  hasOpenAiApiKey,
} from "@/lib/clients/classify-client-category-ai";
import {
  type ClientCategoryClassification,
  type HistoricalClassificationMatch,
  CLASSIFICATION_CONFIDENCE,
} from "@/lib/clients/classify-client-category-types";
import {
  gatherCompanyWebContext,
  hasWebSearchApiKey,
  type CompanyWebSearchContext,
} from "@/lib/clients/company-web-search";

export type { ClientCategoryClassification, ClientClassificationSource } from "@/lib/clients/classify-client-category-types";
export { classificationSourceLabel, isLowConfidenceClassification } from "@/lib/clients/classify-client-category-types";

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
    "fmcg",
    "cpg",
    "consumer goods",
    "consumer packaged",
    "household",
    "hygiene",
    "tissue",
    "paper",
    "diaper",
    "detergent",
    "restaurant",
    "food",
    "beverage",
    "jewelry",
    "electronics",
    "furniture",
    "lifestyle",
    "automotive",
    "automobile",
    "vehicle",
    "electric vehicle",
    "ev maker",
    "car manufacturer",
    "oem",
    "motor",
    "motors",
    "smartphone",
    "consumer electronics",
    "technology company",
    "tech company",
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
  food_beverage: ["food", "beverage", "restaurant", "dairy", "snacks", "fmcg", "cpg", "brewery"],
  travel_hospitality: ["hotel", "resort", "airline", "tourism", "travel", "hospitality", "booking"],
  automotive: ["automotive", "automobile", "vehicle", "car", "motor", "ev", "dealer"],
  real_estate: ["real estate", "property", "developer", "residential", "commercial property"],
  technology_software: ["software", "saas", "technology", "tech", "it services", "enterprise software"],
  education: ["education", "school", "university", "edtech", "training", "academy"],
  entertainment_media: ["entertainment", "streaming", "gaming", "film", "music", "media", "publishing"],
  other: ["other", "general", "uncategorized", "unknown"],
};

const REGIONAL_COMPANY_HINTS: Record<string, { categorySlug: string; subcategorySlug: string }> = {
  // MENA / GCC — FMCG, retail & food
  lulu: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "lulu hypermarket": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  spinneys: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  choithrams: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  metro: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  sharaf: { categorySlug: "retail_ecommerce", subcategorySlug: "electronics_retail" },
  "sharaf dg": { categorySlug: "retail_ecommerce", subcategorySlug: "electronics_retail" },
  jarir: { categorySlug: "retail_ecommerce", subcategorySlug: "electronics_retail" },
  "nuqul group": { categorySlug: "retail_ecommerce", subcategorySlug: "general_trading" },
  almarai: { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  savola: { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  "savola group": { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  bindawood: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "bin dawood": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  panda: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "panda retail": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  tamimi: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "tamimi markets": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  americana: { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  "americana group": { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  albaik: { categorySlug: "retail_ecommerce", subcategorySlug: "food_restaurant" },
  "al baik": { categorySlug: "retail_ecommerce", subcategorySlug: "food_restaurant" },
  danube: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "danube home": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  hyperone: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "hyper one": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  elaraby: { categorySlug: "retail_ecommerce", subcategorySlug: "electronics_retail" },
  "el araby": { categorySlug: "retail_ecommerce", subcategorySlug: "electronics_retail" },
  jumbo: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  seoudi: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "seoudi supermarket": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  kazyon: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "b tech": { categorySlug: "retail_ecommerce", subcategorySlug: "electronics_retail" },
  btech: { categorySlug: "retail_ecommerce", subcategorySlug: "electronics_retail" },
  majid: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "majid al futtaim": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  alshaya: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_franchise_operator" },
  "al shaya": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_franchise_operator" },
  landmark: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "landmark group": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  alghurair: { categorySlug: "retail_ecommerce", subcategorySlug: "general_trading" },
  "al ghurair": { categorySlug: "retail_ecommerce", subcategorySlug: "general_trading" },
  iffco: { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  hayat: { categorySlug: "beauty_personal_care", subcategorySlug: "beauty_personal_care" },
  "hayat kimya": { categorySlug: "beauty_personal_care", subcategorySlug: "beauty_personal_care" },

  // MENA — agencies & media
  mcn: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  "middle east communications network": {
    categorySlug: "marketing_advertising_media_agencies",
    subcategorySlug: "media_agency",
  },
  "middle east communications": {
    categorySlug: "marketing_advertising_media_agencies",
    subcategorySlug: "media_agency",
  },
  "ipg mediabrands": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  mediabrands: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  starcom: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  zenith: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  "um mena": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  choueiri: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  "choueiri group": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  memac: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  "memac ogilvy": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  impactbbdo: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  "impact bbdo": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  jwt: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  leo: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  "leo burnett": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  mccann: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  fp7: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  tpg: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },

  // Egypt — marketing, advertising & media agencies
  "fp7 cairo": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  tareknour: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  "tarek nour": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  "tarek nour communications": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  advantage: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  "advantage egypt": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  carat: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  "carat egypt": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  "mind share egypt": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  "um egypt": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  "um media": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  "havas cairo": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  ddb: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  "ddb egypt": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  "jwt cairo": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  "leo burnett egypt": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  "publicis egypt": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  "memac ogilvy egypt": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  "tbwa egypt": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  tbwa: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  "geometry egypt": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  "core media egypt": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  coremedia: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  "dot kinetics": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "digital_marketing" },
  dotkinetics: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "digital_marketing" },
  "tag agency": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "creative_agency" },
  "bold agency": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "creative_agency" },
  "promoseven": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  "promo seven": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_agency" },
  "dcm egypt": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  "media scene": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  mediascene: { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "media_agency" },
  "seven communications": { categorySlug: "marketing_advertising_media_agencies", subcategorySlug: "advertising_public_relations" },

  // Egypt — retail & supermarkets
  "carrefour egypt": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "spinneys egypt": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "metro market": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  metromarket: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  fathalla: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "fathalla market": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  oscar: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "oscar supermarket": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  bim: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "bim supermarkets": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  khairzaman: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "khair zaman": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "saudi markets": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "saudi markets egypt": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "panda egypt": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "gourmet egypt": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "abu auf": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_food_products" },
  "abu auf stores": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_food_products" },
  "ragab sons": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "el ragab": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  sedra: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  gabeer: { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "kazyon egypt": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },
  "hyper one egypt": { categorySlug: "retail_ecommerce", subcategorySlug: "retail_general_merchandise" },

  // Egypt — FMCG & food/beverage
  juhayna: { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  "juhayna dairy": { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  domty: { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  "domty cheese": { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  edita: { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  "edita food": { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  beyti: { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  "beyti dairy": { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  obourland: { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  "obour land": { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  "p&g egypt": { categorySlug: "beauty_personal_care", subcategorySlug: "beauty_personal_care" },
  "unilever egypt": { categorySlug: "beauty_personal_care", subcategorySlug: "beauty_personal_care" },
  "nestle egypt": { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  "nestlé egypt": { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  "americana egypt": { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  "dina farms": { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  dinafarms: { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  lamar: { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  "lamar egypt": { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  elsabah: { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  "el sabah": { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  "charcuterie misr": { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  "heinz egypt": { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  "danone egypt": { categorySlug: "retail_ecommerce", subcategorySlug: "food_beverages" },
  "kellogg egypt": { categorySlug: "retail_ecommerce", subcategorySlug: "food_snacks" },
  "cadbury egypt": { categorySlug: "retail_ecommerce", subcategorySlug: "food_snacks" },

  // Egypt — beauty & personal care
  "eva cosmetics": { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  eva: { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  bioderma: { categorySlug: "beauty_personal_care", subcategorySlug: "skincare" },
  "bioderma egypt": { categorySlug: "beauty_personal_care", subcategorySlug: "skincare" },
  "loreal egypt": { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  "l'oreal egypt": { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  flair: { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  "flair egypt": { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  queens: { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  "queens cosmetics": { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  "alaa cosmetics": { categorySlug: "beauty_personal_care", subcategorySlug: "cosmetics" },
  "nefertari": { categorySlug: "beauty_personal_care", subcategorySlug: "natural_skincare" },
  "nefertari egypt": { categorySlug: "beauty_personal_care", subcategorySlug: "natural_skincare" },
  "sunsilk egypt": { categorySlug: "beauty_personal_care", subcategorySlug: "beauty_personal_care" },
  "clear egypt": { categorySlug: "beauty_personal_care", subcategorySlug: "beauty_personal_care" },

  // Egypt — fashion & apparel
  concrete: { categorySlug: "fashion_apparel", subcategorySlug: "fashion" },
  "concrete store": { categorySlug: "fashion_apparel", subcategorySlug: "fashion" },
  defacto: { categorySlug: "fashion_apparel", subcategorySlug: "fashion" },
  "de facto": { categorySlug: "fashion_apparel", subcategorySlug: "fashion" },
  "de facto egypt": { categorySlug: "fashion_apparel", subcategorySlug: "fashion" },
  "h&m egypt": { categorySlug: "fashion_apparel", subcategorySlug: "fashion" },
  "zara egypt": { categorySlug: "fashion_apparel", subcategorySlug: "fashion" },
  "lc waikiki": { categorySlug: "fashion_apparel", subcategorySlug: "fashion" },
  "lc waikiki egypt": { categorySlug: "fashion_apparel", subcategorySlug: "fashion" },
  "splash egypt": { categorySlug: "fashion_apparel", subcategorySlug: "fashion" },
  "max fashion": { categorySlug: "fashion_apparel", subcategorySlug: "fashion" },
  "max fashion egypt": { categorySlug: "fashion_apparel", subcategorySlug: "fashion" },
  mobaco: { categorySlug: "fashion_apparel", subcategorySlug: "fashion" },
  "mobaco cotton": { categorySlug: "fashion_apparel", subcategorySlug: "fashion" },
  "ramy hilal": { categorySlug: "fashion_apparel", subcategorySlug: "fashion_lifestyle" },
  "gogo fashion": { categorySlug: "fashion_apparel", subcategorySlug: "fashion" },

  // Egypt — healthcare & wellness
  eipico: { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_products" },
  memphis: { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_products" },
  "memphis pharmaceuticals": { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_products" },
  "novartis egypt": { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_products" },
  "gsk egypt": { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_products" },
  pharco: { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_products" },
  "pharco pharmaceuticals": { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_products" },
  sedico: { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_products" },
  amoun: { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_products" },
  "amoun pharmaceutical": { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_products" },
  "el nile pharma": { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_products" },
  "elnile pharma": { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_products" },
  "eipico pharma": { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_products" },
  "el ezaby": { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_services" },
  "el ezaby pharmacy": { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_services" },
  "seif pharmacies": { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_services" },
  "seif pharmacy": { categorySlug: "healthcare_wellness", subcategorySlug: "healthcare_services" },

  // Egypt — financial services & banking
  cib: { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  "commercial international bank": { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  nbe: { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  "national bank of egypt": { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  "banque misr": { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  "misr bank": { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  "qnb alahli": { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  qnbalahli: { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  alahli: { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  "alex bank": { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  "alexandria bank": { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  fawry: { categorySlug: "financial_services_banking", subcategorySlug: "financial_services" },
  "fawry egypt": { categorySlug: "financial_services_banking", subcategorySlug: "financial_services" },
  paymob: { categorySlug: "financial_services_banking", subcategorySlug: "financial_services" },
  "paymob egypt": { categorySlug: "financial_services_banking", subcategorySlug: "financial_services" },
  "banque du caire": { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  "arab african bank": { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  "credit agricole egypt": { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  "eg bank": { categorySlug: "financial_services_banking", subcategorySlug: "banking" },
  "contact financial": { categorySlug: "financial_services_banking", subcategorySlug: "financial_services" },

  // Egypt — pet & animal products
  petsland: { categorySlug: "pet_animal_products", subcategorySlug: "pet_retail_pet_products" },
  "pet's land": { categorySlug: "pet_animal_products", subcategorySlug: "pet_retail_pet_products" },
  "pets land": { categorySlug: "pet_animal_products", subcategorySlug: "pet_retail_pet_products" },
  "pet zone": { categorySlug: "pet_animal_products", subcategorySlug: "pet_retail_pet_products" },
  petzone: { categorySlug: "pet_animal_products", subcategorySlug: "pet_retail_pet_products" },
  "pet shop egypt": { categorySlug: "pet_animal_products", subcategorySlug: "pet_retail_pet_products" },
  "royal pets": { categorySlug: "pet_animal_products", subcategorySlug: "pet_retail_pet_products" },
  "mawad pet": { categorySlug: "pet_animal_products", subcategorySlug: "pet_retail_pet_products" },
  mawad: { categorySlug: "pet_animal_products", subcategorySlug: "pet_retail_pet_products" },
  "zoomaal pets": { categorySlug: "pet_animal_products", subcategorySlug: "pet_retail_pet_products" },
  "pet cover": { categorySlug: "pet_animal_products", subcategorySlug: "pet_retail_pet_products" },

  // Egypt — transportation & delivery
  swvl: { categorySlug: "transportation_delivery", subcategorySlug: "ride_hailing_app" },
  "swvl egypt": { categorySlug: "transportation_delivery", subcategorySlug: "ride_hailing_app" },
  halan: { categorySlug: "transportation_delivery", subcategorySlug: "ride_hailing_app" },
  "halan egypt": { categorySlug: "transportation_delivery", subcategorySlug: "ride_hailing_app" },
  "talabat egypt": { categorySlug: "transportation_delivery", subcategorySlug: "delivery_services" },
  rabbit: { categorySlug: "transportation_delivery", subcategorySlug: "delivery_ecommerce_platform" },
  "rabbit mart": { categorySlug: "transportation_delivery", subcategorySlug: "delivery_ecommerce_platform" },
  breadfast: { categorySlug: "transportation_delivery", subcategorySlug: "delivery_ecommerce_platform" },
  "breadfast egypt": { categorySlug: "transportation_delivery", subcategorySlug: "delivery_ecommerce_platform" },
  elmenus: { categorySlug: "transportation_delivery", subcategorySlug: "delivery_services" },
  "el menus": { categorySlug: "transportation_delivery", subcategorySlug: "delivery_services" },
  raneen: { categorySlug: "transportation_delivery", subcategorySlug: "delivery_ecommerce_platform" },
  "raneen egypt": { categorySlug: "transportation_delivery", subcategorySlug: "delivery_ecommerce_platform" },
  toters: { categorySlug: "transportation_delivery", subcategorySlug: "delivery_services" },
  "careem egypt": { categorySlug: "transportation_delivery", subcategorySlug: "ride_hailing_app" },
  mrsool: { categorySlug: "transportation_delivery", subcategorySlug: "delivery_services" },
  "mrsool egypt": { categorySlug: "transportation_delivery", subcategorySlug: "delivery_services" },

  // Egypt — home & furniture
  "ikea egypt": { categorySlug: "home_furniture", subcategorySlug: "home_furniture_interiors" },
  "home centre egypt": { categorySlug: "home_furniture", subcategorySlug: "home_furniture_interiors" },
  "el araby group": { categorySlug: "home_furniture", subcategorySlug: "home_furniture_interiors" },
  mobica: { categorySlug: "home_furniture", subcategorySlug: "home_furniture_interiors" },
  "mobica egypt": { categorySlug: "home_furniture", subcategorySlug: "home_furniture_interiors" },
  kodnani: { categorySlug: "home_furniture", subcategorySlug: "home_furniture_interiors" },
  "kodnani furniture": { categorySlug: "home_furniture", subcategorySlug: "home_furniture_interiors" },
  dorsea: { categorySlug: "home_furniture", subcategorySlug: "home_furniture_interiors" },
  "dorsea furniture": { categorySlug: "home_furniture", subcategorySlug: "home_furniture_interiors" },
  "nahdet misr furniture": { categorySlug: "home_furniture", subcategorySlug: "home_furniture_interiors" },
  "talaat mostafa": { categorySlug: "home_furniture", subcategorySlug: "luxury_real_estate_development" },
  "tmg holding": { categorySlug: "home_furniture", subcategorySlug: "luxury_real_estate_development" },

  // Egypt — telecommunications
  "vodafone egypt": { categorySlug: "telecommunications", subcategorySlug: "mobile_technology" },
  "orange egypt": { categorySlug: "telecommunications", subcategorySlug: "mobile_technology" },
  "etisalat egypt": { categorySlug: "telecommunications", subcategorySlug: "mobile_technology" },
  "telecom egypt": { categorySlug: "telecommunications", subcategorySlug: "mobile_technology" },
  telecomegypt: { categorySlug: "telecommunications", subcategorySlug: "mobile_technology" },
  "we egypt": { categorySlug: "telecommunications", subcategorySlug: "mobile_technology" },
  "vodafone cash": { categorySlug: "telecommunications", subcategorySlug: "mobile_technology" },

  // Egypt — government, sports & nonprofit
  "egyptian tourism authority": { categorySlug: "government_sports_nonprofit", subcategorySlug: "government_authorities" },
  eta: { categorySlug: "government_sports_nonprofit", subcategorySlug: "government_authorities" },
  egoth: { categorySlug: "government_sports_nonprofit", subcategorySlug: "government_authorities" },
  "al ahly": { categorySlug: "government_sports_nonprofit", subcategorySlug: "sports_federations_leagues" },
  alahly: { categorySlug: "government_sports_nonprofit", subcategorySlug: "sports_federations_leagues" },
  "al ahly sc": { categorySlug: "government_sports_nonprofit", subcategorySlug: "sports_federations_leagues" },
  zamalek: { categorySlug: "government_sports_nonprofit", subcategorySlug: "sports_federations_leagues" },
  "zamalek sc": { categorySlug: "government_sports_nonprofit", subcategorySlug: "sports_federations_leagues" },
  "egyptian football association": { categorySlug: "government_sports_nonprofit", subcategorySlug: "sports_federations_leagues" },
  efa: { categorySlug: "government_sports_nonprofit", subcategorySlug: "sports_federations_leagues" },
  "cairo university": { categorySlug: "government_sports_nonprofit", subcategorySlug: "educational_institutions" },
  aucegypt: { categorySlug: "government_sports_nonprofit", subcategorySlug: "educational_institutions" },
  "american university cairo": { categorySlug: "government_sports_nonprofit", subcategorySlug: "educational_institutions" },
  "ministry of tourism egypt": { categorySlug: "government_sports_nonprofit", subcategorySlug: "government_authorities" },
  "pyramids fc": { categorySlug: "government_sports_nonprofit", subcategorySlug: "sports_federations_leagues" },
  "national olympic committee egypt": { categorySlug: "government_sports_nonprofit", subcategorySlug: "national_olympic_sports_committees" },
};

const COMPANY_HINTS: Record<string, { categorySlug: string; subcategorySlug: string }> = {
  ...GLOBAL_COMPANY_HINTS,
  ...REGIONAL_COMPANY_HINTS,
};

export function getCompanyHintCount(): number {
  return Object.keys(COMPANY_HINTS).length;
}

const SHORT_HINT_KEYS = new Set(
  Object.keys(COMPANY_HINTS).filter((key) => key.replace(/\s+/g, "").length <= 3)
);

/** Subcategory label tokens like "network" must not match without required context. */
const SUBCATEGORY_REQUIRED_CORPUS_TERMS: Record<string, string[]> = {
  home_shopping_network: ["shopping"],
};

const MEDIA_AGENCY_CORPUS_TERMS = [
  "communications",
  "media",
  "advertising",
  "agency",
  "mediabrands",
  "creative",
  "marketing",
] as const;

const MIN_RANK_SCORE = 1;

const INDUSTRY_CORPUS_SIGNALS: Array<{
  terms: string[];
  categorySlug: string;
  subcategorySlug?: string;
  boost: number;
}> = [
  {
    terms: ["fmcg", "consumer goods", "consumer packaged", "cpg", "fast-moving consumer"],
    categorySlug: "retail_ecommerce",
    subcategorySlug: "general_trading",
    boost: 8,
  },
  {
    terms: ["retail", "supermarket", "hypermarket", "grocery store"],
    categorySlug: "retail_ecommerce",
    boost: 5,
  },
  {
    terms: ["advertising agency", "media agency", "marketing agency", "communications agency"],
    categorySlug: "marketing_advertising_media_agencies",
    boost: 6,
  },
  {
    terms: [
      "communications network",
      "media network",
      "communications group",
      "media group",
      "advertising group",
      "mediabrands",
    ],
    categorySlug: "marketing_advertising_media_agencies",
    subcategorySlug: "media_agency",
    boost: 10,
  },
  {
    terms: ["hygiene", "tissue", "paper products", "household products", "personal hygiene"],
    categorySlug: "retail_ecommerce",
    subcategorySlug: "general_trading",
    boost: 5,
  },
  {
    terms: [
      "automotive",
      "automobile",
      "car manufacturer",
      "vehicle manufacturer",
      "electric vehicle",
      "ev company",
      "auto maker",
      "oem",
    ],
    categorySlug: "retail_ecommerce",
    subcategorySlug: "general_trading",
    boost: 8,
  },
  {
    terms: [
      "consumer electronics",
      "smartphone",
      "technology company",
      "tech company",
      "software company",
      "computer hardware",
    ],
    categorySlug: "retail_ecommerce",
    subcategorySlug: "consumer_electronics",
    boost: 7,
  },
  {
    terms: ["online marketplace", "e-commerce platform", "ecommerce platform", "digital marketplace"],
    categorySlug: "retail_ecommerce",
    subcategorySlug: "online_marketplace",
    boost: 8,
  },
  {
    terms: ["investment bank", "commercial bank", "retail bank", "financial institution"],
    categorySlug: "financial_services_banking",
    boost: 6,
  },
  {
    terms: ["pharmaceutical", "biotech", "drug manufacturer", "healthcare company"],
    categorySlug: "healthcare_wellness",
    subcategorySlug: "healthcare_products",
    boost: 7,
  },
];

let webSearchKeyWarned = false;

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

const SORTED_COMPANY_HINTS = Object.entries(COMPANY_HINTS).sort(
  (a, b) => b[0].length - a[0].length
);

export { normalizeCompanyKey, stripLegalSuffixes, companyNameVariants };

function extractNameAcronyms(companyName: string): string[] {
  const acronyms: string[] = [];
  const tokens = companyName.trim().split(/\s+/);
  for (const token of tokens) {
    if (/^[A-Z]{2,6}$/.test(token)) {
      acronyms.push(token.toLowerCase());
    }
  }
  return acronyms;
}

function mediaAgencyNameBoost(corpus: string, candidate: ScoredCandidate): number {
  if (candidate.categorySlug !== "marketing_advertising_media_agencies") {
    return 0;
  }

  let boost = 0;
  const hasMediaTerm = MEDIA_AGENCY_CORPUS_TERMS.some((term) => corpus.includes(term));
  if (corpus.includes("communications")) {
    boost += 6;
  }
  if (corpus.includes("media") && (corpus.includes("group") || corpus.includes("network") || corpus.includes("agency"))) {
    boost += 5;
  }
  if (corpus.includes("advertising")) {
    boost += 4;
  }
  if (corpus.includes("network") && hasMediaTerm) {
    boost += 8;
  }
  return boost;
}

function scoreSubcategory(
  category: ClientCategoryTaxonomyEntry,
  subcategoryLabel: string,
  subcategorySlug: string,
  corpus: string,
  tokens: Set<string>
): number {
  const requiredTerms = SUBCATEGORY_REQUIRED_CORPUS_TERMS[subcategorySlug];
  if (requiredTerms && !requiredTerms.some((term) => corpus.includes(term))) {
    return 0;
  }

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

function industryBoostForCandidate(corpus: string, candidate: ScoredCandidate): number {
  let boost = 0;
  for (const signal of INDUSTRY_CORPUS_SIGNALS) {
    if (!signal.terms.some((term) => corpus.includes(term))) {
      continue;
    }
    if (candidate.categorySlug !== signal.categorySlug) {
      continue;
    }
    if (signal.subcategorySlug && candidate.subcategorySlug !== signal.subcategorySlug) {
      continue;
    }
    boost += signal.boost;
  }
  return boost;
}

function rankCandidates(corpus: string): ScoredCandidate | null {
  const tokens = new Set(tokenizeForMatching(corpus));
  let best: ScoredCandidate | null = null;

  for (const category of CLIENT_CATEGORY_TAXONOMY) {
    for (const subcategory of category.subcategories) {
      const candidate: ScoredCandidate = {
        categorySlug: category.slug,
        subcategorySlug: subcategory.slug,
        score: scoreSubcategory(
          category,
          subcategory.label,
          subcategory.slug,
          corpus,
          tokens
        ),
      };
      candidate.score += industryBoostForCandidate(corpus, candidate);
      candidate.score += mediaAgencyNameBoost(corpus, candidate);
      if (!best || candidate.score > best.score) {
        best = candidate;
      }
    }
  }

  if (!best || best.score < MIN_RANK_SCORE) {
    return null;
  }

  return best;
}

function confidenceFromScore(score: number, usedWebSearch: boolean): number {
  if (score >= 12) {
    return usedWebSearch ? 68 : 65;
  }
  if (score >= 6) {
    return usedWebSearch ? 62 : 58;
  }
  return usedWebSearch ? 55 : 50;
}

function ruleConfidenceForMatch(exact: boolean, partial: boolean): number {
  if (exact) {
    return 100;
  }
  if (partial) {
    return 96;
  }
  return 98;
}

function hintFromKey(key: string, matchQuality: "exact" | "partial" | "token"): ClientCategoryClassification | null {
  const hint = COMPANY_HINTS[key];
  if (!hint) {
    return null;
  }
  return {
    ...hint,
    confidence: ruleConfidenceForMatch(matchQuality === "exact", matchQuality === "partial"),
    source: "rule",
    reason: `Matched company rule: "${key}"`,
  };
}

function minHintMatchLength(key: string): number {
  const compact = key.replace(/\s+/g, "");
  return SHORT_HINT_KEYS.has(key) || compact.length <= 3 ? 3 : 4;
}

function hintMatchesName(name: string, compact: string, key: string): boolean {
  const keyCompact = key.replace(/\s+/g, "");
  const minLen = minHintMatchLength(key);
  if (name === key || compact === keyCompact) {
    return true;
  }

  if (key.length < minLen) {
    return false;
  }

  if (compact.length >= minLen && keyCompact.length >= minLen) {
    if (compact.startsWith(keyCompact) || keyCompact.startsWith(compact)) {
      return true;
    }
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

    const directHint =
      hintFromKey(name, "exact") ?? hintFromKey(compact, "exact");
    if (directHint) {
      return directHint;
    }

    for (const acronym of extractNameAcronyms(companyName)) {
      const hint = hintFromKey(acronym, "exact");
      if (hint) {
        return hint;
      }
    }

    for (const token of tokens) {
      const minLen = SHORT_HINT_KEYS.has(token) ? 3 : 4;
      if (token.length >= minLen) {
        const hint = hintFromKey(token, "token");
        if (hint) {
          return hint;
        }
      }
    }

    if (tokens.length === 1) {
      const single = tokens[0]!;
      const minLen = SHORT_HINT_KEYS.has(single) ? 3 : 4;
      if (single.length >= minLen) {
        for (const [key, hint] of SORTED_COMPANY_HINTS) {
          const keyCompact = key.replace(/\s+/g, "");
          const keyMinLen = minHintMatchLength(key);
          if (keyCompact.length < keyMinLen) {
            continue;
          }
          if (single.startsWith(keyCompact) || keyCompact.startsWith(single)) {
            return {
              ...hint,
              confidence: ruleConfidenceForMatch(single === keyCompact, true),
              source: "rule",
              reason: `Matched company rule: "${key}"`,
            };
          }
        }
      }
    }

    for (let n = Math.min(4, tokens.length); n >= 1; n--) {
      for (let i = 0; i <= tokens.length - n; i++) {
        const phrase = tokens.slice(i, i + n).join(" ");
        const phraseCompact = tokens.slice(i, i + n).join("");
        const hint =
          hintFromKey(phrase, "exact") ?? hintFromKey(phraseCompact, "exact");
        if (hint) {
          return hint;
        }
      }
    }

    for (const [key, hint] of SORTED_COMPANY_HINTS) {
      if (hintMatchesName(name, compact, key)) {
        const keyCompact = key.replace(/\s+/g, "");
        const exact = name === key || compact === keyCompact;
        return {
          ...hint,
          confidence: ruleConfidenceForMatch(exact, !exact),
          source: "rule",
          reason: `Matched company rule: "${key}"`,
        };
      }
    }
  }

  return null;
}

function classifyWithKeywordAndWeb(input: {
  companyName: string;
  keywordHint: ClientCategoryClassification | null;
  web: CompanyWebSearchContext;
}): ClientCategoryClassification | null {
  const { companyName, keywordHint, web } = input;
  const nameVariants = companyNameVariants(companyName);
  const webSearchAvailable = web.source !== "none";

  const webCorpus = [
    ...web.snippets,
    ...web.linkedInSnippets,
    ...web.companyDescriptions,
  ].join(" ");
  const webHint = webCorpus ? matchCompanyHint(`${companyName} ${webCorpus}`) : null;
  if (webHint) {
    return {
      ...webHint,
      source: "fallback",
      confidence: Math.min(webHint.confidence, CLASSIFICATION_CONFIDENCE.fallback.max),
      reason: webHint.reason ?? "Web corpus matched company rule",
    };
  }

  const corpus = [
    ...nameVariants,
    companyName,
    ...web.snippets,
    ...web.linkedInSnippets,
    ...web.companyDescriptions,
  ]
    .join(" ")
    .toLowerCase();
  let ranked = rankCandidates(corpus);

  if (!ranked && !webSearchAvailable) {
    for (const variant of nameVariants) {
      ranked = rankCandidates(variant);
      if (ranked) {
        break;
      }
    }
  }

  if (!ranked) {
    return keywordHint ?? null;
  }

  const confidence = confidenceFromScore(ranked.score, webSearchAvailable);

  if (
    keywordHint &&
    keywordHint.categorySlug === ranked.categorySlug &&
    keywordHint.subcategorySlug === ranked.subcategorySlug
  ) {
    return {
      ...keywordHint,
      confidence,
      source: "fallback",
      reason: "Keyword ranking aligned with partial rule match",
    };
  }

  return {
    categorySlug: ranked.categorySlug,
    subcategorySlug: ranked.subcategorySlug,
    confidence,
    source: "fallback",
    reason: webSearchAvailable
      ? "Keyword ranking from company name and web snippets"
      : "Keyword ranking from company name",
  };
}

function historicalToClassification(
  match: HistoricalClassificationMatch
): ClientCategoryClassification {
  return {
    categorySlug: match.categorySlug,
    subcategorySlug: match.subcategorySlug,
    confidence: match.confidence,
    source: "historical",
    reason: `Similar approved client: "${match.matchedName}"`,
  };
}

export function isClientCategoryAiAvailable(): boolean {
  return hasOpenAiApiKey();
}

export async function classifyClientCategory(input: {
  name: string;
  country?: string | null;
  website?: string | null;
  /** P1: stored approved classification for an existing client */
  approvedClassification?: ClientCategoryClassification | null;
  /** P3: pre-fetched historical match from similar clients */
  historicalMatch?: HistoricalClassificationMatch | null;
}): Promise<ClientCategoryClassification | null> {
  const companyName = input.name.trim();
  if (companyName.length < 2) {
    return null;
  }

  if (input.approvedClassification) {
    return {
      ...input.approvedClassification,
      source: "approved",
      confidence: CLASSIFICATION_CONFIDENCE.approved,
      reason: input.approvedClassification.reason ?? "Stored approved classification",
    };
  }

  const ruleMatch = matchCompanyHint(companyName);
  if (ruleMatch) {
    return ruleMatch;
  }

  if (input.historicalMatch) {
    return historicalToClassification(input.historicalMatch);
  }

  const webSearchAvailable = hasWebSearchApiKey();
  const web = webSearchAvailable
    ? await gatherCompanyWebContext(companyName, input.country, input.website)
    : {
        snippets: [],
        linkedInSnippets: [],
        companyDescriptions: [],
        extractedWebsite: input.website?.trim() || null,
        source: "none" as const,
        apiKeyMissing: true,
      };

  if (web.apiKeyMissing && !webSearchKeyWarned) {
    console.info(
      "[classify-client-category] Web search skipped: no SERPER, BRAVE, or TAVILY API key configured."
    );
    webSearchKeyWarned = true;
  }

  if (companyName.length >= 3 && hasOpenAiApiKey()) {
    const aiResult = await classifyClientCategoryWithAi({
      name: companyName,
      country: input.country,
      website: input.website ?? web.extractedWebsite,
      webContext: web,
    });

    if (aiResult) {
      return {
        categorySlug: aiResult.categorySlug,
        subcategorySlug: aiResult.subcategorySlug,
        confidence: aiResult.confidence,
        source: "ai_search",
        reason: aiResult.reasoning,
      };
    }
  }

  return classifyWithKeywordAndWeb({
    companyName,
    keywordHint: null,
    web,
  });
}
