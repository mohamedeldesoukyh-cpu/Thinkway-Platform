"use client";

import { useActionState, useEffect } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { useIsOperationalColumnVisible } from "@/components/tables/operational-table-column-context";
import { useOperationalTableDataContextOptional } from "@/components/tables/operational-table-data-context";
import type { OperationalTableColumnMeta } from "@/lib/tables/operational-table-column-settings";
import {
  decideFinancialApprovalAction,
  type BillingActionState,
} from "@/features/billing/actions";
import { FINANCIAL_APPROVAL_STAGE_LABELS } from "@/features/billing/constants";
import type { FinancialApprovalRow } from "@/features/billing/types";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import {
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableCell,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";

export const BILLING_FINANCIAL_APPROVALS_COLUMN_METAS: OperationalTableColumnMeta[] = [
  { id: "request", label: "Request" },
  { id: "stage", label: "Stage" },
  { id: "assignee", label: "Assignee" },
  { id: "actions", label: "Actions", locked: true },
];

type BillingApprovalsPanelProps = {
  approvals: FinancialApprovalRow[];
  settingsSlot?: ReactNode;
};

export function BillingApprovalsPanel({ approvals, settingsSlot }: BillingApprovalsPanelProps) {
  const displayApprovals =
    useOperationalTableDataContextOptional<FinancialApprovalRow>()?.processedRows ??
    approvals;

  if (displayApprovals.length === 0) {
    return (
      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <CampaignOperationalSectionHeader
            title="Financial approvals"
            actions={settingsSlot}
          />
        }
      >
        <p className="px-4 py-8 text-[11px] text-muted-foreground">No pending approvals.</p>
      </OperationalTableSection>
    );
  }

  return (
    <OperationalTableSection
      wide
      tableOnly
      cardSurface
      leading={
        <CampaignOperationalSectionHeader
          title="Financial approvals"
          description="Campaign Manager → Finance → CFO/Admin"
          actions={settingsSlot}
        />
      }
    >
      <CampaignOperationalTable>
        <BillingApprovalsTableHeader />
        <CampaignOperationalTableBody>
          {displayApprovals.map((approval) => (
            <ApprovalRow key={approval.id} approval={approval} />
          ))}
        </CampaignOperationalTableBody>
      </CampaignOperationalTable>
    </OperationalTableSection>
  );
}

function BillingApprovalsTableHeader() {
  const showRequest = useIsOperationalColumnVisible("request");
  const showStage = useIsOperationalColumnVisible("stage");
  const showAssignee = useIsOperationalColumnVisible("assignee");
  const showActions = useIsOperationalColumnVisible("actions");

  return (
    <CampaignOperationalTableHeader>
      <CampaignOperationalTableHeaderRow>
        {showRequest ? <CampaignOperationalTableHead>Request</CampaignOperationalTableHead> : null}
        {showStage ? <CampaignOperationalTableHead>Stage</CampaignOperationalTableHead> : null}
        {showAssignee ? <CampaignOperationalTableHead>Assignee</CampaignOperationalTableHead> : null}
        {showActions ? (
          <CampaignOperationalTableHead className="text-right">Actions</CampaignOperationalTableHead>
        ) : null}
      </CampaignOperationalTableHeaderRow>
    </CampaignOperationalTableHeader>
  );
}

function ApprovalRow({ approval }: { approval: FinancialApprovalRow }) {
  const [state, formAction, pending] = useActionState(
    decideFinancialApprovalAction,
    { ok: false } satisfies BillingActionState
  );

  const showRequest = useIsOperationalColumnVisible("request");
  const showStage = useIsOperationalColumnVisible("stage");
  const showAssignee = useIsOperationalColumnVisible("assignee");
  const showActions = useIsOperationalColumnVisible("actions");

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <CampaignOperationalTableRow>
      {showRequest ? (
        <CampaignOperationalTableCell>
          <p className="font-medium">{approval.title}</p>
          <p className="text-[10px] tabular-nums text-muted-foreground">
            <DocumentNumber value={approval.document_number} />
          </p>
        </CampaignOperationalTableCell>
      ) : null}
      {showStage ? (
        <CampaignOperationalTableCell>
          {FINANCIAL_APPROVAL_STAGE_LABELS[approval.approval_stage]}
        </CampaignOperationalTableCell>
      ) : null}
      {showAssignee ? (
        <CampaignOperationalTableCell className="text-muted-foreground">
          {approval.assigned_to_name ?? "Unassigned"}
        </CampaignOperationalTableCell>
      ) : null}
      {showActions ? (
        <CampaignOperationalTableCell className="text-right">
          <div className="flex justify-end gap-2">
            <form action={formAction}>
              <input type="hidden" name="approval_id" value={approval.id} />
              <input type="hidden" name="decision" value="approved" />
              <Button type="submit" size="sm" disabled={pending}>
                Approve
              </Button>
            </form>
            <form action={formAction}>
              <input type="hidden" name="approval_id" value={approval.id} />
              <input type="hidden" name="decision" value="rejected" />
              <Button type="submit" size="sm" variant="outline" disabled={pending}>
                Reject
              </Button>
            </form>
          </div>
        </CampaignOperationalTableCell>
      ) : null}
    </CampaignOperationalTableRow>
  );
}
