"use client";

import { format } from "date-fns";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { DocumentNumber } from "@/components/ui/document-number";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
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

const VENDOR_DELIVERABLES_COLUMN_METAS = getOperationalTableColumnMetas(
  VENDOR_DELIVERABLES_COLUMNS
);

export function VendorActivityTab({ workspace }: { workspace: VendorWorkspace }) {
  const recentDeliverables = workspace.deliverables.slice(0, 10);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Activity & audit
            </h2>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Profile edits, assignments, and operational changes.
            </p>
          </div>
        }
      >
        {workspace.activity.length === 0 ? (
          <p className="px-4 py-8 text-center text-[11px] text-muted-foreground md:px-5">
            No activity recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/40 px-4 md:px-5">
            {workspace.activity.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 py-3 first:pt-4 last:pb-4"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[11px] font-medium capitalize text-foreground">
                    {item.summary}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.actor?.full_name ?? item.actor?.email ?? "System"}
                  </p>
                </div>
                <time className="shrink-0 text-[10px] text-muted-foreground">
                  {format(new Date(item.created_at), "MMM d, yyyy HH:mm")}
                </time>
              </li>
            ))}
          </ul>
        )}
      </OperationalTableSection>

      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.vendorDeliverablesActivity}
        columns={VENDOR_DELIVERABLES_COLUMNS}
        rows={recentDeliverables}
        filterAccessors={VENDOR_DELIVERABLES_FILTER_ACCESSORS}
      >
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <CampaignOperationalSectionHeader
              title="Recent deliverables"
              actions={
                <OperationalTableControlsSlot contextLabel="Vendor deliverables" />
              }
            />
          }
        >
          {workspace.deliverables.length === 0 ? (
            <p className="px-4 py-8 text-center text-[11px] text-muted-foreground md:px-5">
              No deliverables.
            </p>
          ) : (
            <OperationalConfigurableTable
              columns={VENDOR_DELIVERABLES_COLUMNS}
              rows={recentDeliverables}
              rowKey={(deliverable) => deliverable.id}
            />
          )}
        </OperationalTableSection>
      </OperationalTableSuiteProvider>
    </div>
  );
}
