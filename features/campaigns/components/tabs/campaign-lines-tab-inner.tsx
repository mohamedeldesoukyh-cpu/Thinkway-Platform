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
  enrichRegenerationEligibilityInput,
  resolveInvoiceActionForSelection,
  selectionRequiresRegenerateDialog,
} from "@/lib/billing/regeneration-eligibility";
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
import { AssignmentAudienceViewProvider } from "@/features/campaigns/components/assignment-hierarchy/assignment-audience-view-context";
import { AssignmentAudienceViewToggle } from "@/features/campaigns/components/assignment-hierarchy/assignment-audience-view-toggle";
import { AssignmentInfluencerDetailSheet } from "@/features/campaigns/components/assignment-hierarchy/assignment-influencer-detail-sheet";
import { AssignmentSafeGrid } from "@/features/campaigns/components/assignment-hierarchy/assignment-safe-grid";
import type { AssignmentHierarchyGroup } from "@/features/campaigns/types/assignment-hierarchy";
import { tryBuildAssignmentRowViewModel } from "@/lib/campaigns/assignment-row-view-model";
import type { AssignmentAudienceView } from "@/lib/campaigns/assignment-audience-view";

const CreateInvoiceSheet = dynamic(
  () =>
    import("@/features/billing/components/create-invoice-sheet").then(
      (m) => m.CreateInvoiceSheet
    ),
  { ssr: false }
);

const InvoiceGenerationSheet = dynamic(
  () =>
    import("@/features/billing/components/invoice-generation-sheet").then(
      (m) => m.InvoiceGenerationSheet
    ),
  { ssr: false }
);

const InvoiceTargetChoiceDialog = dynamic(
  () =>
    import("@/features/billing/components/invoice-target-choice-dialog").then(
      (m) => m.InvoiceTargetChoiceDialog
    ),
  { ssr: false }
);

