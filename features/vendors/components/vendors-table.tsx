"use client";

import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { VendorsListResult } from "@/features/vendors/queries";
import {
  VendorRowActions,
  VendorStatusCell,
} from "@/features/vendors/components/vendor-row-actions";
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
            <TableHead>Assignments</TableHead>
            <TableHead>Niche</TableHead>
            <TableHead>Pricing</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Country</TableHead>
            <TableHead className="text-right">Actions</TableHead>
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
              <TableCell>{vendor.assignment_count}</TableCell>
              <TableCell className="max-w-[140px] truncate">
                {formatCategoriesList(vendor.categories)}
              </TableCell>
              <TableCell>{formatPricing(vendor.rate_card)}</TableCell>
              <TableCell>
                <VendorStatusCell vendor={vendor} />
              </TableCell>
              <TableCell>{vendor.country_code ?? "—"}</TableCell>
              <TableCell className="text-right">
                <VendorRowActions vendor={vendor} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
