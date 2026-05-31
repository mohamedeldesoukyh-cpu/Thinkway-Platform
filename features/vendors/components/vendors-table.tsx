import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { VendorListItem } from "@/types/database";

import {
  formatCategoriesList,
  formatFollowers,
  formatPlatformsSummary,
  formatPricing,
  getTotalFollowers,
} from "../utils";
import { VendorStatusBadge } from "./vendor-status-badge";

type VendorsTableProps = {
  vendors: VendorListItem[];
};

export function VendorsTable({ vendors }: VendorsTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendor #</TableHead>
            <TableHead>Creator</TableHead>
            <TableHead>Agency</TableHead>
            <TableHead>Platforms</TableHead>
            <TableHead>Followers</TableHead>
            <TableHead>Niche</TableHead>
            <TableHead>Pricing</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Country</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendors.map((vendor) => (
            <TableRow key={vendor.id}>
              <TableCell className="font-mono text-xs">
                {vendor.document_number}
              </TableCell>
              <TableCell>
                <Link
                  href={`/vendors/${vendor.id}`}
                  className="font-medium hover:underline"
                >
                  {vendor.display_name}
                </Link>
              </TableCell>
              <TableCell>{vendor.legal_name ?? "—"}</TableCell>
              <TableCell>
                {formatPlatformsSummary(vendor.platform_accounts)}
              </TableCell>
              <TableCell>
                {formatFollowers(getTotalFollowers(vendor.platform_accounts))}
              </TableCell>
              <TableCell className="max-w-[140px] truncate">
                {formatCategoriesList(vendor.categories)}
              </TableCell>
              <TableCell>{formatPricing(vendor.rate_card)}</TableCell>
              <TableCell>
                <VendorStatusBadge status={vendor.status} />
              </TableCell>
              <TableCell>{vendor.country_code ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
