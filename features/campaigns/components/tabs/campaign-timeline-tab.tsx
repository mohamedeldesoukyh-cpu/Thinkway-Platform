"use client";

import { format } from "date-fns";

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
import { OPERATIONAL_TABLE_FONT } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { FinanceAuditTimeline } from "@/components/finance/finance-audit-timeline";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import type { FinanceAuditTimelineEntry } from "@/lib/finance/queries/finance-audit";
import { cn } from "@/lib/utils";

type CampaignTimelineTabProps = {
  workspace: CampaignWorkspace;
  financeAudit?: FinanceAuditTimelineEntry[];
};

export function CampaignTimelineTab({
  workspace,
  financeAudit = [],
}: CampaignTimelineTabProps) {
  return (
    <div className={cn("grid gap-4 xl:grid-cols-2", OPERATIONAL_TABLE_FONT)}>
      <CampaignFlatSection
        title="Finance audit"
        description="Invoice, CN/DN, posting, and cancellation events."
      >
        <FinanceAuditTimeline entries={financeAudit} />
      </CampaignFlatSection>
      <CampaignFlatSection
        title="Activity feed"
        description="Edits, uploads, approvals, status changes, and assignments."
      >
        {workspace.activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {workspace.activity.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 border-b border-border/40 pb-3 last:border-0 last:pb-0"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium capitalize">{item.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.actor?.full_name ?? item.actor?.email ?? "System"}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {format(new Date(item.created_at), "MMM d, yyyy HH:mm")}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CampaignFlatSection>

      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <CampaignOperationalSectionHeader
            title="Recent assignments"
            description="Latest vendor assignments on this campaign."
          />
        }
      >
        {workspace.vendors.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">No vendor assignments.</p>
        ) : (
          <CampaignOperationalTable>
            <CampaignOperationalTableHeader>
              <CampaignOperationalTableHeaderRow>
                <CampaignOperationalTableHead>Vendor</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>Line</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>Status</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>Confirmed</CampaignOperationalTableHead>
              </CampaignOperationalTableHeaderRow>
            </CampaignOperationalTableHeader>
            <CampaignOperationalTableBody>
              {workspace.vendors.slice(0, 10).map((v) => (
                <CampaignOperationalTableRow key={v.id}>
                  <CampaignOperationalTableCell>{v.influencer_name}</CampaignOperationalTableCell>
                  <CampaignOperationalTableCellMono>
                    {v.line_document_number ?? "—"}
                  </CampaignOperationalTableCellMono>
                  <CampaignOperationalTableCell className="capitalize">{v.status}</CampaignOperationalTableCell>
                  <CampaignOperationalTableCell className="text-muted-foreground">
                    {v.confirmed_at
                      ? format(new Date(v.confirmed_at), "MMM d, yyyy")
                      : "—"}
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
