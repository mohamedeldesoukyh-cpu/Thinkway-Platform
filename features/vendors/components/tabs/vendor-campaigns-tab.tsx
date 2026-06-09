"use client";

import Link from "next/link";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { VENDOR_CAMPAIGNS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import { DocumentNumber } from "@/components/ui/document-number";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import type { VendorDetail } from "@/types/database";

type AssignmentRow = VendorDetail["campaign_assignments"][number];

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

const VENDOR_CAMPAIGNS_COLUMNS: OperationalConfigurableColumnDef<AssignmentRow>[] = [
  {
    id: "campaign",
    label: "Campaign",
    renderCell: (assignment) =>
      assignment.campaign ? (
        <Link
          href={`/campaigns/${assignment.campaign.id}`}
          className="font-medium hover:text-primary"
        >
          {assignment.campaign.name}
        </Link>
      ) : (
        "—"
      ),
  },
  {
    id: "campaign_number",
    label: "Campaign #",
    monoCell: true,
    renderCell: (assignment) => (
      <DocumentNumber value={assignment.campaign?.document_number} />
    ),
  },
  {
    id: "status",
    label: "Status",
    cellClassName: "capitalize",
    renderCell: (assignment) => assignment.status.replace(/_/g, " "),
  },
  {
    id: "agreed_fee",
    label: "Agreed fee",
    amountCell: true,
    renderCell: (assignment) =>
      formatMoney(Number(assignment.agreed_fee), assignment.currency),
  },
];

export const VENDOR_CAMPAIGNS_TABLE_COLUMNS = VENDOR_CAMPAIGNS_COLUMNS;

export function VendorCampaignsTab({ vendor }: { vendor: VendorDetail }) {
  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.vendorCampaigns}
      columns={VENDOR_CAMPAIGNS_TABLE_COLUMNS}
      rows={vendor.campaign_assignments}
      filterAccessors={VENDOR_CAMPAIGNS_FILTER_ACCESSORS}
    >
      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <CampaignOperationalSectionHeader
            title="Campaign history"
            description="Campaign assignments for this creator."
            actions={
              <OperationalTableControlsSlot contextLabel="Vendor campaigns" />
            }
          />
        }
      >
        {vendor.campaign_assignments.length === 0 ? (
          <p className="px-4 py-8 text-[11px] text-muted-foreground">
            Not assigned to any campaigns yet.
          </p>
        ) : (
          <OperationalConfigurableTable
            columns={VENDOR_CAMPAIGNS_COLUMNS}
            rows={vendor.campaign_assignments}
            rowKey={(assignment) => assignment.id}
          />
        )}
      </OperationalTableSection>
    </OperationalTableSuiteProvider>
  );
}
