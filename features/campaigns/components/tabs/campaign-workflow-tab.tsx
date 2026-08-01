"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { Badge } from "@/components/ui/badge";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import {
  AuroraEmptyState,
  AuroraStatusPill,
  CampaignWorkspaceFrame,
} from "@/features/campaigns/components/aurora/campaign-workspace-frame";
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
  /** Deep-link from Decision Center (?approval=). */
  initialDetailApprovalId?: string | null;
};

type ApprovalRow = CampaignWorkspace["approvals"][number];

const WORKFLOW_STAGES = WORKFLOW_STAGE_OPTIONS.map((o) => o.value);

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

export function CampaignWorkflowTab({
  workspace,
  initialDetailApprovalId = null,
}: CampaignWorkflowTabProps) {
  const [detailApprovalId, setDetailApprovalId] = useState<string | null>(
    () => initialDetailApprovalId
  );

  useEffect(() => {
    if (!initialDetailApprovalId) return;
    if (workspace.approvals.some((row) => row.id === initialDetailApprovalId)) {
      setDetailApprovalId(initialDetailApprovalId);
    }
  }, [initialDetailApprovalId, workspace.approvals]);

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

  const stageIndex = WORKFLOW_STAGES.findIndex(
    (stage) => stage === workspace.workflow_stage
  );
  const currentLabel =
    WORKFLOW_STAGE_OPTIONS.find((s) => s.value === workspace.workflow_stage)?.label ??
    workspace.workflow_stage;

  const pendingApprovals = workspace.approvals.filter(
    (a) => a.status !== "approved" && a.status !== "rejected" && a.status !== "cancelled"
  ).length;

  return (
    <>
      <CampaignWorkspaceFrame
        title="Workflow"
        subtitle="Derived from assignment status & billing"
        status={<AuroraStatusPill tone="blue">{currentLabel}</AuroraStatusPill>}
        stats={[
          {
            key: "blockers",
            label: "Open issues",
            value: String(workspace.blockers.length),
            tone: workspace.blockers.length > 0 ? "amber" : "mut",
          },
          {
            key: "approvals",
            label: "Approvals",
            value: String(workspace.approvals.length),
          },
          {
            key: "pending",
            label: "Pending",
            value: String(pendingApprovals),
            tone: pendingApprovals > 0 ? "amber" : "pos",
          },
        ]}
        banner={
          <div className="thinkway-aurora-flow" aria-label="Workflow stages">
            {WORKFLOW_STAGE_OPTIONS.map((stage, index) => {
              const done = stageIndex >= 0 && index < stageIndex;
              const now = stageIndex === index;
              return (
                <div key={stage.value} className="contents">
                  {index > 0 ? (
                    <span className="thinkway-aurora-farrow" aria-hidden />
                  ) : null}
                  <span
                    className={cn(
                      "thinkway-aurora-fstep",
                      done && "done",
                      now && "now"
                    )}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        }
        registerLabel="Approvals"
        collapseRegister
        registerCount={workspace.approvals.length}
        registerStorageKey={`workflow-${workspace.id}`}
        forceRegisterOpen={Boolean(initialDetailApprovalId)}
      >
        <div className={cn(OPERATIONAL_TABLE_FONT)}>
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
                  actionsOnly
                  actions={
                    <OperationalTableControlsSlot contextLabel="Campaign approvals" />
                  }
                />
              }
            >
              {workspace.approvals.length === 0 ? (
                <AuroraEmptyState
                  title="No approval records yet."
                  description="This register fills when Client IO, Vendor IO, or billing needs sign-off. Decision Center owns why work is waiting — open the next action there. Operations / Commercial own the clearance path."
                />
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
      </CampaignWorkspaceFrame>

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
