import type { InfluencerStatus } from "@/types/database";
import {
  COUNTRY_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  EXCLUSIVITY_OPTIONS,
  GENDER_OPTIONS,
  INFLUENCER_DOCUMENT_TYPE_OPTIONS,
  LANGUAGE_OPTIONS,
  NATIONALITY_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  SOCIAL_PLATFORM_OPTIONS,
  SUPPORTED_CURRENCIES,
  labelForOption,
} from "@/lib/master-data/constants";

export const VENDORS_PAGE_SIZE = 10;

export const VENDOR_STATUS_OPTIONS: {
  value: InfluencerStatus;
  label: string;
}[] = [
  { value: "prospect", label: "Prospect" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "blacklisted", label: "Blacklisted" },
];

export const PLATFORM_OPTIONS = SOCIAL_PLATFORM_OPTIONS;
export const PRICING_CURRENCY_OPTIONS = SUPPORTED_CURRENCIES;

export {
  COUNTRY_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  EXCLUSIVITY_OPTIONS,
  GENDER_OPTIONS,
  INFLUENCER_DOCUMENT_TYPE_OPTIONS,
  LANGUAGE_OPTIONS,
  NATIONALITY_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  labelForOption,
};
