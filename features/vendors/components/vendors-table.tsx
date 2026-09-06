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
      <Link href={vendorDetailPath({ ...vendor, name: vendor.display_name })} className="tw-id">
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
        nameClassName="tw-nm"
        nameHref={vendorDetailPath({ ...vendor, name: vendor.display_name })}
      />
    ),
  },
  {
    id: "agency",
    label: "Agency",
    renderCell: (vendor) =>
      vendor.legal_name?.trim() ? (
        <span className="tw-t">{vendor.legal_name}</span>
      ) : (
        <span className="tw-miss">none</span>
      ),
  },
  {
    id: "platforms",
    label: "Platforms",
    renderCell: (vendor) => (
      <span className="tw-t">{formatPlatformsSummary(vendor.platform_accounts)}</span>
    ),
  },
  {
    id: "followers",
    label: "Followers",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (vendor) => (
      <span className="tw-v">
        {formatFollowers(getTotalFollowers(vendor.platform_accounts))}
      </span>
    ),
  },
  {
    id: "assignments",
    label: "Assign.",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (vendor) => (
      <span className={`tw-v${vendor.assignment_count ? "" : " z"}`}>{vendor.assignment_count}</span>
    ),
  },
  {
    id: "niche",
    label: "Niche",
    renderCell: (vendor) => {
      const label = formatCategoriesList(vendor.categories);
      if (!label || label === "—") {
        return <span className="tw-miss">not set</span>;
      }
      return (
        <span className="tw-t block max-w-[170px] truncate" title={label}>
          {label}
        </span>
      );
    },
  },
  {
    id: "pricing",
    label: "Pricing",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (vendor) => {
      const pricing = formatPricing(vendor.rate_card);
      if (!pricing || pricing === "—") {
        return <span className="tw-miss">no rate</span>;
      }
      return <span className="tw-v">{pricing}</span>;
    },
  },
  {
    id: "crm_status",
    label: "CRM",
    renderCell: (vendor) => (
      <span className="tw-t capitalize">
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
    renderCell: (vendor) => {
      if (typeof vendor.completeness_score !== "number") {
        return <span className="tw-miss">—</span>;
      }
      const pct = Math.round(vendor.completeness_score);
      return (
        <span className={`tw-rdy2${pct ? "" : " z"}`} style={{ ["--p" as string]: `${pct}%` }}>
          <i />
          <b>{pct}%</b>
        </span>
      );
    },
  },
  {
    id: "status",
    label: "Status",
    renderCell: (vendor) => <VendorListStatusCell status={vendor.status} />,
  },
  {
    id: "country",
    label: "Country",
    renderCell: (vendor) => {
      const label = formatVendorCountryLabels(vendor.country_codes, vendor.country_code);
      if (label === "—") return <span className="tw-miss">not set</span>;
      return (
        <span className="tw-t" title={label}>
          {label}
        </span>
      );
    },
  },
  {
    id: "actions",
    label: "Act",
    locked: true,
    headerClassName: "text-right",
    renderCell: (vendor) => (
      <span className="tw-act">
        <VendorRowActions vendor={vendor} />
      </span>
    ),
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
