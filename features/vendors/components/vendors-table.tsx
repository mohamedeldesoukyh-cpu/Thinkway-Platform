"use client";

import Link from "next/link";

import {
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableCell,
  CampaignOperationalTableCellAmount,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
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

export function VendorsTable({ vendors }: VendorsTableProps) {
  return (
    <div className="overflow-x-auto">
      <CampaignOperationalTable>
        <CampaignOperationalTableHeader>
          <CampaignOperationalTableHeaderRow>
            <CampaignOperationalTableHead>Vendor #</CampaignOperationalTableHead>
            <CampaignOperationalTableHead>Creator</CampaignOperationalTableHead>
            <CampaignOperationalTableHead>Agency</CampaignOperationalTableHead>
            <CampaignOperationalTableHead>Platforms</CampaignOperationalTableHead>
            <CampaignOperationalTableHead className="text-right">
              Followers
            </CampaignOperationalTableHead>
            <CampaignOperationalTableHead className="text-right">
              Assignments
            </CampaignOperationalTableHead>
            <CampaignOperationalTableHead>Niche</CampaignOperationalTableHead>
            <CampaignOperationalTableHead className="text-right">Pricing</CampaignOperationalTableHead>
            <CampaignOperationalTableHead>Status</CampaignOperationalTableHead>
            <CampaignOperationalTableHead>Country</CampaignOperationalTableHead>
            <CampaignOperationalTableHead className="text-right">Actions</CampaignOperationalTableHead>
          </CampaignOperationalTableHeaderRow>
        </CampaignOperationalTableHeader>
        <CampaignOperationalTableBody>
          {vendors.map((vendor) => (
            <CampaignOperationalTableRow key={vendor.id}>
              <CampaignOperationalTableCell className="text-muted-foreground">
                <DocumentNumber value={vendor.document_number} />
              </CampaignOperationalTableCell>
              <CampaignOperationalTableCell>
                <Link
                  href={`/vendors/${vendor.id}`}
                  className="font-medium text-foreground hover:text-primary hover:underline"
                >
                  {vendor.display_name}
                </Link>
              </CampaignOperationalTableCell>
              <CampaignOperationalTableCell className="text-muted-foreground">
                {vendor.legal_name ?? "—"}
              </CampaignOperationalTableCell>
              <CampaignOperationalTableCell className="text-muted-foreground">
                {formatPlatformsSummary(vendor.platform_accounts)}
              </CampaignOperationalTableCell>
              <CampaignOperationalTableCellAmount>
                {formatFollowers(getTotalFollowers(vendor.platform_accounts))}
              </CampaignOperationalTableCellAmount>
              <CampaignOperationalTableCellAmount>
                {vendor.assignment_count}
              </CampaignOperationalTableCellAmount>
              <CampaignOperationalTableCell className="max-w-[140px] truncate text-muted-foreground">
                {formatCategoriesList(vendor.categories)}
              </CampaignOperationalTableCell>
              <CampaignOperationalTableCellAmount>
                {formatPricing(vendor.rate_card)}
              </CampaignOperationalTableCellAmount>
              <CampaignOperationalTableCell>
                <VendorStatusCell
                  vendor={vendor}
                  badgeClassName={OPERATIONAL_CHROME_STATUS_BADGE}
                />
              </CampaignOperationalTableCell>
              <CampaignOperationalTableCell className="text-muted-foreground">
                {vendor.country_code ?? "—"}
              </CampaignOperationalTableCell>
              <CampaignOperationalTableCell className="text-right">
                <VendorRowActions vendor={vendor} />
              </CampaignOperationalTableCell>
            </CampaignOperationalTableRow>
          ))}
        </CampaignOperationalTableBody>
      </CampaignOperationalTable>
    </div>
  );
}