const RegenerateInvoiceDialog = dynamic(
  () =>
    import("@/features/billing/components/regenerate-invoice-dialog").then(
      (m) => m.RegenerateInvoiceDialog
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
};

export function CampaignLinesTabInner({
  workspace,
  po,
  currencyOptions,
  assignmentHierarchy,
  billingGroups,
  operationalBilling,
}: CampaignLinesTabInnerProps) {
  const refreshAfterOperationalMutation = useRefreshCampaignAfterOperationalMutation();
  const uiLayer = getAssignmentsUiLayer();
  const enableLineSheet = assignmentsLayerAtLeast(uiLayer, "operational_actions");
  const hasAssignments = workspace.lines.length > 0;
  const enableInvoiceDialogs = assignmentsLayerAtLeast(uiLayer, "invoice_dialogs");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceChoiceOpen, setInvoiceChoiceOpen] = useState(false);
  const [invoiceTargetMode, setInvoiceTargetMode] = useState<"new" | "append">("new");
  const [appendInvoiceId, setAppendInvoiceId] = useState<string | undefined>();
  const [invoiceSelection, setInvoiceSelection] = useState<
    OperationalSelectionPayload | undefined
  >();
  const [regenerateInvoiceOpen, setRegenerateInvoiceOpen] = useState(false);
  const [regenerateSelection, setRegenerateSelection] = useState<
    OperationalSelectionPayload | undefined
  >();
  const [editing, setEditing] = useState<CampaignLineWorkspace | null>(null);
  const [audienceView, setAudienceView] = useState<AssignmentAudienceView>("internal");
  const [detailLineId, setDetailLineId] = useState<string | null>(null);

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

  const pendingRegenerationInvoice =
    operationalBilling?.appendable_invoices?.find(
      (invoice) => invoice.regeneration_status === "pending_regeneration"
    ) ??
    (assignmentHierarchy.billing_context?.pending_regeneration_invoice_id
      ? {
          id: assignmentHierarchy.billing_context.pending_regeneration_invoice_id,
          document_number: workspace.invoices?.find(
            (invoice) =>
              invoice.id === assignmentHierarchy.billing_context?.pending_regeneration_invoice_id
          )?.document_number ?? "Invoice",
        }
      : null);

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

  function lineEligibilityInput(lineId: string) {
    const group = assignmentHierarchy.groups.find((g) => g.line.id === lineId);
    if (!group) return null;
    const line = group.line;
    return enrichRegenerationEligibilityInput(
      {
        billing_status: line.billing_status,
        operational_status: line.operational_status,
        vendor_io_id: line.vendor_io_id,
        active_vendor_io_id: line.active_vendor_io_id,
        vendor_io_document_number: line.vendor_io_document_number,
        invoice_id: line.invoice_id,
        finance_override_until: line.finance_override_until,
        invoiced_amount: group.rollups?.invoiced_value,
        billable_amount: group.rollups?.revenue ?? line.revenue_before_vat ?? line.revenue,
        remaining_amount: group.rollups?.remaining_value,
      },
      assignmentHierarchy.billing_context
    );
  }

  function openInvoiceWithLines(selection: OperationalSelectionPayload) {
    if (!enableInvoiceDialogs || !operationalBilling) return;

    const selectedLineIds = selection.line_ids ?? [];
    const invoiceAction = resolveInvoiceActionForSelection({
      lineIds: selectedLineIds,
      getRow: lineEligibilityInput,
    });

    if (
      pendingRegenerationInvoice &&
      selectionRequiresRegenerateDialog(
        selectedLineIds,
        lineEligibilityInput,
        assignmentHierarchy.billing_context
      )
    ) {
      setRegenerateSelection({
        ...selection,
        line_ids: invoiceAction.regenerateLineIds,
      });
      setRegenerateInvoiceOpen(true);
      return;
    }

    const generateSelection: OperationalSelectionPayload = {
      ...selection,
      line_ids: invoiceAction.generateLineIds,
    };

    const eligible = (operationalBilling.appendable_invoices ?? []).filter(
      (inv) =>
        !inv.is_locked &&
        inv.status !== "void" &&
        inv.status !== "paid" &&
        inv.regeneration_status !== "pending_regeneration"
    );
    if (eligible.length > 0) {
      setInvoiceSelection(generateSelection);
      setInvoiceChoiceOpen(true);
      return;
    }
    setInvoiceTargetMode("new");
    setAppendInvoiceId(undefined);
    setInvoiceSelection(generateSelection);
    setInvoiceOpen(true);
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

  return (
    <>
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
          <OperationalTableSection
            wide
            tableOnly
            cardSurface
            assignmentsShell
            footer={<CampaignCreatorDiscoveryFooter />}
            leading={
              <CampaignOperationalSectionHeader
                title="Creator assignments"
                description="Revenue, cost, margin, and billing status per creator."
                actions={
                  <>
                    <AssignmentAudienceViewToggle
                      value={audienceView}
                      onChange={setAudienceView}
                    />
                    <OperationalTableSettingsSlot
                      contextLabel="Assignments"
                      columnSettings="assignment-grid"
                    />
                    {enableLineSheet && audienceView === "internal" ? (
                      <Button
                        size="sm"
                        onClick={openCreate}
                        title="Create assignment (A)"
                        className="thinkway-campaign-btn thinkway-campaign-btn-primary h-[30px] text-[11px] shadow-none"
                      >
                        <PlusIcon data-icon="inline-start" className="size-3.5" />
                        Create assignment
                      </Button>
                    ) : null}
                  </>
                }
              />
            }
          >
            {!hasAssignments ? (
              <AssignmentsEmptyState
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
                    onCreateAssignment={enableLineSheet ? openCreate : undefined}
                  />
                </AssignmentAudienceViewProvider>
              </>
            )}
          </OperationalTableSection>
        </OperationalTableDualColumnsProvider>
      </CampaignCreatorDiscoveryProvider>

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
        />
      ) : null}

      {enableInvoiceDialogs && operationalBilling ? (
        <>
          <InvoiceTargetChoiceDialog
            open={invoiceChoiceOpen}
            onOpenChange={setInvoiceChoiceOpen}
            appendableInvoices={operationalBilling.appendable_invoices ?? []}
            onConfirm={(mode, existingInvoiceId) => {
              setInvoiceTargetMode(mode);
              setAppendInvoiceId(existingInvoiceId);
              setInvoiceOpen(true);
            }}
          />
          <InvoiceGenerationSheet
            campaignId={workspace.id}
            currency={operationalBilling.currency_code}
            rollup={operationalBilling.rollup}
            operationalRows={operationalBilling.operational_rows ?? []}
            appendableInvoices={operationalBilling.appendable_invoices ?? []}
            defaultVatPercent={operationalBilling.default_vat_percent}
            targetMode={invoiceTargetMode}
            initialExistingInvoiceId={appendInvoiceId}
            initialSelection={invoiceSelection}
            open={invoiceOpen}
            onInvoiceComplete={refreshAfterOperationalMutation}
            onOpenChange={(open) => {
              setInvoiceOpen(open);
              if (!open) setInvoiceSelection(undefined);
            }}
          />
        </>
      ) : null}

      {enableInvoiceDialogs && invoiceOpen && !operationalBilling ? (
        <CreateInvoiceSheet
          campaignId={workspace.id}
          groups={billingGroups}
          currency={workspace.currency_code}
          open={invoiceOpen}
          onOpenChange={setInvoiceOpen}
        />
      ) : null}

      {pendingRegenerationInvoice ? (
        <RegenerateInvoiceDialog
          invoiceId={pendingRegenerationInvoice.id}
          documentNumber={pendingRegenerationInvoice.document_number}
          open={regenerateInvoiceOpen}
          onOpenChange={(open) => {
            setRegenerateInvoiceOpen(open);
            if (!open) setRegenerateSelection(undefined);
          }}
          selection={regenerateSelection}
          onComplete={refreshAfterOperationalMutation}
        />
      ) : null}
    </>
  );
}
