import { COUNTRY_OPTIONS } from "@/lib/master-data/constants";

/** Popular creator / audience countries shown as quick-add pills in the filter panel. */
export const DISCOVERY_FILTER_COUNTRY_CODES = [
  "EG",
  "AE",
  "SA",
  "QA",
  "KW",
  "JO",
  "LB",
  "US",
  "GB",
  "FR",
  "DE",
  "IN",
] as const;

export const DISCOVERY_FILTER_COUNTRIES = DISCOVERY_FILTER_COUNTRY_CODES.map((code) => {
  const match = COUNTRY_OPTIONS.find((option) => option.value === code);
  return { code, label: match?.label ?? code };
});

export const CONTENT_TAG_SUGGESTIONS = ["reels", "viral", "fyp", "travel", "beauty"] as const;

/** Quick-add language pills for creator / content language filters. */
export const DISCOVERY_FILTER_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ar", label: "Arabic" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "hi", label: "Hindi" },
  { code: "tr", label: "Turkish" },
  { code: "pt", label: "Portuguese" },
] as const;

export function languageLabel(code: string): string {
  const normalized = code.trim().toLowerCase();
  return DISCOVERY_FILTER_LANGUAGES.find((entry) => entry.code === normalized)?.label ?? code;
}

export const LAST_POST_WITHIN_OPTIONS = [
  { value: "", label: "Any time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "180d", label: "Last 6 months" },
  { value: "365d", label: "Last 12 months" },
] as const;

export const AGE_RANGE_OPTIONS = [
  { value: "", label: "Any" },
  { value: "13", label: "13" },
  { value: "18", label: "18" },
  { value: "25", label: "25" },
  { value: "35", label: "35" },
  { value: "45", label: "45" },
  { value: "55", label: "55" },
] as const;

export const AGE_RANGE_MAX_OPTIONS = [
  { value: "", label: "Any" },
  { value: "17", label: "17" },
  { value: "24", label: "24" },
  { value: "34", label: "34" },
  { value: "44", label: "44" },
  { value: "54", label: "54" },
  { value: "65", label: "65+" },
] as const;

export function countryLabel(code: string): string {
  const normalized = code.trim().toUpperCase();
  return COUNTRY_OPTIONS.find((option) => option.value === normalized)?.label ?? normalized;
}
