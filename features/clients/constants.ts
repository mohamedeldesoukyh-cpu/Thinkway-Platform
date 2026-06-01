import type { ClientStatus } from "@/types/database";
import {
  AGENCY_OR_DIRECT_OPTIONS,
  CLIENT_CATEGORY_OPTIONS,
  CLIENT_DOCUMENT_TYPE_OPTIONS,
  CLIENT_SUBCATEGORY_BY_CATEGORY,
  COUNTRY_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  getClientSubcategoryOptions,
  labelForOption,
} from "@/lib/master-data/constants";

export const CLIENTS_PAGE_SIZE = 10;

export const CLIENT_STATUS_OPTIONS: {
  value: ClientStatus;
  label: string;
}[] = [
  { value: "prospect", label: "Prospect" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

export {
  AGENCY_OR_DIRECT_OPTIONS,
  CLIENT_CATEGORY_OPTIONS,
  CLIENT_DOCUMENT_TYPE_OPTIONS,
  CLIENT_SUBCATEGORY_BY_CATEGORY,
  COUNTRY_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  getClientSubcategoryOptions,
  labelForOption,
};
