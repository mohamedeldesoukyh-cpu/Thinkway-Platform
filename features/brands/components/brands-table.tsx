"use client";

import Link from "next/link";

import { DocumentNumber } from "@/components/ui/document-number";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { ClientStatusBadge } from "@/features/clients/components/client-status-badge";
import type { BrandsListResult } from "@/features/brands/queries";

type BrandsTableProps = {
  brands: BrandsListResult["brands"];
};

type BrandRow = BrandsListResult["brands"][number];

export const BRANDS_TABLE_COLUMNS: OperationalConfigurableColumnDef<BrandRow>[] = [
  {
    id: "document_number",
    label: "Brand #",
    monoCell: true,
    renderCell: (brand) => <DocumentNumber value={brand.document_number} />,
  },
  {
    id: "brand",
    label: "Brand",
    renderCell: (brand) => <span className="font-medium">{brand.name}</span>,
  },
  {
    id: "client",
    label: "Client",
    renderCell: (brand) => (
      <Link href={`/clients/${brand.client_id}`} className="hover:text-primary hover:underline">
        {brand.client_name}
      </Link>
    ),
  },
  {
    id: "group",
    label: "Group",
    renderCell: (brand) => brand.group_name ?? "—",
  },
  {
    id: "category",
    label: "Category",
    renderCell: (brand) => brand.category_name ?? "—",
  },
  {
    id: "vr_rate",
    label: "VR%",
    renderCell: (brand) =>
      brand.vr_rate_percent != null ? `${brand.vr_rate_percent}%` : "—",
  },
  {
    id: "currency",
    label: "Currency",
    renderCell: (brand) => brand.currency_code,
  },
  {
    id: "status",
    label: "Status",
    renderCell: (brand) => <ClientStatusBadge status={brand.status} />,
  },
  {
    id: "campaigns",
    label: "Campaigns",
    headerClassName: "text-right",
    cellClassName: "text-right",
    renderCell: (brand) => brand.active_campaigns,
  },
];

export const BRANDS_TABLE_COLUMN_METAS = getOperationalTableColumnMetas(BRANDS_TABLE_COLUMNS);

export function BrandsTable({ brands }: BrandsTableProps) {
  return (
    <OperationalConfigurableTable
      columns={BRANDS_TABLE_COLUMNS}
      rows={brands}
      rowKey={(brand) => brand.id}
    />
  );
}
