"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { DocumentNumber } from "@/components/ui/document-number";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { OPERATIONAL_CHROME_STATUS_BADGE } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { AssignmentStatusBadge } from "@/features/campaigns/components/assignment-status-badge";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { LINE_BILLING_STATUS_LABELS, VENDOR_PAYMENT_STATUS_LABELS } from "@/features/campaigns/constants";
import type { VendorWorkspace } from "@/features/vendors/types";
import { formatMoney, formatPercent } from "@/features/vendors/utils";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { cn } from "@/lib/utils";
import { VENDOR_ASSIGNMENTS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

type AssignmentRow = VendorWorkspace["assignments"][number];

function buildVendorAssignmentsColumns(
  currency: string
): OperationalConfigurableColumnDef<AssignmentRow>[] {
  return [
    {
      id: "campaign",
      label: "Campaign",
      renderCell: (assignment) => (
        <>
          {assignment.campaign_id ? (
            <Link
              href={`/campaigns/${assignment.campaign_id}`}
              className="font-medium text-foreground hover:text-primary hover:underline"
            >
              {assignment.campaign_name}
            </Link>
          ) : (
            "—"
          )}
          {assignment.campaign_document_number ? (
            <p className="text-[10px] text-muted-foreground">
              <DocumentNumber value={assignment.campaign_document_number} />
            </p>
          ) : null}
        </>
      ),
    },
    {
      id: "assignment_line",
      label: "Assignment line",
      renderCell: (assignment) => (
        <>
          <span className="font-medium text-foreground">{assignment.line_name ?? "—"}</span>
          {assignment.line_document_number ? (
            <p className="text-[10px] text-muted-foreground">
              <DocumentNumber value={assignment.line_document_number} />
            </p>
          ) : null}
        </>
      ),
    },
    {
      id: "ops_status",
      label: "Ops status",
      renderCell: (assignment) =>
        assignment.assignment_status ? (
          <AssignmentStatusBadge
            status={
              assignment.assignment_status as import("@/features/campaigns/types").CampaignLineAssignmentStatus
            }
          />
        ) : (
          "—"
        ),
    },
    {
      id: "billing",
      label: "Billing",
      renderCell: (assignment) => (
        <Badge
          variant="outline"
          className={cn(OPERATIONAL_CHROME_STATUS_BADGE, "font-normal")}
        >
          {assignment.billing_status
            ? LINE_BILLING_STATUS_LABELS[assignment.billing_status]
            : "—"}
        </Badge>
      ),
    },
    {
      id: "revenue",
      label: "Revenue",
      amountCell: true,
      amountVariant: "revenue",
      renderCell: (assignment) =>
        formatMoney(assignment.revenue, assignment.currency || currency),
    },
    {
      id: "cost",
      label: "Cost",
      amountCell: true,
      amountVariant: "cost",
      renderCell: (assignment) =>
        formatMoney(assignment.cost, assignment.currency || currency),
    },
    {
      id: "gp",
      label: "GP",
      amountCell: true,
      amountVariant: "gp",
      amountValue: (assignment) => assignment.gp,
      renderCell: (assignment) =>
        formatMoney(assignment.gp, assignment.currency || currency),
    },
    {
      id: "payout",
      label: "Payout",
      renderCell: (assignment) =>
        assignment.vendor_payment_status ? (
          <Badge
            variant="secondary"
            className={cn(OPERATIONAL_CHROME_STATUS_BADGE, "font-normal")}
          >
            {VENDOR_PAYMENT_STATUS_LABELS[assignment.vendor_payment_status]}
          </Badge>
        ) : (
          "—"
        ),
    },
  ];
}

export function VendorAssignmentsTab({ workspace }: { workspace: VendorWorkspace }) {
  const currency =
    (workspace.payment_details as { currency?: string })?.currency ?? "USD";
  const columns = useMemo(
    () => buildVendorAssignmentsColumns(currency),
    [currency]
  );
  const columnMetas = useMemo(() => getOperationalTableColumnMetas(columns), [columns]);

  return (
    <div className="space-y-4">
      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.vendorAssignments}
        columns={columns}
        rows={workspace.assignments}
        filterAccessors={VENDOR_ASSIGNMENTS_FILTER_ACCESSORS}
      >
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <CampaignOperationalSectionHeader
              title="Assignment history"
              description="Campaign lines, deliverables, commercial terms, and operational status."
              actions={
                <OperationalTableControlsSlot contextLabel="Vendor assignments" />
              }
            />
          }
        >
          {workspace.assignments.length === 0 ? (
            <p className="px-4 py-8 text-center text-[11px] text-muted-foreground md:px-5">
              No campaign assignments yet.
            </p>
          ) : (
            <OperationalConfigurableTable
              columns={columns}
              rows={workspace.assignments}
              rowKey={(assignment) => assignment.id}
            />
          )}
        </OperationalTableSection>
      </OperationalTableSuiteProvider>

      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Platform performance summary
          </h2>
        }
      >
        <p className="px-4 py-4 text-[11px] leading-snug text-muted-foreground md:px-5">
          GP contribution: {formatMoney(workspace.financials.total_gp, currency)} (
          {formatPercent(workspace.financials.margin_percent)} margin) across{" "}
          {workspace.counts.assignments} assignment(s).
        </p>
      </OperationalTableSection>
    </div>
  );
}
