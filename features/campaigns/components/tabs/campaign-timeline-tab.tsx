"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import {
  AuroraEmptyState,
  AuroraStatusPill,
  CampaignWorkspaceFrame,
} from "@/features/campaigns/components/aurora/campaign-workspace-frame";
import { AssignmentInfluencerDetailSheet } from "@/features/campaigns/components/assignment-hierarchy/assignment-influencer-detail-sheet";
import { ActivityDetailSheet } from "@/features/campaigns/components/detail-sheets/activity-detail-sheet";
import { DetailClickableLabel } from "@/features/campaigns/components/detail-sheets/detail-clickable-label";
import { FinanceAuditDetailSheet } from "@/features/campaigns/components/detail-sheets/finance-audit-detail-sheet";
import { OPERATIONAL_TABLE_FONT } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { DocumentNumber } from "@/components/ui/document-number";
import { campaignLifecycleFromWorkspace } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { CampaignBusinessTimeline } from "@/features/campaigns/lifecycle/components/campaign-business-timeline";
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
  /** Soft status for the Finance audit panel only — never gates Enterprise Timeline. */
  financeAuditStatus?: "idle" | "loading" | "loaded" | "error";
  /** Deep-link (?activity=) opens the activity detail sheet. */
  initialDetailActivityId?: string | null;
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

export function CampaignTimelineTab({
  workspace,
  assignmentHierarchy,
  financeAudit = [],
  financeAuditStatus = "loaded",
  initialDetailActivityId = null,
}: CampaignTimelineTabProps) {
  const financeAuditPending =
    financeAuditStatus === "idle" || financeAuditStatus === "loading";
  const [detailActivityId, setDetailActivityId] = useState<string | null>(
    () => initialDetailActivityId
  );
  const [detailAuditId, setDetailAuditId] = useState<string | null>(null);
  const [detailLineId, setDetailLineId] = useState<string | null>(null);

  useEffect(() => {
    if (!initialDetailActivityId) return;
    if (workspace.activity.some((row) => row.id === initialDetailActivityId)) {
      setDetailActivityId(initialDetailActivityId);
    }
  }, [initialDetailActivityId, workspace.activity]);

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

  const recentActivity = workspace.activity.slice(0, 5);
  const recentAudit = financeAudit.slice(0, 5);
  const lifecycle = useMemo(
    () => campaignLifecycleFromWorkspace(workspace),
    [workspace]
  );
  const occurredCount = lifecycle.timeline.filter((event) => event.occurred).length;

  return (
    <>
      <CampaignWorkspaceFrame
        title="Business Timeline"
        subtitle="Campaign journey milestones — system activity remains secondary"
        collapseRegister
        registerCount={workspace.vendors.length}
        registerStorageKey={`timeline-${workspace.id}`}
        forceRegisterOpen={Boolean(initialDetailActivityId)}
        status={
          <AuroraStatusPill tone={occurredCount > 0 ? "blue" : "mut"}>
            {occurredCount}/{lifecycle.timeline.length} milestones
          </AuroraStatusPill>
        }
        stats={[
          {
            key: "milestones",
            label: "Milestones",
            value: String(occurredCount),
            tone: "blue",
          },
          {
            key: "activity",
            label: "System Events",
            value: String(workspace.activity.length),
            tone: "mut",
          },
          {
            key: "approvals",
            label: "Approvals",
            value: String(workspace.approvals.length),
            tone: "mut",
          },
          {
            key: "audit",
            label: "Finance Events",
            value: financeAuditPending ? "…" : String(financeAudit.length),
          },
        ]}
        banner={
          <div className="mb-4 space-y-3">
            <CampaignBusinessTimeline lifecycle={lifecycle} />
            <details className="thinkway-lc-timeline-secondary">
              <summary>
                Secondary records · System activity & finance audit ({workspace.activity.length + financeAudit.length})
              </summary>
              <div className="thinkway-lc-timeline-secondary-body grid grid-cols-1 gap-3 xl:grid-cols-2">
                <div className="thinkway-aurora-doc-panel">
                  <div className="eyebrow">System activity</div>
                  {recentActivity.length === 0 ? (
                    <p className="py-6 text-center text-[13px] text-[var(--camp-text-4)]">
                      Technical database events stay here — the business story is above.
                    </p>
                  ) : (
                    <div className="thinkway-aurora-tl-feed">
                      {recentActivity.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="thinkway-aurora-tl-row w-full text-left"
                          onClick={() => setDetailActivityId(item.id)}
                        >
                          <span className="thinkway-aurora-tl-ic" aria-hidden>
                            ↻
                          </span>
                          <div className="min-w-0">
                            <div className="thinkway-aurora-tl-t1 truncate capitalize">
                              {item.summary}
                            </div>
                            <div className="thinkway-aurora-tl-t2 truncate">
                              {item.actor?.full_name ?? item.actor?.email ?? "System"}
                            </div>
                          </div>
                          <time className="thinkway-aurora-tl-when">
                            {format(new Date(item.created_at), "MMM d · HH:mm")}
                          </time>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="thinkway-aurora-doc-panel">
                  <div className="eyebrow">Finance audit</div>
                  {financeAuditPending && financeAudit.length === 0 ? (
                    <p className="py-6 text-center text-[13px] text-[var(--camp-text-4)]">
                      Loading finance audit…
                    </p>
                  ) : recentAudit.length === 0 ? (
                    <p className="py-6 text-center text-[13px] text-[var(--camp-text-4)]">
                      No finance audit yet — invoice and payment events will appear here.
                    </p>
                  ) : (
                    <div className="thinkway-aurora-tl-feed">
                      {recentAudit.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          className="thinkway-aurora-tl-row w-full text-left"
                          onClick={() => setDetailAuditId(entry.id)}
                        >
                          <span className="thinkway-aurora-tl-ic" aria-hidden>
                            $
                          </span>
                          <div className="min-w-0">
                            <div className="thinkway-aurora-tl-t1 truncate">{entry.label}</div>
                            <div className="thinkway-aurora-tl-t2 truncate">
                              {entry.actor_name ?? "System"}
                              {entry.payload.document_number
                                ? ` · ${String(entry.payload.document_number)}`
                                : ""}
                            </div>
                          </div>
                          <time className="thinkway-aurora-tl-when">
                            {format(new Date(entry.created_at), "MMM d · HH:mm")}
                          </time>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </details>
          </div>
        }
        registerLabel="Recent assignments"
      >
        <div className={cn(OPERATIONAL_TABLE_FONT)}>
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
              leading={
                <CampaignOperationalSectionHeader
                  title="Assignments"
                  actionsOnly
                  actions={
                    <OperationalTableControlsSlot contextLabel="Campaign timeline vendors" />
                  }
                />
              }
            >
              {vendorRows.length === 0 ? (
                <AuroraEmptyState
                  title="No vendor assignments yet."
                  description="Create assignments to populate recent creator activity on this timeline."
                />
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
      </CampaignWorkspaceFrame>

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
