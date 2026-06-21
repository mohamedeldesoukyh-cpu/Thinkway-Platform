"use client";

import { format } from "date-fns";
import { HistoryIcon } from "lucide-react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  VendorFormSection,
  VendorProfileTabShell,
} from "@/features/vendors/components/vendor-form-ui";
import type { VendorWorkspace } from "@/features/vendors/types";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { VENDOR_DELIVERABLES_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

type DeliverableRow = VendorWorkspace["deliverables"][number];

const VENDOR_DELIVERABLES_COLUMNS: OperationalConfigurableColumnDef<DeliverableRow>[] = [
  {
    id: "deliverable",
    label: "Deliverable",
    renderCell: (deliverable) => (
      <>
        <span className="font-medium text-foreground">{deliverable.title}</span>
        {deliverable.document_number ? (
          <p className="text-[10px] text-muted-foreground">
            <DocumentNumber value={deliverable.document_number} />
          </p>
        ) : null}
      </>
    ),
  },
  {
    id: "campaign",
    label: "Campaign",
    cellClassName: "text-muted-foreground",
    renderCell: (deliverable) => deliverable.campaign_name ?? "—",
  },
  {
    id: "status",
    label: "Status",
    cellClassName: "capitalize text-muted-foreground",
    renderCell: (deliverable) => deliverable.status.replace(/_/g, " "),
  },
];

export function VendorActivityTab({
  workspace,
  onCancel,
}: {
  workspace: VendorWorkspace;
  onCancel?: () => void;
}) {
  const recentDeliverables = workspace.deliverables.slice(0, 10);

  return (
    <VendorProfileTabShell
      title="Activity & Audit"
      description="Profile edits, assignments, and operational changes."
      onCancel={onCancel}
    >
      <div className="grid gap-[18px] xl:grid-cols-2">
        <VendorFormSection
          icon={HistoryIcon}
          title="Activity log"
          description="Recent profile and operational events."
        >
          {workspace.activity.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[#9099A8]">
              No activity recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-[#E6EAF2]">
              {workspace.activity.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-[13px] font-medium capitalize text-foreground">
                      {item.summary}
                    </p>
                    <p className="text-[11px] text-[#9099A8]">
                      {item.actor?.full_name ?? item.actor?.email ?? "System"}
                    </p>
                  </div>
                  <time className="shrink-0 text-[11px] text-[#9099A8]">
                    {format(new Date(item.created_at), "MMM d, yyyy HH:mm")}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </VendorFormSection>

        <VendorFormSection
          icon={HistoryIcon}
          title="Recent deliverables"
          description="Latest deliverables across campaign assignments."
        >
          <OperationalTableSuiteProvider
            tableId={OPERATIONAL_TABLE_IDS.vendorDeliverablesActivity}
            columns={VENDOR_DELIVERABLES_COLUMNS}
            rows={recentDeliverables}
            filterAccessors={VENDOR_DELIVERABLES_FILTER_ACCESSORS}
          >
            <div className="flex flex-wrap items-center justify-end gap-2 pb-1">
              <OperationalTableControlsSlot contextLabel="Vendor deliverables" />
            </div>
            {workspace.deliverables.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[#9099A8]">
                No deliverables.
              </p>
            ) : (
              <OperationalConfigurableTable
                columns={VENDOR_DELIVERABLES_COLUMNS}
                rows={recentDeliverables}
                rowKey={(deliverable) => deliverable.id}
              />
            )}
          </OperationalTableSuiteProvider>
        </VendorFormSection>
      </div>
    </VendorProfileTabShell>
  );
}
