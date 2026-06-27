"use client";

import { format } from "date-fns";
import { useMemo, useState } from "react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { Badge } from "@/components/ui/badge";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { WORKFLOW_STAGE_OPTIONS } from "@/features/campaigns/constants";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { DocumentNumber } from "@/components/ui/document-number";
import { ApprovalDetailSheet } from "@/features/campaigns/components/detail-sheets/approval-detail-sheet";
import { DetailClickableLabel } from "@/features/campaigns/components/detail-sheets/detail-clickable-label";
import { OPERATIONAL_TABLE_FONT } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { cn } from "@/lib/utils";

type CampaignWorkflowTabProps = {
  workspace: CampaignWorkspace;
};

type ApprovalRow = CampaignWorkspace["approvals"][number];

function buildApprovalsColumns(
  onOpenDetail: (id: string) => void
): OperationalConfigurableColumnDef<ApprovalRow>[] {
  return [
    {
      id: "approval",
      label: "Approval",
      renderCell: (a) => (
        <div className="space-y-0.5">
          <DetailClickableLabel
            onClick={() => onOpenDetail(a.id)}
            title={`View ${a.title} details`}
          >
            {a.title}
          </DetailClickableLabel>
          <p className="text-[11px] text-muted-foreground">
            <button
              type="button"
              onClick={() => onOpenDetail(a.id)}
              className="transition-colors hover:text-primary hover:underline"
            >
              <DocumentNumber value={a.document_number} />
            </button>
          </p>
        </div>
      ),
    },
    {
      id: "entity",
      label: "Entity",
      cellClassName: "capitalize",
      renderCell: (a) => a.entity_type,
    },
    {
      id: "assignee",
      label: "Assignee",
      renderCell: (a) => a.assigned_to_name ?? "—",
    },
    {
      id: "status",
      label: "Status",
      renderCell: (a) => (
        <Badge variant="outline" className="text-[10px] capitalize">
          {a.status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      id: "due",
      label: "Due",
      cellClassName: "text-muted-foreground",
      renderCell: (a) => (a.due_at ? format(new Date(a.due_at), "MMM d, yyyy") : "—"),
    },
  ];
}

const APPROVALS_COLUMN_METAS = getOperationalTableColumnMetas(
  buildApprovalsColumns(() => {})
);

export function CampaignWorkflowTab({ workspace }: CampaignWorkflowTabProps) {
  const [detailApprovalId, setDetailApprovalId] = useState<string | null>(null);
  const detailApproval = useMemo(
    () =>
      detailApprovalId
        ? (workspace.approvals.find((row) => row.id === detailApprovalId) ?? null)
        : null,
    [detailApprovalId, workspace.approvals]
  );

  const columns = useMemo(
    () => buildApprovalsColumns(setDetailApprovalId),
    []
  );

  return (
    <>
      <div className={cn("space-y-3.5", OPERATIONAL_TABLE_FONT)}>
        <CampaignFlatSection
          title="Workflow stages"
          description="Planning through closed — derived from assignment status and billing."
        >
          <div className="thinkway-campaign-workflow-stages">
            {WORKFLOW_STAGE_OPTIONS.map((stage) => {
              const isCurrent = stage.value === workspace.workflow_stage;
              return (
                <div
                  key={stage.value}
                  className={cn(
                    "thinkway-campaign-stage-btn inline-flex items-center",
                    isCurrent && "thinkway-campaign-stage-btn-active"
                  )}
                >
                  {stage.label}
                </div>
              );
            })}
          </div>
        </CampaignFlatSection>

        {workspace.blockers.length > 0 ? (
          <CampaignFlatSection
            title="Blockers"
            description="Items that need resolution before the campaign can be closed."
            flushBody
          >
            <ul className="thinkway-campaign-blockers-list">
              {workspace.blockers.map((b) => (
                <li key={b}>
                  <span className="thinkway-campaign-blocker-dot" aria-hidden />
                  {b}
                </li>
              ))}
            </ul>
          </CampaignFlatSection>
        ) : null}

        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.campaignApprovals}
          columns={columns}
          rows={workspace.approvals}
          filterAccessors={{
            approval: (row) => row.title ?? row.document_number,
            entity: (row) => row.entity_type,
            assignee: (row) => row.assigned_to_name,
            status: (row) => row.status,
            due: (row) => row.due_at,
          }}
        >
          <OperationalTableSection
            wide
            tableOnly
            cardSurface
            leading={
              <CampaignOperationalSectionHeader
                title="Approvals"
                description="Pending and completed approval steps for this campaign."
                actions={<OperationalTableControlsSlot contextLabel="Campaign approvals" />}
              />
            }
          >
            {workspace.approvals.length === 0 ? (
              <div className="thinkway-campaign-empty-state">
                <p>No approval records.</p>
              </div>
            ) : (
              <OperationalConfigurableTable
                columns={columns}
                rows={workspace.approvals}
                rowKey={(a) => a.id}
              />
            )}
          </OperationalTableSection>
        </OperationalTableSuiteProvider>
      </div>

      <ApprovalDetailSheet
        open={detailApprovalId != null}
        onOpenChange={(open) => {
          if (!open) setDetailApprovalId(null);
        }}
        row={detailApproval}
        campaignName={workspace.name}
      />
    </>
  );
}
