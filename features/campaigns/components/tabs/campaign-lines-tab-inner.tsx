"use client";

import dynamic from "next/dynamic";
import { PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useRefreshCampaignAfterOperationalMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";

import { Button } from "@/components/ui/button";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { OperationalTableDualColumnsProvider } from "@/components/tables/operational-table-column-context";
import { OperationalTableSettingsSlot } from "@/components/tables/operational-data-table";
import {
  ASSIGNMENT_CHILD_GRID_COLUMN_METAS,
  ASSIGNMENT_GRID_COLUMN_METAS,
  ASSIGNMENT_GRID_CHILD_TABLE_ID,
  ASSIGNMENT_GRID_PARENT_TABLE_ID,
} from "@/lib/tables/assignment-grid-column-metas";
import type {
  AssignmentBillingGroup,
  CampaignOperationalBillingDetail,
} from "@/features/billing/types";
import { CampaignLineSheet } from "@/features/campaigns/components/campaign-line-sheet";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type {
  CampaignLineWorkspace,
  CampaignPoSummary,
  CampaignWorkspace,
} from "@/features/campaigns/types";
import type { OperationalSelectionPayload } from "@/lib/billing/operational-selection";
import {
  assignmentsLayerAtLeast,
  getAssignmentsUiLayer,
} from "@/lib/campaigns/assignments-ui-layer";
import { logAssignmentsStage } from "@/lib/campaigns/assignments-render-log";
import { useRegisterShortcut } from "@/lib/productivity/keyboard-shortcuts";

import {
  CampaignCreatorDiscoveryFooter,
  CampaignCreatorDiscoveryProvider,
} from "@/features/campaigns/components/campaign-creator-discovery-panel";
import { AssignmentsEmptyState } from "@/features/campaigns/components/assignments-empty-state";
import {
  AuroraStatusPill,
  CampaignWorkspaceFrame,
} from "@/features/campaigns/components/aurora/campaign-workspace-frame";
import { AssignmentAudienceViewProvider } from "@/features/campaigns/components/assignment-hierarchy/assignment-audience-view-context";
import { AssignmentAudienceViewToggle } from "@/features/campaigns/components/assignment-hierarchy/assignment-audience-view-toggle";
import {
  AssignmentGridEditSessionProvider,
  AssignmentGridEditSessionToolbar,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-edit-session";
import { AssignmentCommercialWorkspaceDialog } from "@/features/campaigns/components/assignment-commercial-workspace-dialog";
import { AssignmentInfluencerDetailSheet } from "@/features/campaigns/components/assignment-hierarchy/assignment-influencer-detail-sheet";
import { AssignmentSafeGrid } from "@/features/campaigns/components/assignment-hierarchy/assignment-safe-grid";
import { tryBuildAssignmentRowViewModel } from "@/lib/campaigns/assignment-row-view-model";
import type { AssignmentAudienceView } from "@/lib/campaigns/assignment-audience-view";
import { useInvoiceConfirmFlow } from "@/features/billing/hooks/use-invoice-confirm-flow";

const CreateInvoiceSheet = dynamic(
  () =>
    import("@/features/billing/components/create-invoice-sheet").then(
      (m) => m.CreateInvoiceSheet
    ),
  { ssr: false }
);


type CampaignLinesTabInnerProps = {
  workspace: CampaignWorkspace;
  po: CampaignPoSummary;
  currencyOptions: { value: string; label: string }[];
  assignmentHierarchy: AssignmentHierarchy;
  billingGroups: AssignmentBillingGroup[];
  operationalBilling: CampaignOperationalBillingDetail | null;
  /** Deep-link from Decision Center (?line=) — opens assignment detail sheet. */
  initialFocusLineId?: string | null;
};

export function CampaignLinesTabInner({
  workspace,
  po,
  currencyOptions,
  assignmentHierarchy,
  billingGroups,
  operationalBilling,
  initialFocusLineId = null,
}: CampaignLinesTabInnerProps) {
  const refreshAfterOperationalMutation = useRefreshCampaignAfterOperationalMutation();
  const uiLayer = getAssignmentsUiLayer();
  const enableLineSheet = assignmentsLayerAtLeast(uiLayer, "operational_actions");
  const hasAssignments = workspace.lines.length > 0;
  const enableInvoiceDialogs = assignmentsLayerAtLeast(uiLayer, "invoice_dialogs");
  const invoiceConfirm = useInvoiceConfirmFlow({
    campaignId: workspace.id,
    campaignName: workspace.name,
    campaignNo: workspace.document_number,
    currency: workspace.currency_code,
    operationalBilling,
    onComplete: refreshAfterOperationalMutation,
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignLineWorkspace | null>(null);
  const [audienceView, setAudienceView] = useState<AssignmentAudienceView>("internal");
  const [detailLineId, setDetailLineId] = useState<string | null>(
    () => initialFocusLineId
  );

  useEffect(() => {
    if (!initialFocusLineId) return;
    if (assignmentHierarchy.groups.some((g) => g.line.id === initialFocusLineId)) {
      setDetailLineId(initialFocusLineId);
    }
  }, [initialFocusLineId, assignmentHierarchy.groups]);

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

  useEffect(() => {
    logAssignmentsStage("inner tab mounted", {
      campaignId: workspace.id,
      uiLayer,
      groupCount: assignmentHierarchy.groups?.length ?? 0,
    });
  }, [workspace.id, uiLayer, assignmentHierarchy.groups?.length]);

  function openCreate() {
    if (!enableLineSheet) return;
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(line: CampaignLineWorkspace) {
    if (!enableLineSheet) return;
    setEditing(line);
    setSheetOpen(true);
  }

  function openInvoiceWithLines(selection: OperationalSelectionPayload) {
    if (!enableInvoiceDialogs || invoiceConfirm.pending) return;
    if (!operationalBilling) {
      setInvoiceOpen(true);
      return;
    }
    invoiceConfirm.requestConfirm(selection);
  }

  useRegisterShortcut({
    id: "campaign-add-assignment",
    keys: "a",
    label: "Add assignment",
    group: "Campaign",
    global: true,
    handler: () => openCreate(),
  });

  useEffect(() => {
    logAssignmentsStage("table render scheduled", { campaignId: workspace.id });
  }, [workspace.id]);

  const assignedCount = workspace.lines.filter(
    (line) => Boolean(line.influencer_id?.trim()) || Boolean(line.campaign_influencer_id?.trim())
  ).length;
  const deliverableCount = assignmentHierarchy.groups.reduce(
    (sum, group) => sum + (group.deliverables?.length ?? 0),
    0
  );
  const completedCount = workspace.lines.filter((line) =>
    ["posted", "verified", "invoiced", "paid", "closed"].includes(line.assignment_status)
  ).length;
  const readyCount = workspace.lines.filter((line) =>
    ["approved", "scheduled"].includes(line.assignment_status)
  ).length;
  const blockedCount = workspace.lines.filter((line) => {
    const unassigned =
      !line.influencer_id?.trim() && !line.campaign_influencer_id?.trim();
    return unassigned || line.assignment_status === "draft";
  }).length;
  const progressPercent =
    workspace.lines.length > 0
      ? Math.round((completedCount / workspace.lines.length) * 100)
      : 0;
  const completionPercent =
    workspace.lines.length > 0
      ? Math.round(
          (workspace.lines.filter((line) =>
            ["verified", "invoiced", "paid", "closed"].includes(line.assignment_status)
          ).length /
            workspace.lines.length) *
            100
        )
      : 0;

  return (
    <>
      <CampaignWorkspaceFrame
        title="Assignments"
        subtitle="Operational creator assignments, progress, and delivery readiness"
        status={
          <AuroraStatusPill tone={assignedCount > 0 ? "green" : "mut"}>
            {assignedCount}/{workspace.lines.length} assigned
          </AuroraStatusPill>
        }
        stats={[
          {
            key: "assignments",
            label: "Assignments",
            value: String(workspace.lines.length),
          },
          {
            key: "creators",
            label: "Creators",
            value: String(assignedCount),
            tone: "blue",
          },
          {
            key: "deliverables",
            label: "Deliverables",
            value: String(deliverableCount),
          },
          {
            key: "progress",
            label: "Progress",
            value: `${progressPercent}%`,
            tone: progressPercent >= 50 ? "pos" : "mut",
          },
          {
            key: "completion",
            label: "Completion",
            value: `${completionPercent}%`,
            tone: completionPercent >= 50 ? "pos" : "mut",
          },
          {
            key: "blocked",
            label: "Blocked",
            value: String(blockedCount),
            tone: blockedCount > 0 ? "amber" : "mut",
          },
          {
            key: "ready",
            label: "Ready",
            value: String(readyCount),
            tone: readyCount > 0 ? "blue" : "mut",
          },
        ]}
        registerLabel="Creators"
        collapseRegister
        defaultRegisterOpen
        registerCount={workspace.lines.length}
        registerStorageKey={`assignments-${workspace.id}`}
        forceRegisterOpen={Boolean(initialFocusLineId)}
        tools={
          enableLineSheet && audienceView === "internal" ? (
            <Button
              size="sm"
              onClick={openCreate}
              title="Create assignment (A)"
              className="thinkway-campaign-btn thinkway-campaign-btn-primary"
            >
              <PlusIcon data-icon="inline-start" className="size-3.5" />
              Create assignment
            </Button>
          ) : undefined
        }
      >
      <CampaignCreatorDiscoveryProvider
        campaignHeaderId={workspace.id}
        campaignName={workspace.name}
        brandCountry={workspace.vat_context.client_country_code}
      >
        <OperationalTableDualColumnsProvider
          parentTableId={ASSIGNMENT_GRID_PARENT_TABLE_ID}
          parentColumns={ASSIGNMENT_GRID_COLUMN_METAS}
          childTableId={ASSIGNMENT_GRID_CHILD_TABLE_ID}
          childColumns={ASSIGNMENT_CHILD_GRID_COLUMN_METAS}
        >
          <AssignmentGridEditSessionProvider
            enabled={enableLineSheet && audienceView === "internal"}
          >
          <OperationalTableSection
            wide
            tableOnly
            cardSurface
            assignmentsShell
            footer={<CampaignCreatorDiscoveryFooter />}
            leading={
              <CampaignOperationalSectionHeader
                title="Assignments"
                actionsOnly
                actions={
                  <>
                    <AssignmentGridEditSessionToolbar />
                    <AssignmentAudienceViewToggle
                      value={audienceView}
                      onChange={setAudienceView}
                    />
                    <AssignmentCommercialWorkspaceDialog
                      campaignId={workspace.id}
                      currencyCode={workspace.currency_code}
                      hierarchy={assignmentHierarchy}
                      canManage={enableLineSheet}
                    />
                    <OperationalTableSettingsSlot
                      contextLabel="Assignments"
                      columnSettings="assignment-grid"
                    />
                  </>
                }
              />
            }
          >
            {!hasAssignments ? (
              <AssignmentsEmptyState
                campaignId={workspace.id}
                quotationId={workspace.quotation_id}
                onCreateAssignment={enableLineSheet ? openCreate : undefined}
              />
            ) : (
              <>
                {assignmentHierarchy.load_error ? (
                  <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                    Assignment hierarchy loaded with warnings: {assignmentHierarchy.load_error}.
                    Showing available rows — apply pending migrations if commercial columns are
                    missing.
                  </div>
                ) : null}
                <AssignmentAudienceViewProvider value={audienceView}>
                  <AssignmentSafeGrid
                    campaignId={workspace.id}
                    hierarchy={assignmentHierarchy}
                    campaignPoExceeded={workspace.financials.po_exceeded}
                    onEditLine={openEdit}
                    onOpenInfluencerDetail={(group) => setDetailLineId(group.line.id)}
                    onInvoiceLines={openInvoiceWithLines}
                    invoicePending={invoiceConfirm.pending}
                    onCreateAssignment={enableLineSheet ? openCreate : undefined}
                  />
                </AssignmentAudienceViewProvider>
              </>
            )}
          </OperationalTableSection>
          </AssignmentGridEditSessionProvider>
        </OperationalTableDualColumnsProvider>
      </CampaignCreatorDiscoveryProvider>
      </CampaignWorkspaceFrame>

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
        audienceView={audienceView}
        onEdit={
          detailTarget && enableLineSheet
            ? () => {
                const line = detailTarget.group.line;
                setDetailLineId(null);
                openEdit(line);
              }
            : undefined
        }
      />

      {enableLineSheet && sheetOpen ? (
        <CampaignLineSheet
          campaignId={workspace.id}
          currencyCode={workspace.currency_code}
          defaultRevenueVatPercent={workspace.vat_context.default_revenue_vat_percent}
          clientCountryCode={workspace.vat_context.client_country_code}
          po={po}
          currencyOptions={currencyOptions}
          line={editing}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          hasIssuedClientIo={Boolean(
            workspace.client_io &&
              ["sent", "under_client_review", "approved", "rejected"].includes(
                workspace.client_io.status
              )
          )}
        />
      ) : null}

      {enableInvoiceDialogs ? invoiceConfirm.confirmDialog : null}

      {enableInvoiceDialogs && invoiceOpen && !operationalBilling ? (
        <CreateInvoiceSheet
          campaignId={workspace.id}
          groups={billingGroups}
          currency={workspace.currency_code}
          open={invoiceOpen}
          onOpenChange={setInvoiceOpen}
        />
      ) : null}

    </>
  );
}
