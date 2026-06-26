"use client";

import Link from "next/link";
import { HistoryIcon } from "lucide-react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { VENDOR_CAMPAIGNS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  VendorFormSection,
  VendorProfileTabShell,
} from "@/features/vendors/components/vendor-form-ui";
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

export function VendorCampaignsTab({
  vendor,
  onCancel,
}: {
  vendor: VendorDetail;
  onCancel?: () => void;
}) {
  return (
    <VendorProfileTabShell
      title="Campaign history"
      description="Campaign assignments for this creator."
      onCancel={onCancel}
    >
      <VendorFormSection
        icon={HistoryIcon}
        title="Assignments"
        description="Historical campaign links and agreed fees."
      >
        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.vendorCampaigns}
          columns={VENDOR_CAMPAIGNS_TABLE_COLUMNS}
          rows={vendor.campaign_assignments}
          filterAccessors={VENDOR_CAMPAIGNS_FILTER_ACCESSORS}
        >
          <div className="flex flex-wrap items-center justify-end gap-2 pb-1">
            <OperationalTableControlsSlot contextLabel="Vendor campaigns" />
          </div>
          {vendor.campaign_assignments.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              Not assigned to any campaigns yet.
            </p>
          ) : (
            <OperationalConfigurableTable
              columns={VENDOR_CAMPAIGNS_COLUMNS}
              rows={vendor.campaign_assignments}
              rowKey={(assignment) => assignment.id}
            />
          )}
        </OperationalTableSuiteProvider>
      </VendorFormSection>
    </VendorProfileTabShell>
  );
}
