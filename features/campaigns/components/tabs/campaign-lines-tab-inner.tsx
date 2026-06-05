"use client";

import dynamic from "next/dynamic";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
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

import { AssignmentsEmptyState } from "@/features/campaigns/components/assignments-empty-state";
import { AssignmentSafeGrid } from "@/features/campaigns/components/assignment-hierarchy/assignment-safe-grid";

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
  const router = useRouter();
  const uiLayer = getAssignmentsUiLayer();
  const enableLineSheet = assignmentsLayerAtLeast(uiLayer, "operational_actions");
  const hasAssignments = workspace.lines.length > 0;
  const enableInvoiceDialogs = assignmentsLayerAtLeast(uiLayer, "invoice_dialogs");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceSelection, setInvoiceSelection] = useState<
    OperationalSelectionPayload | undefined
  >();
  const [editing, setEditing] = useState<CampaignLineWorkspace | null>(null);

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

  function openInvoiceWithLines(lineIds: string[]) {
    if (!enableInvoiceDialogs) return;
    setInvoiceSelection({
      line_ids: lineIds,
      deliverable_ids: [],
      post_ids: [],
    });
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
      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Creator assignments
            </h2>
            {enableLineSheet ? (
              <Button size="sm" onClick={openCreate} title="Create assignment (A)">
                <PlusIcon data-icon="inline-start" />
                Create assignment
              </Button>
            ) : null}
          </div>
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
            <AssignmentSafeGrid
              campaignId={workspace.id}
              hierarchy={assignmentHierarchy}
              onEditLine={openEdit}
              onInvoiceLines={openInvoiceWithLines}
              onCreateAssignment={enableLineSheet ? openCreate : undefined}
            />
          </>
        )}
      </OperationalTableSection>

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

      {enableInvoiceDialogs && invoiceOpen && operationalBilling ? (
        <InvoiceGenerationSheet
          campaignId={workspace.id}
          currency={operationalBilling.currency_code}
          rollup={operationalBilling.rollup}
          operationalRows={operationalBilling.operational_rows ?? []}
          appendableInvoices={operationalBilling.appendable_invoices ?? []}
          defaultVatPercent={operationalBilling.default_vat_percent}
          targetMode="new"
          initialSelection={invoiceSelection}
          open={invoiceOpen}
          onInvoiceComplete={() => router.refresh()}
          onOpenChange={(open) => {
            setInvoiceOpen(open);
            if (!open) setInvoiceSelection(undefined);
          }}
        />
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
    </>
  );
}
