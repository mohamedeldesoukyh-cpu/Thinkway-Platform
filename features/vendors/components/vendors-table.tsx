"use client";

import Link from "next/link";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OPERATIONAL_CHROME_STATUS_BADGE } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import {
  VendorRowActions,
  VendorStatusCell,
} from "@/features/vendors/components/vendor-row-actions";
import { DocumentNumber } from "@/components/ui/document-number";
import type { VendorsListResult } from "@/features/vendors/queries";
import {
  formatCategoriesList,
  formatFollowers,
  formatPlatformsSummary,
  formatPricing,
  getTotalFollowers,
} from "../utils";

type VendorsTableProps = {
  vendors: VendorsListResult["vendors"];
};

type VendorRow = VendorsListResult["vendors"][number];

export const VENDORS_TABLE_COLUMNS: OperationalConfigurableColumnDef<VendorRow>[] = [
  {
    id: "document_number",
    label: "Vendor #",
    renderCell: (vendor) => <DocumentNumber value={vendor.document_number} />,
    cellClassName: "text-muted-foreground",
  },
  {
    id: "creator",
    label: "Creator",
    renderCell: (vendor) => (
      <Link
        href={`/vendors/${vendor.id}`}
        className="font-medium text-foreground hover:text-primary hover:underline"
      >
        {vendor.display_name}
      </Link>
    ),
  },
  {
    id: "agency",
    label: "Agency",
    renderCell: (vendor) => vendor.legal_name ?? "—",
    cellClassName: "text-muted-foreground",
  },
  {
    id: "platforms",
    label: "Platforms",
    renderCell: (vendor) => formatPlatformsSummary(vendor.platform_accounts),
    cellClassName: "text-muted-foreground",
  },
  {
    id: "followers",
    label: "Followers",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (vendor) => formatFollowers(getTotalFollowers(vendor.platform_accounts)),
  },
  {
    id: "assignments",
    label: "Assignments",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (vendor) => vendor.assignment_count,
  },
  {
    id: "niche",
    label: "Niche",
    renderCell: (vendor) => formatCategoriesList(vendor.categories),
    cellClassName: "max-w-[140px] truncate text-muted-foreground",
  },
  {
    id: "pricing",
    label: "Pricing",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (vendor) => formatPricing(vendor.rate_card),
  },
  {
    id: "status",
    label: "Status",
    renderCell: (vendor) => (
      <VendorStatusCell vendor={vendor} badgeClassName={OPERATIONAL_CHROME_STATUS_BADGE} />
    ),
  },
  {
    id: "country",
    label: "Country",
    renderCell: (vendor) => vendor.country_code ?? "—",
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
