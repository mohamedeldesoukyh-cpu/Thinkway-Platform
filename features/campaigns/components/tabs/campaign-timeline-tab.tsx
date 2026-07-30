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
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { AssignmentInfluencerDetailSheet } from "@/features/campaigns/components/assignment-hierarchy/assignment-influencer-detail-sheet";
import { ActivityDetailSheet } from "@/features/campaigns/components/detail-sheets/activity-detail-sheet";
import { DetailClickableLabel } from "@/features/campaigns/components/detail-sheets/detail-clickable-label";
import { FinanceAuditDetailSheet } from "@/features/campaigns/components/detail-sheets/finance-audit-detail-sheet";
import { OPERATIONAL_TABLE_FONT } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { DocumentNumber } from "@/components/ui/document-number";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import type { FinanceAuditTimelineEntry } from "@/lib/finance/queries/finance-audit";
import { tryBuildAssignmentRowViewModel } from "@/lib/campaigns/assignment-row-view-model";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { cn } from "@/lib/utils";

type CampaignTimelineTabProps = {
  workspace: CampaignWorkspace;
  assignmentHierarchy: AssignmentHierarchy;
  financeAudit?: FinanceAuditTimelineEntry[];
};

type VendorRow = CampaignWorkspace["vendors"][number];

function buildTimelineVendorColumns(
  onOpenLine: (lineId: string) => void
): OperationalConfigurableColumnDef<VendorRow>[] {
  return [
    {
      id: "vendor",
      label: "Vendor",
      renderCell: (v) =>
        v.campaign_line_id ? (
          <DetailClickableLabel
            onClick={() => onOpenLine(v.campaign_line_id!)}
            title={`View ${v.influencer_name} assignment details`}
          >
            {v.influencer_name}
          </DetailClickableLabel>
        ) : (
          v.influencer_name
        ),
    },
    {
      id: "line",
      label: "Line",
      monoCell: true,
      renderCell: (v) =>
        v.campaign_line_id ? (
          <button
            type="button"
            onClick={() => onOpenLine(v.campaign_line_id!)}
            className="thinkway-campaign-link font-mono text-[11px]"
          >
            <DocumentNumber value={v.line_document_number} />
          </button>
        ) : (
          v.line_document_number ?? "—"
        ),
    },
    {
      id: "status",
      label: "Status",
      cellClassName: "capitalize",
      renderCell: (v) => v.status,
    },
    {
      id: "confirmed",
      label: "Confirmed",
      cellClassName: "text-[var(--camp-text-3)]",
      renderCell: (v) =>
        v.confirmed_at ? format(new Date(v.confirmed_at), "MMM d, yyyy") : "—",
    },
  ];
}

const TIMELINE_VENDOR_COLUMN_METAS = getOperationalTableColumnMetas(
  buildTimelineVendorColumns(() => {})
);

