import type { BrandsListResult } from "@/features/brands/queries";
import type { CampaignListItem } from "@/types/database";
import type { ClientsListResult } from "@/features/clients/queries";
import type { getGroupsList } from "@/features/groups/queries";
import type { VendorsListResult } from "@/features/vendors/queries";
import { campaignPortfolioIntel } from "@/features/campaigns/lifecycle/campaign-portfolio-intelligence";
import { CAMPAIGN_CLIENT_WORKSPACE_LINK_LABEL } from "@/features/client-workspace/client-review-selection";
import type { OperationalTableFilterField } from "@/lib/tables/operational-table-filter-sort";
import { resolveCampaignListPoBudget } from "@/lib/finance/po/operational-budget";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";

export const CAMPAIGNS_TABLE_FILTER_ACCESSORS: Partial<
  Record<string, (row: CampaignListItem) => string | number | null | undefined>
> = {
  document_number: (row) => formatDocumentNumberForDisplay(row.document_number),
  name: (row) => row.name,
  brand: (row) => row.brand?.name ?? null,
  group_client: (row) =>
    [row.group?.name, row.client?.legal_name ?? row.client?.name].filter(Boolean).join(" · ") ||
    null,
  stage: (row) => campaignPortfolioIntel(row).businessStageLabel,
  waiting_for: (row) => campaignPortfolioIntel(row).waitingFor,
  days_waiting: (row) => campaignPortfolioIntel(row).daysWaiting,
  risk: (row) => campaignPortfolioIntel(row).riskLabel,
  next_action: (row) => campaignPortfolioIntel(row).nextAction,
  lines: (row) => row.lines.length,
  status: (row) => row.status,
  client_link: (row) =>
    CAMPAIGN_CLIENT_WORKSPACE_LINK_LABEL[row.client_workspace_link?.state ?? "none"],
  po_total: (row) => resolveCampaignListPoBudget(row),
  dates: (row) =>
    [row.start_date, row.end_date].filter(Boolean).join(" – ") || null,
};

export const CAMPAIGNS_ADDITIONAL_FILTER_FIELDS: OperationalTableFilterField<CampaignListItem>[] =
  [
    {
      id: "start_date",
      label: "Start date",
      filterType: "date",
      filterAccessor: (row) => row.start_date,
    },
    {
      id: "end_date",
      label: "End date",
      filterType: "date",
      filterAccessor: (row) => row.end_date,
    },
  ];

type BrandRow = BrandsListResult["brands"][number];

export const BRANDS_TABLE_FILTER_ACCESSORS: Partial<
  Record<string, (row: BrandRow) => string | number | null | undefined>
> = {
  document_number: (row) => formatDocumentNumberForDisplay(row.document_number),
  brand: (row) => row.name,
  client: (row) => row.client_name,
  group: (row) => row.group_name,
  category: (row) => row.category_name,
  vr_rate: (row) => row.vr_rate_percent,
  currency: (row) => row.currency_code,
  status: (row) => row.status,
  campaigns: (row) => row.active_campaigns,
};

type ClientRow = ClientsListResult["clients"][number];

export const CLIENTS_TABLE_FILTER_ACCESSORS: Partial<
  Record<string, (row: ClientRow) => string | number | null | undefined>
> = {
  document_number: (row) => formatDocumentNumberForDisplay(row.document_number),
  legal_entity: (row) => row.legal_name ?? row.name,
  group: (row) => row.group?.name ?? null,
  status: (row) => row.status,
  billing_email: (row) => row.billing_email,
  created: (row) => row.created_at.slice(0, 10),
};

type GroupRow = Awaited<ReturnType<typeof getGroupsList>>["groups"][number];

export const GROUPS_TABLE_FILTER_ACCESSORS: Partial<
  Record<string, (row: GroupRow) => string | number | null | undefined>
> = {
  document_number: (row) => formatDocumentNumberForDisplay(row.document_number),
  name: (row) => row.name,
  status: (row) => row.status,
};

type VendorRow = VendorsListResult["vendors"][number];

export const VENDORS_TABLE_FILTER_ACCESSORS: Partial<
  Record<string, (row: VendorRow) => string | number | null | undefined>
> = {
  document_number: (row) => formatDocumentNumberForDisplay(row.document_number),
  creator: (row) => row.display_name,
  agency: (row) => row.legal_name,
  platforms: (row) =>
    row.platform_accounts?.map((account) => account.platform).join(", ") || null,
  followers: (row) =>
    row.platform_accounts?.reduce(
      (sum, account) => sum + (account.follower_count ?? 0),
      0
    ) ?? 0,
  assignments: (row) => row.assignment_count,
  niche: (row) => row.categories?.join(", ") || null,
  pricing: (row) => {
    const rate = row.rate_card?.package_rate;
    return typeof rate === "number" ? rate : null;
  },
  status: (row) => row.status,
  country: (row) => row.country_code,
};
