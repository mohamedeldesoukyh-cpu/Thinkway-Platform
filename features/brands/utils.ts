import type { GroupBrandRow, GroupLegalEntityRow } from "@/features/groups/types";
import type {
  BrandListItem,
  ClientBrandRow,
  ClientDetail,
} from "@/types/database";

export type BrandTableRow = ClientBrandRow;

export function brandListItemToTableRow(
  brand: BrandListItem,
  activeCampaigns = 0
): BrandTableRow {
  return {
    id: brand.id,
    document_number: brand.document_number,
    name: brand.name,
    client_id: brand.client_id,
    status: brand.status,
    currency_code: brand.currency_code,
    category_id: brand.category_id,
    subcategory_id: brand.subcategory_id,
    vr_rate_id: brand.vr_rate_id,
    category_name: brand.category?.name ?? null,
    subcategory_name: brand.subcategory?.name ?? null,
    vr_rate_percent: brand.vr_rate?.rate_percent ?? null,
    active_campaigns: activeCampaigns,
  };
}

export function brandTableRowToGroupBrandRow(
  brand: BrandTableRow,
  clientName: string
): GroupBrandRow {
  return {
    id: brand.id,
    document_number: brand.document_number,
    name: brand.name,
    status: brand.status,
    currency_code: brand.currency_code,
    category_name: brand.category_name,
    subcategory_name: brand.subcategory_name,
    category_id: brand.category_id,
    subcategory_id: brand.subcategory_id,
    vr_rate_id: brand.vr_rate_id,
    vr_rate_percent: brand.vr_rate_percent,
    active_campaigns: brand.active_campaigns,
    client_id: brand.client_id,
    client_name: clientName,
  };
}

export function clientToLegalEntityRow(
  client: ClientDetail,
  activeCampaigns = 0,
  revenue = 0
): GroupLegalEntityRow {
  return {
    id: client.id,
    document_number: client.document_number,
    name: client.name,
    legal_name: client.legal_name,
    country: client.country,
    currency: client.currency,
    payment_terms: client.payment_terms,
    agency_or_direct: (client.agency_or_direct as GroupLegalEntityRow["agency_or_direct"]) ?? null,
    status: client.status,
    active_campaigns: activeCampaigns,
    revenue,
  };
}
