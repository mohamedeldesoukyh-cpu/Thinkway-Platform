"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

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

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

// Preserve browser-local dates without differing from the server during hydration.
function TimelineLocalDate({ value, pattern }: { value: string; pattern: string }) {
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  return hydrated ? format(new Date(value), pattern) : "…";
}

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
        v.confirmed_at ? <TimelineLocalDate value={v.confirmed_at} pattern="MMM d, yyyy" /> : "—",
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

  const lifecycle = useMemo(
    () => campaignLifecycleFromWorkspace(workspace),
    [workspace]
  );
  const occurredCount = lifecycle.timeline.filter((event) => event.occurred).length;

  return (
    <>
      <CampaignWorkspaceFrame
        title="Timeline & audit"
        subtitle="Read-only event history · campaign journey milestones"
        tools={<span className="wr-secondary">{workspace.activity.length + financeAudit.length} events · read-only</span>}
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
            <section className="wr-audit-register" aria-label="Timeline and audit register">
              <div className="wr-audit-scroll"><table>
                <colgroup><col style={{ width: 148 }} /><col style={{ width: 108 }} /><col /><col style={{ width: 150 }} /><col style={{ width: 160 }} /><col style={{ width: 180 }} /></colgroup>
                <thead><tr><th scope="col">When</th><th scope="col">Kind</th><th scope="col">Event</th><th scope="col">Entity</th><th scope="col">Actor</th><th scope="col">Event code</th></tr></thead>
                <tbody>
                  {workspace.activity.map(item => <tr key={`activity-${item.id}`}>
                    <td className="wr-audit-time"><TimelineLocalDate value={item.created_at} pattern="MMM d, yyyy · HH:mm" /></td>
                    <td><AuroraStatusPill tone="mut">System</AuroraStatusPill></td>
                    <td><button type="button" onClick={() => setDetailActivityId(item.id)}>{item.summary}</button></td>
                    <td>{item.entity_type}</td><td>{item.actor?.full_name ?? item.actor?.email ?? "System"}</td><td className="wr-audit-time">{item.action}</td>
                  </tr>)}
                  {financeAudit.map(entry => <tr key={`audit-${entry.id}`}>
                    <td className="wr-audit-time"><TimelineLocalDate value={entry.created_at} pattern="MMM d, yyyy · HH:mm" /></td>
                    <td><AuroraStatusPill tone="blue">Finance</AuroraStatusPill></td>
                    <td><button type="button" onClick={() => setDetailAuditId(entry.id)}>{entry.label}</button>{entry.payload.document_number ? <span className="wr-secondary">{String(entry.payload.document_number)}</span> : null}</td>
                    <td>{entry.entity_type}</td><td>{entry.actor_name ?? "System"}</td><td className="wr-audit-time">{entry.event}</td>
                  </tr>)}
                  {workspace.activity.length + financeAudit.length === 0 ? <tr><td colSpan={6}>{financeAuditPending ? "Loading finance audit…" : "No audit events recorded yet."}</td></tr> : null}
                </tbody>
              </table></div>
              {financeAuditPending && workspace.activity.length > 0 ? <p className="px-4 py-2 text-xs text-muted-foreground">Loading finance audit…</p> : null}
            </section>
            <details className="wr-timeline-milestones" open>
              <summary>Business milestones · {occurredCount}/{lifecycle.timeline.length}</summary>
              <CampaignBusinessTimeline lifecycle={lifecycle} />
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
