import type {
  AgencyOrDirect,
  ClientStatus,
  PaymentTerms,
} from "@/types/database";

export type GroupDocumentType =
  | "nda"
  | "agreement"
  | "tax_document"
  | "group_contract";

export type GroupFinancialSummary = {
  total_revenue: number;
  total_cost: number;
  total_gp: number;
  margin_percent: number;
  billing_outstanding: number;
  campaign_count: number;
  active_campaign_count: number;
};

export type GroupLegalEntityRow = {
  id: string;
  document_number: string;
  name: string;
  legal_name: string | null;
  country: string | null;
  currency: string;
  payment_terms: PaymentTerms | null;
  status: ClientStatus;
  active_campaigns: number;
  revenue: number;
};

export type GroupBrandRow = {
  id: string;
  document_number: string;
  name: string;
  status: ClientStatus;
  currency_code: string;
  agency_or_direct: AgencyOrDirect | null;
  category_name: string | null;
  subcategory_name: string | null;
  vr_rate_percent: number | null;
  active_campaigns: number;
  client_name: string;
};

export type GroupDocumentRow = {
  id: string;
  group_id: string;
  document_type: GroupDocumentType;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  expires_at: string | null;
  created_at: string;
};

export type GroupActivityItem = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  actor: { id: string; full_name: string | null; email: string } | null;
  summary: string;
};

export type GroupRecentCampaign = {
  id: string;
  document_number: string;
  name: string;
  status: string;
  brand_name: string | null;
  client_name: string | null;
  revenue: number;
  created_at: string;
};

export type GroupWorkspace = {
  id: string;
  document_number: string;
  name: string;
  region: string | null;
  status: ClientStatus;
  notes: string | null;
  created_at: string;
  account_director: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
  counts: {
    legal_entities: number;
    brands: number;
    campaigns: number;
  };
  financials: GroupFinancialSummary;
  legal_entities: GroupLegalEntityRow[];
  brands: GroupBrandRow[];
  documents: GroupDocumentRow[];
  activity: GroupActivityItem[];
  recent_campaigns: GroupRecentCampaign[];
};

export const GROUP_DOCUMENT_TYPE_OPTIONS = [
  { value: "nda", label: "NDA" },
  { value: "agreement", label: "Agreement" },
  { value: "tax_document", label: "Tax document" },
  { value: "group_contract", label: "Group contract" },
] as const;

export const GROUP_REGION_OPTIONS = [
  { value: "MENA", label: "MENA" },
  { value: "GCC", label: "GCC" },
  { value: "Europe", label: "Europe" },
  { value: "North America", label: "North America" },
  { value: "APAC", label: "APAC" },
  { value: "Africa", label: "Africa" },
] as const;

const ACTIVE_CAMPAIGN_STATUSES = new Set([
  "draft",
  "planning",
  "active",
  "paused",
]);

export function isActiveCampaignStatus(status: string): boolean {
  return ACTIVE_CAMPAIGN_STATUSES.has(status);
}

export function formatMargin(revenue: number, gp: number): number {
  if (revenue <= 0) {
    return 0;
  }
  return Math.round((gp / revenue) * 10000) / 100;
}
