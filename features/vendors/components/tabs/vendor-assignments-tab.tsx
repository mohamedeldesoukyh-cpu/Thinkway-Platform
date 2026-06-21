"use client";

import { BriefcaseIcon } from "lucide-react";

import Link from "next/link";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { DocumentNumber } from "@/components/ui/document-number";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { OPERATIONAL_CHROME_STATUS_BADGE } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { AssignmentStatusBadge } from "@/features/campaigns/components/assignment-status-badge";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { LINE_BILLING_STATUS_LABELS, VENDOR_PAYMENT_STATUS_LABELS } from "@/features/campaigns/constants";
import {
  VendorFormSection,
  VendorProfileTabShell,
} from "@/features/vendors/components/vendor-form-ui";
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

export function VendorAssignmentsTab({
  workspace,
  onCancel,
}: {
  workspace: VendorWorkspace;
  onCancel?: () => void;
}) {
  const currency =
    (workspace.payment_details as { currency?: string })?.currency ?? "USD";
  const columns = useMemo(
    () => buildVendorAssignmentsColumns(currency),
    [currency]
  );

  return (
    <VendorProfileTabShell
      title="Assignments"
      description="Campaign lines, deliverables, commercial terms, and operational status."
      onCancel={onCancel}
    >
      <div className="grid gap-[18px]">
        <VendorFormSection
          icon={BriefcaseIcon}
          title="Assignment history"
          description="All campaign assignments linked to this creator."
        >
          <OperationalTableSuiteProvider
            tableId={OPERATIONAL_TABLE_IDS.vendorAssignments}
            columns={columns}
            rows={workspace.assignments}
            filterAccessors={VENDOR_ASSIGNMENTS_FILTER_ACCESSORS}
          >
            <div className="flex flex-wrap items-center justify-end gap-2 pb-1">
              <OperationalTableControlsSlot contextLabel="Vendor assignments" />
            </div>
            {workspace.assignments.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[#9099A8]">
                No campaign assignments yet.
              </p>
            ) : (
              <OperationalConfigurableTable
                columns={columns}
                rows={workspace.assignments}
                rowKey={(assignment) => assignment.id}
              />
            )}
          </OperationalTableSuiteProvider>
        </VendorFormSection>

        <VendorFormSection
          icon={BriefcaseIcon}
          title="Platform performance summary"
          description="Aggregate GP contribution across assignments."
        >
          <p className="text-[13px] leading-relaxed text-[#5B6575]">
            GP contribution: {formatMoney(workspace.financials.total_gp, currency)} (
            {formatPercent(workspace.financials.margin_percent)} margin) across{" "}
            {workspace.counts.assignments} assignment(s).
          </p>
        </VendorFormSection>
      </div>
    </VendorProfileTabShell>
  );
}
