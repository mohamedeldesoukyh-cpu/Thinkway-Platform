# Client Category Taxonomy Review

**Date:** June 2026  
**Scope:** `lib/clients/client-category-taxonomy.ts`

## Summary

The taxonomy grew from a historical intelligence workbook with 11 top-level categories. This review documents structural issues, recommended corrections applied in code, and the expanded 19-category structure.

## Findings

### 1. Duplicate / overlapping subcategory slugs (cross-category)

| Label / concept | Slugs | Categories |
|-----------------|-------|------------|
| Construction Materials | `pet_construction_materials`, `home_construction_materials` | Pet, Home |
| Furniture & Interiors | `pet_furniture_interiors`, `home_furniture_interiors` | Pet, Home |
| Interior Design | `pet_interior_design`, `home_interior_design` | Pet, Home |
| Retail - Pet Products | `retail_pet_products`, `pet_retail_pet_products` | Retail, Pet |
| Technology & Software | `technology_software` (sub), `technology_software` (category) | Marketing, Technology |
| Beauty & Personal Care | `beauty_personal_care` (sub label duplicates category) | Beauty |
| Educational Institutions | `educational_institutions` | Government (Education is now separate) |

**Recommendation:** Keep existing slugs stable for stored client data. Pet-category construction/furniture entries are legacy mis-tags; prefer Home & Furniture or Real Estate for new rules. Do not delete slugs.

### 2. Inconsistent naming

- Retail subcategories mix prefixes: `retail_fashion` vs bare `e_commerce`, `jewelry_retail`.
- Online variants are verbose: `online_electronics_retailer` vs `electronics_retail`.
- Food items live under Retail (`food_beverages`, `food_restaurant`) while a dedicated **Food & Beverage** category now exists for new classifications.

**Recommendation:** New classifications may use `food_beverage` category; existing hints remain on `retail_ecommerce` to avoid breaking approved data.

### 3. Overlapping top-level categories

| Overlap | Notes |
|---------|-------|
| Retail vs Food & Beverage | FMCG/food brands historically under Retail |
| Retail vs Automotive | BYD/Tesla mapped to Retail/general_trading; Automotive category added |
| Retail vs Technology | Consumer electronics under Retail; enterprise/SaaS under Technology |
| Home & Furniture vs Real Estate | `luxury_real_estate_development` under Home |
| Government vs Education | Universities under Government; Education category added |
| Marketing vs Technology | Agency tech subs vs Technology category |

**Recommendation:** Rule hints and AI prompts prefer the most specific new category for greenfield; legacy slug mappings unchanged.

### 4. Missing "Other" subcategory

**Before:** No category had an explicit Other subcategory.  
**Applied:** Each category now includes `{category_slug}_other` (or `other_general` / `other_unknown` for top-level Other).

## Applied taxonomy structure (19 categories)

| # | Slug | Label |
|---|------|-------|
| 1 | `marketing_advertising_media_agencies` | Marketing, Advertising & Media Agencies |
| 2 | `retail_ecommerce` | Retail & E-Commerce |
| 3 | `beauty_personal_care` | Beauty & Personal Care |
| 4 | `fashion_apparel` | Fashion & Apparel |
| 5 | `healthcare_wellness` | Healthcare & Wellness |
| 6 | `financial_services_banking` | Financial Services & Banking |
| 7 | `pet_animal_products` | Pet & Animal Products |
| 8 | `transportation_delivery` | Transportation & Delivery |
| 9 | `home_furniture` | Home & Furniture |
| 10 | `telecommunications` | Telecommunications |
| 11 | `government_sports_nonprofit` | Government, Sports & Nonprofit |
| 12 | `food_beverage` | Food & Beverage *(new)* |
| 13 | `travel_hospitality` | Travel & Hospitality *(new)* |
| 14 | `automotive` | Automotive *(new)* |
| 15 | `real_estate` | Real Estate *(new)* |
| 16 | `technology_software` | Technology & Software *(new)* |
| 17 | `education` | Education *(new)* |
| 18 | `entertainment_media` | Entertainment & Media *(new)* |
| 19 | `other` | Other *(new)* |

## Slug storage note

The database stores **text slugs** on `clients.client_category` and `clients.client_subcategory`. There are no numeric `category_id` / `subcategory_id` columns. Slugs are the canonical join key for analytics and reporting.

## Future corrections (non-breaking)

1. Gradually migrate food FMCG hints from `retail_ecommerce` → `food_beverage` with dual-write period.
2. Move `luxury_real_estate_development` rule targets to `real_estate` for new clients only.
3. Deprecate pet-category construction/furniture subs in UI labels (keep slugs).
4. Consolidate duplicate online retail subcategory labels in a major version bump.
