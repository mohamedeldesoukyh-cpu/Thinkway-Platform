/** Shared master-data dropdown options for clients and vendors. */

export const SUPPORTED_CURRENCIES = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "SAR", label: "SAR — Saudi Riyal" },
  { value: "EGP", label: "EGP — Egyptian Pound" },
  { value: "EUR", label: "EUR — Euro" },
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]["value"];

export const PAYMENT_TERMS_OPTIONS = [
  { value: "due_on_receipt", label: "Due on receipt" },
  { value: "net_15", label: "Net 15" },
  { value: "net_30", label: "Net 30" },
  { value: "net_45", label: "Net 45" },
  { value: "net_60", label: "Net 60" },
  { value: "net_90", label: "Net 90" },
  { value: "custom", label: "Custom" },
] as const;

export const AGENCY_OR_DIRECT_OPTIONS = [
  { value: "agency", label: "Agency" },
  { value: "direct", label: "Direct" },
  { value: "hybrid", label: "Hybrid" },
] as const;

export const CLIENT_CATEGORY_OPTIONS = [
  { value: "fmcg", label: "FMCG" },
  { value: "beauty", label: "Beauty" },
  { value: "automotive", label: "Automotive" },
  { value: "technology", label: "Technology" },
  { value: "finance", label: "Finance" },
  { value: "retail", label: "Retail" },
  { value: "government", label: "Government" },
  { value: "entertainment", label: "Entertainment" },
  { value: "other", label: "Other" },
] as const;

export const CLIENT_SUBCATEGORY_BY_CATEGORY: Record<
  string,
  { value: string; label: string }[]
> = {
  fmcg: [
    { value: "food_beverage", label: "Food & Beverage" },
    { value: "household", label: "Household" },
    { value: "personal_care", label: "Personal Care" },
  ],
  beauty: [
    { value: "skincare", label: "Skincare" },
    { value: "makeup", label: "Makeup" },
    { value: "fragrance", label: "Fragrance" },
    { value: "haircare", label: "Haircare" },
  ],
  automotive: [
    { value: "oem", label: "OEM" },
    { value: "dealership", label: "Dealership" },
    { value: "aftermarket", label: "Aftermarket" },
  ],
  technology: [
    { value: "consumer_electronics", label: "Consumer Electronics" },
    { value: "software", label: "Software" },
    { value: "telecom", label: "Telecom" },
  ],
  finance: [
    { value: "banking", label: "Banking" },
    { value: "insurance", label: "Insurance" },
    { value: "fintech", label: "Fintech" },
  ],
  retail: [
    { value: "ecommerce", label: "E-commerce" },
    { value: "department_store", label: "Department Store" },
    { value: "luxury", label: "Luxury" },
  ],
  government: [
    { value: "federal", label: "Federal" },
    { value: "municipal", label: "Municipal" },
    { value: "tourism_board", label: "Tourism Board" },
  ],
  entertainment: [
    { value: "media", label: "Media" },
    { value: "gaming", label: "Gaming" },
    { value: "events", label: "Events" },
  ],
  other: [{ value: "general", label: "General" }],
};

export const CLIENT_DOCUMENT_TYPE_OPTIONS = [
  { value: "trade_license", label: "Trade License / CR" },
  { value: "vat_certificate", label: "VAT Certificate" },
  { value: "tax_certificate", label: "Tax Certificate" },
  { value: "nda", label: "NDA" },
  { value: "msa_contract", label: "MSA / Contract" },
  { value: "sow", label: "SOW" },
] as const;

export const INFLUENCER_DOCUMENT_TYPE_OPTIONS = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID" },
  { value: "signed_contract", label: "Signed Contract" },
  { value: "media_kit", label: "Media Kit" },
  { value: "tax_document", label: "Tax Document" },
  { value: "rate_card", label: "Rate Card" },
] as const;

export const CONTRACT_STATUS_OPTIONS = [
  { value: "none", label: "None" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "signed", label: "Signed" },
  { value: "expired", label: "Expired" },
  { value: "terminated", label: "Terminated" },
] as const;

export const EXCLUSIVITY_OPTIONS = [
  { value: "none", label: "None" },
  { value: "category", label: "Category" },
  { value: "brand", label: "Brand" },
  { value: "full", label: "Full" },
] as const;

export const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
  { value: "other", label: "Other" },
] as const;

export const SOCIAL_PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "snapchat", label: "Snapchat" },
  { value: "twitter", label: "X (Twitter)" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
] as const;

export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "de", label: "German" },
  { value: "hi", label: "Hindi" },
  { value: "ur", label: "Urdu" },
] as const;

export const COUNTRY_OPTIONS = [
  { value: "AE", label: "United Arab Emirates" },
  { value: "SA", label: "Saudi Arabia" },
  { value: "EG", label: "Egypt" },
  { value: "QA", label: "Qatar" },
  { value: "KW", label: "Kuwait" },
  { value: "BH", label: "Bahrain" },
  { value: "OM", label: "Oman" },
  { value: "JO", label: "Jordan" },
  { value: "LB", label: "Lebanon" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "IT", label: "Italy" },
  { value: "ES", label: "Spain" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australia" },
  { value: "IN", label: "India" },
  { value: "PK", label: "Pakistan" },
] as const;

export const NATIONALITY_OPTIONS = COUNTRY_OPTIONS;

export function getClientSubcategoryOptions(category: string | null | undefined) {
  if (!category) {
    return [];
  }
  return CLIENT_SUBCATEGORY_BY_CATEGORY[category] ?? [];
}

export function labelForOption(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined
): string {
  if (!value) {
    return "—";
  }
  return options.find((o) => o.value === value)?.label ?? value;
}