export function CampaignTimelineTab({
  workspace,
  assignmentHierarchy,
  financeAudit = [],
}: CampaignTimelineTabProps) {
  const [detailActivityId, setDetailActivityId] = useState<string | null>(null);
  const [detailAuditId, setDetailAuditId] = useState<string | null>(null);
  const [detailLineId, setDetailLineId] = useState<string | null>(null);

  const columns = useMemo(() => buildTimelineVendorColumns(setDetailLineId), []);
  const vendorRows = useMemo(() => workspace.vendors.slice(0, 10), [workspace.vendors]);

  const detailActivity = useMemo(
    () =>
      detailActivityId
        ? (workspace.activity.find((row) => row.id === detailActivityId) ?? null)
        : null,
    [detailActivityId, workspace.activity]
  );

  const detailAudit = useMemo(
    () =>
      detailAuditId ? (financeAudit.find((row) => row.id === detailAuditId) ?? null) : null,
    [detailAuditId, financeAudit]
  );

  const detailTarget = useMemo(() => {
    if (!detailLineId) return null;
    const group = assignmentHierarchy.groups.find((entry) => entry.line.id === detailLineId);
    if (!group) return null;
    const row = tryBuildAssignmentRowViewModel(group, {
      campaignId: workspace.id,
      billingContext: assignmentHierarchy.billing_context,
    });
    return row ? { group, row } : null;
  }, [
    detailLineId,
    assignmentHierarchy.groups,
    assignmentHierarchy.billing_context,
    workspace.id,
  ]);

  return (
    <>
      <div className={cn("thinkway-campaign-two-col", OPERATIONAL_TABLE_FONT)}>
        <CampaignFlatSection
          title="Finance audit"
          description="Invoice, CN/DN, posting, and cancellation events."
          flushBody
        >
          {financeAudit.length === 0 ? (
            <div className="thinkway-campaign-empty-state">
              <p>No finance audit events yet.</p>
            </div>
          ) : (
            <div className="thinkway-campaign-activity-scroll">
              {financeAudit.map((entry) => (
                <div key={entry.id} className="thinkway-campaign-activity-item">
                  <div>
                    <DetailClickableLabel
                      onClick={() => setDetailAuditId(entry.id)}
                      title={`View ${entry.label} details`}
                      className="thinkway-campaign-act-name"
                    >
                      {entry.label}
                    </DetailClickableLabel>
                    <p className="thinkway-campaign-act-by">
                      {entry.actor_name ?? "System"}
                      {entry.payload.document_number ? (
                        <span className="ml-1 font-mono">
                          · {String(entry.payload.document_number)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <time className="thinkway-campaign-act-date">
                    {format(new Date(entry.created_at), "MMM d, yyyy HH:mm")}
                  </time>
                </div>
              ))}
            </div>
          )}
        </CampaignFlatSection>

        <CampaignFlatSection
          title="Enterprise Timeline"
          description="Chronological campaign events from audit_logs (Assignments, Media Plan, operations)."
          flushBody
        >
          {workspace.activity.length === 0 ? (
            <div className="thinkway-campaign-empty-state">
              <p>No activity recorded yet.</p>
            </div>
          ) : (
            <div className="thinkway-campaign-activity-scroll">
              {workspace.activity.map((item) => (
                <div key={item.id} className="thinkway-campaign-activity-item">
                  <div>
                    <DetailClickableLabel
                      onClick={() => setDetailActivityId(item.id)}
                      title="View activity details"
                      className="thinkway-campaign-act-name capitalize"
                    >
                      {item.summary}
                    </DetailClickableLabel>
                    <p className="thinkway-campaign-act-by">
                      {item.actor?.full_name ?? item.actor?.email ?? "System"}
                    </p>
                  </div>
                  <time className="thinkway-campaign-act-date">
                    {format(new Date(item.created_at), "MMM d, yyyy HH:mm")}
                  </time>
                </div>
              ))}
            </div>
          )}
        </CampaignFlatSection>

        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.campaignTimelineVendors}
          columns={columns}
          rows={vendorRows}
          filterAccessors={{
            vendor: (row) => row.influencer_name,
            line: (row) => row.line_document_number,
            status: (row) => row.status,
            confirmed: (row) => row.confirmed_at,
          }}
        >
          <OperationalTableSection
            wide
            tableOnly
            cardSurface
            className="xl:col-span-2"
            leading={
              <CampaignOperationalSectionHeader
                title="Recent assignments"
                description="Latest vendor assignments on this campaign."
                actions={<OperationalTableControlsSlot contextLabel="Campaign timeline vendors" />}
              />
            }
          >
            {vendorRows.length === 0 ? (
              <div className="thinkway-campaign-empty-state">
                <p>No vendor assignments.</p>
              </div>
            ) : (
              <OperationalConfigurableTable
                columns={columns}
                rows={vendorRows}
                rowKey={(v) => v.id}
              />
            )}
          </OperationalTableSection>
        </OperationalTableSuiteProvider>
      </div>

      <ActivityDetailSheet
        open={detailActivityId != null}
        onOpenChange={(open) => {
          if (!open) setDetailActivityId(null);
        }}
        row={detailActivity}
        campaignName={workspace.name}
      />

      <FinanceAuditDetailSheet
        open={detailAuditId != null}
        onOpenChange={(open) => {
          if (!open) setDetailAuditId(null);
        }}
        row={detailAudit}
        campaignName={workspace.name}
      />

      <AssignmentInfluencerDetailSheet
        open={detailLineId != null}
        onOpenChange={(open) => {
          if (!open) setDetailLineId(null);
        }}
        campaignName={workspace.name}
        accountManager={workspace.account_manager}
        clientIoStatus={workspace.client_io?.status ?? null}
        group={detailTarget?.group ?? null}
        row={detailTarget?.row ?? null}
      />
    </>
  );
}
