"use client";

import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import {
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableCell,
  CampaignOperationalTableCellMono,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
import { WORKFLOW_STAGE_OPTIONS } from "@/features/campaigns/constants";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { DocumentNumber } from "@/components/ui/document-number";
import { OPERATIONAL_TABLE_FONT } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { cn } from "@/lib/utils";

type CampaignWorkflowTabProps = {
  workspace: CampaignWorkspace;
};

export function CampaignWorkflowTab({ workspace }: CampaignWorkflowTabProps) {
  const currentIndex = WORKFLOW_STAGE_OPTIONS.findIndex(
    (s) => s.value === workspace.workflow_stage
  );

  return (
    <div className={cn("space-y-4", OPERATIONAL_TABLE_FONT)}>
      <CampaignFlatSection
        title="Workflow stages"
        description="Planning through closed — derived from assignment status and billing."
      >
        <div className="flex flex-wrap gap-2">
          {WORKFLOW_STAGE_OPTIONS.map((stage, index) => {
            const isCurrent = stage.value === workspace.workflow_stage;
            const isPast = index < currentIndex;
            return (
              <div
                key={stage.value}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium",
                  isCurrent && "border-primary bg-primary text-primary-foreground",
                  isPast && !isCurrent && "border-primary/40 bg-primary/5",
                  !isCurrent && !isPast && "border-border text-muted-foreground"
                )}
              >
                {stage.label}
              </div>
            );
          })}
        </div>
      </CampaignFlatSection>

      {workspace.blockers.length > 0 ? (
        <CampaignFlatSection title="Blockers">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {workspace.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </CampaignFlatSection>
      ) : null}

      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <CampaignOperationalSectionHeader
            title="Approvals"
            description="Pending and completed approval steps for this campaign."
          />
        }
      >
        {workspace.approvals.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">No approval records.</p>
        ) : (
          <CampaignOperationalTable>
            <CampaignOperationalTableHeader>
              <CampaignOperationalTableHeaderRow>
                <CampaignOperationalTableHead>Approval</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>Entity</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>Assignee</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>Status</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>Due</CampaignOperationalTableHead>
              </CampaignOperationalTableHeaderRow>
            </CampaignOperationalTableHeader>
            <CampaignOperationalTableBody>
              {workspace.approvals.map((a) => (
                <CampaignOperationalTableRow key={a.id}>
                  <CampaignOperationalTableCell>
                    <div className="space-y-0.5">
                      <span className="font-medium">{a.title}</span>
                      <p className="text-[11px] text-muted-foreground">
                        <DocumentNumber value={a.document_number} />
                      </p>
                    </div>
                  </CampaignOperationalTableCell>
                  <CampaignOperationalTableCell className="capitalize">
                    {a.entity_type}
                  </CampaignOperationalTableCell>
                  <CampaignOperationalTableCell>{a.assigned_to_name ?? "—"}</CampaignOperationalTableCell>
                  <CampaignOperationalTableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {a.status.replace("_", " ")}
                    </Badge>
                  </CampaignOperationalTableCell>
                  <CampaignOperationalTableCell className="text-muted-foreground">
                    {a.due_at ? format(new Date(a.due_at), "MMM d, yyyy") : "—"}
                  </CampaignOperationalTableCell>
                </CampaignOperationalTableRow>
              ))}
            </CampaignOperationalTableBody>
          </CampaignOperationalTable>
        )}
      </OperationalTableSection>
    </div>
  );
}
