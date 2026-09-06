"use client";

import Link from "next/link";

import {
  CreatorIdentityCell,
  creatorProfileSourceFromAccounts,
} from "@/components/creator/creator-profile-link";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { DocumentNumber } from "@/components/ui/document-number";
import { VendorListStatusCell } from "@/features/vendors/components/vendor-list-status-cell";
import { VendorRowActions } from "@/features/vendors/components/vendor-row-actions";
import type { VendorsListResult } from "@/features/vendors/queries";
import { vendorDetailPath } from "@/lib/routing/entity-paths";
import { formatCountryCodeLabel } from "@/lib/creators/creator-display-utils";
import { mergeCountryCodes } from "@/lib/creators/country-inference";
import {
  formatCategoriesList,
  formatFollowers,
  formatPlatformsSummary,
  formatPricing,
  getTotalFollowers,
} from "../utils";

function formatVendorCountryLabels(
  countryCodes: string[] | null | undefined,
  countryCode: string | null | undefined
): string {
  const codes = mergeCountryCodes(countryCodes, countryCode);
  if (codes.length === 0) return "—";
  return codes.map(formatCountryCodeLabel).join(" · ");
}

type VendorsTableProps = {
  vendors: VendorsListResult["vendors"];
};

type VendorRow = VendorsListResult["vendors"][number];

export const VENDORS_TABLE_COLUMNS: OperationalConfigurableColumnDef<VendorRow>[] = [
  {
    id: "document_number",
    label: "Vendor #",
    renderCell: (vendor) => (
      <Link href={vendorDetailPath({ ...vendor, name: vendor.display_name })} className="platform-v6-link">
        <DocumentNumber value={vendor.document_number} />
      </Link>
    ),
  },
  {
    id: "creator",
    label: "Creator",
    renderCell: (vendor) => (
      <CreatorIdentityCell
        source={creatorProfileSourceFromAccounts(vendor.display_name, vendor.platform_accounts, {
          avatarUrl: vendor.primary_avatar_url,
        })}
        size="sm"
        showHandle={false}
        stopPropagation
        nameClassName="font-medium text-foreground"
      />
    ),
  },
  {
    id: "agency",
    label: "Agency",
    renderCell: (vendor) => (
      <span className="platform-v6-c-gray">{vendor.legal_name ?? "—"}</span>
    ),
  },
  {
    id: "platforms",
    label: "Platforms",
    renderCell: (vendor) => (
      <span className="platform-v6-c-blue">{formatPlatformsSummary(vendor.platform_accounts)}</span>
    ),
  },
  {
    id: "followers",
    label: "Followers",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (vendor) => (
      <span className="platform-v6-num font-medium">
        {formatFollowers(getTotalFollowers(vendor.platform_accounts))}
      </span>
    ),
  },
  {
    id: "assignments",
    label: "Assignments",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (vendor) => (
      <span className="platform-v6-num">{vendor.assignment_count}</span>
    ),
  },
  {
    id: "niche",
    label: "Niche",
    renderCell: (vendor) => (
      <span className="block max-w-[140px] truncate text-[11px] text-muted-foreground">
        {formatCategoriesList(vendor.categories)}
      </span>
    ),
  },
  {
    id: "pricing",
    label: "Pricing",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (vendor) => (
      <span className="platform-v6-c-gray">{formatPricing(vendor.rate_card)}</span>
    ),
  },
  {
    id: "crm_status",
    label: "CRM",
    renderCell: (vendor) => (
      <span className="text-[11px] font-medium capitalize text-foreground">
        {vendor.crm_status?.replace(/_/g, " ") ??
          (vendor.has_commercial_profile ? "incomplete" : "—")}
      </span>
    ),
  },
  {
    id: "completeness",
    label: "Complete",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (vendor) => (
      <span className="platform-v6-num">
        {typeof vendor.completeness_score === "number"
          ? `${Math.round(vendor.completeness_score)}%`
          : "—"}
      </span>
    ),
  },
  {
    id: "status",
    label: "Status",
    renderCell: (vendor) => <VendorListStatusCell status={vendor.status} />,
  },
  {
    id: "country",
    label: "Country",
    renderCell: (vendor) =>
      formatVendorCountryLabels(vendor.country_codes, vendor.country_code),
    cellClassName: "text-muted-foreground",
  },
  {
    id: "actions",
    label: "Actions",
    locked: true,
    headerClassName: "text-right",
    renderCell: (vendor) => <VendorRowActions vendor={vendor} />,
    cellClassName: "text-right",
  },
];

export const VENDORS_TABLE_COLUMN_METAS = getOperationalTableColumnMetas(VENDORS_TABLE_COLUMNS);

export function VendorsTable({ vendors }: VendorsTableProps) {
  return (
    <OperationalConfigurableTable
      columns={VENDORS_TABLE_COLUMNS}
      rows={vendors}
      rowKey={(vendor) => vendor.id}
    />
  );
}
