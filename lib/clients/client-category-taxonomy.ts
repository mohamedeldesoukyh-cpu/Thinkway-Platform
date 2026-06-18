/** Intelligence-engine category taxonomy (exact labels from historical workbook). */

export type ClientCategoryTaxonomyEntry = {
  slug: string;
  label: string;
  subcategories: { slug: string; label: string }[];
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sub(slug: string, label: string) {
  return { slug, label };
}

export const CLIENT_CATEGORY_TAXONOMY: ClientCategoryTaxonomyEntry[] = [
  {
    slug: "marketing_advertising_media_agencies",
    label: "🧠 Marketing, Advertising & Media Agencies",
    subcategories: [
      sub("advertising_public_relations", "Advertising & Public Relations"),
      sub("advertising_agency", "Advertising Agency"),
      sub("creative_agency", "Creative Agency"),
      sub("digital_advertising", "Digital Advertising"),
      sub("digital_marketing", "Digital Marketing"),
      sub("digital_marketing_it_solutions", "Digital Marketing & IT Solutions"),
      sub("digital_solutions", "Digital Solutions"),
      sub("event_management_branding", "Event Management & Branding"),
      sub("media_agency", "Media Agency"),
      sub("media_investment_management", "Media Investment Management"),
      sub("media_production", "Media Production"),
      sub("media_environmental_content", "Media & Environmental Content"),
      sub("media_environmental_podcast", "Media & Environmental Podcast"),
      sub("software_crm_solutions", "Software & CRM Solutions"),
      sub("social_media_platform", "Social Media Platform"),
      sub("tech_solutions", "Tech Solutions"),
      sub("technology_software", "Technology & Software"),
      sub("consulting_services", "Consulting Services"),
    ],
  },
  {
    slug: "retail_ecommerce",
    label: "🛍️ Retail & E-Commerce",
    subcategories: [
      sub("e_commerce", "E-Commerce"),
      sub("electronics_retail", "Electronics Retail"),
      sub("online_marketplace", "Online Marketplace"),
      sub("online_retailer", "Online Retailer"),
      sub("online_baby_products_retailer", "Online Baby Products Retailer"),
      sub("online_electronics_retailer", "Online Electronics Retailer"),
      sub("online_fashion_retailer", "Online Fashion Retailer"),
      sub("online_furniture_marketplace", "Online Furniture Marketplace"),
      sub("online_health_store", "Online Health Store"),
      sub("health_wellness_products", "Health & Wellness Products"),
      sub("retail_baby_products", "Retail - Baby Products"),
      sub("retail_childrens_products", "Retail - Children's Products"),
      sub("retail_fashion", "Retail - Fashion"),
      sub("retail_fashion_home", "Retail - Fashion & Home"),
      sub("retail_food_products", "Retail - Food Products"),
      sub("retail_furniture", "Retail - Furniture"),
      sub("retail_general_merchandise", "Retail - General Merchandise"),
      sub("retail_home_furnishings", "Retail - Home Furnishings"),
      sub("retail_kitchen_furnishings", "Retail - Kitchen Furnishings"),
      sub("retail_pet_products", "Retail - Pet Products"),
      sub("retail_distribution", "Retail & Distribution"),
      sub("retail_franchise_operator", "Retail Franchise Operator"),
      sub("jewelry_retail", "Jewelry Retail"),
      sub("home_shopping_network", "Home Shopping Network"),
      sub("food_beverages", "Food & Beverages"),
      sub("food_snacks", "Food & Snacks"),
      sub("general_trading", "General Trading"),
      sub("lifestyle_products", "Lifestyle Products"),
      sub("consumer_electronics", "Consumer Electronics"),
      sub("food_restaurant", "Food & Restaurant"),
      sub("sports_fitness_services", "Sports & Fitness Services"),
      sub(
        "home_improvement_products_services_retailers",
        "Home Improvement Products & Services Retailers"
      ),
      sub("entertainment_leisure_services", "Entertainment & Leisure Services"),
    ],
  },
  {
    slug: "beauty_personal_care",
    label: "💄 Beauty & Personal Care",
    subcategories: [
      sub("beauty_personal_care", "Beauty & Personal Care"),
      sub("beauty_skincare", "Beauty & Skincare"),
      sub("cosmetics", "Cosmetics"),
      sub("fragrances", "Fragrances"),
      sub("fragrances_skincare", "Fragrances & Skincare"),
      sub("natural_skincare", "Natural Skincare"),
      sub("skincare", "Skincare"),
      sub("oral_care", "Oral Care"),
      sub("pharmaceutical_distribution", "Pharmaceutical Distribution"),
    ],
  },
  {
    slug: "fashion_apparel",
    label: "👗 Fashion & Apparel",
    subcategories: [
      sub("fashion", "Fashion"),
      sub("fashion_lifestyle", "Fashion & Lifestyle"),
      sub("footwear", "Footwear"),
      sub("luxury_fashion", "Luxury Fashion"),
      sub("luxury_footwear_retail", "Luxury Footwear Retail"),
      sub("luxury_online_fashion_retailer", "Luxury Online Fashion Retailer"),
      sub("sustainable_fashion", "Sustainable Fashion"),
      sub("sportswear", "Sportswear"),
    ],
  },
  {
    slug: "healthcare_wellness",
    label: "🏥 Healthcare & Wellness",
    subcategories: [
      sub("health_wellness_app", "Health & Wellness App"),
      sub("healthcare_products", "Healthcare Products"),
      sub("healthcare_services", "Healthcare Services"),
    ],
  },
  {
    slug: "financial_services_banking",
    label: "🏦 Financial Services & Banking",
    subcategories: [
      sub("accounting_services", "Accounting Services"),
      sub("banking", "Banking"),
      sub("financial_services", "Financial Services"),
      sub("government_sme_agency", "Government SME Agency"),
      sub("investment_holding", "Investment Holding"),
      sub("nonprofit_organization", "Nonprofit Organization"),
    ],
  },
  {
    slug: "pet_animal_products",
    label: "🐾 Pet & Animal Products",
    subcategories: [
      sub("pet_retail_pet_products", "Retail - Pet Products"),
      sub("pet_construction_materials", "Construction Materials"),
      sub("pet_furniture_interiors", "Furniture & Interiors"),
      sub("pet_interior_design", "Interior Design"),
    ],
  },
  {
    slug: "transportation_delivery",
    label: "🚚 Transportation & Delivery",
    subcategories: [
      sub("delivery_ecommerce_platform", "Delivery & E-Commerce Platform"),
      sub("delivery_services", "Delivery Services"),
      sub("ride_hailing_app", "Ride-Hailing App"),
      sub("transportation_app", "Transportation App"),
      sub("loyalty_rewards_platform", "Loyalty & Rewards Platform"),
      sub("trading_distribution", "Trading & Distribution"),
    ],
  },
  {
    slug: "home_furniture",
    label: "🏠 Home & Furniture",
    subcategories: [
      sub("home_construction_materials", "Construction Materials"),
      sub("home_furniture_interiors", "Furniture & Interiors"),
      sub("home_interior_design", "Interior Design"),
      sub("general_contracting", "General Contracting"),
      sub("luxury_real_estate_development", "Luxury Real Estate Development"),
    ],
  },
  {
    slug: "telecommunications",
    label: "📱 Telecommunications",
    subcategories: [
      sub("esim_solutions", "eSIM Solutions"),
      sub("mobile_technology", "Mobile Technology"),
    ],
  },
  {
    slug: "government_sports_nonprofit",
    label: "🏛️ Government, Sports & Nonprofit",
    subcategories: [
      sub("national_olympic_sports_committees", "National Olympic & Sports Committees"),
      sub("government_authorities", "Government Authorities"),
      sub("ngos_nonprofit_organizations", "NGOs & Nonprofit Organizations"),
      sub("sports_federations_leagues", "Sports Federations & Leagues"),
      sub("educational_institutions", "Educational Institutions"),
    ],
  },
];

export const CLIENT_CATEGORY_SLUGS = CLIENT_CATEGORY_TAXONOMY.map((c) => c.slug) as [
  string,
  ...string[],
];

export const CLIENT_SUBCATEGORY_SLUGS = CLIENT_CATEGORY_TAXONOMY.flatMap((category) =>
  category.subcategories.map((subcategory) => subcategory.slug)
) as [string, ...string[]];

const categoryBySlug = new Map(
  CLIENT_CATEGORY_TAXONOMY.map((category) => [category.slug, category])
);

const subcategoryBySlug = new Map<
  string,
  { categorySlug: string; label: string }
>();

for (const category of CLIENT_CATEGORY_TAXONOMY) {
  for (const subcategory of category.subcategories) {
    subcategoryBySlug.set(subcategory.slug, {
      categorySlug: category.slug,
      label: subcategory.label,
    });
  }
}

export function getClientCategoryOptions() {
  return CLIENT_CATEGORY_TAXONOMY.map((category) => ({
    value: category.slug,
    label: category.label,
  }));
}

export function getClientSubcategoryOptions(categorySlug: string | null | undefined) {
  if (!categorySlug) {
    return [];
  }
  const category = categoryBySlug.get(categorySlug);
  if (!category) {
    return [];
  }
  return category.subcategories.map((subcategory) => ({
    value: subcategory.slug,
    label: subcategory.label,
  }));
}

export function getClientCategoryLabel(categorySlug: string | null | undefined): string {
  if (!categorySlug) {
    return "—";
  }
  return categoryBySlug.get(categorySlug)?.label ?? categorySlug;
}

export function getClientSubcategoryLabel(
  categorySlug: string | null | undefined,
  subcategorySlug: string | null | undefined
): string {
  if (!subcategorySlug) {
    return "—";
  }
  const entry = subcategoryBySlug.get(subcategorySlug);
  if (!entry || (categorySlug && entry.categorySlug !== categorySlug)) {
    return subcategorySlug;
  }
  return entry.label;
}

export function isValidClientCategoryPair(
  categorySlug: string | null | undefined,
  subcategorySlug: string | null | undefined
): boolean {
  if (!categorySlug || !subcategorySlug) {
    return false;
  }
  const entry = subcategoryBySlug.get(subcategorySlug);
  return entry?.categorySlug === categorySlug;
}

export function findTaxonomyPairByLabels(
  categoryLabel: string,
  subcategoryLabel: string
): { categorySlug: string; subcategorySlug: string } | null {
  const normalizedCategory = categoryLabel.trim().toLowerCase();
  const normalizedSubcategory = subcategoryLabel.trim().toLowerCase();

  for (const category of CLIENT_CATEGORY_TAXONOMY) {
    if (category.label.trim().toLowerCase() !== normalizedCategory) {
      continue;
    }
    const subcategory = category.subcategories.find(
      (item) => item.label.trim().toLowerCase() === normalizedSubcategory
    );
    if (subcategory) {
      return {
        categorySlug: category.slug,
        subcategorySlug: subcategory.slug,
      };
    }
  }

  return null;
}

export function tokenizeForMatching(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s&+-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

export function labelToSlug(label: string): string {
  return slugify(label);
}
