"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CreateInvoiceSheet } from "@/features/billing/components/create-invoice-sheet";
import { InvoiceGenerationSheet } from "@/features/billing/components/invoice-generation-sheet";
import type {
  AssignmentBillingGroup,
  CampaignOperationalBillingDetail,
} from "@/features/billing/types";
import { AssignmentHierarchyTable } from "@/features/campaigns/components/assignment-hierarchy/assignment-hierarchy-table";
import { CampaignLineSheet } from "@/features/campaigns/components/campaign-line-sheet";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type {
  CampaignLineWorkspace,
  CampaignPoSummary,
  CampaignWorkspace,
} from "@/features/campaigns/types";
import type { OperationalSelectionPayload } from "@/lib/billing/operational-selection";
import { useRegisterShortcut } from "@/lib/productivity/keyboard-shortcuts";

type CampaignLinesTabProps = {
  workspace: CampaignWorkspace;
  po: CampaignPoSummary;
  currencyOptions: { value: string; label: string }[];
  assignmentHierarchy: AssignmentHierarchy;
  billingGroups: AssignmentBillingGroup[];
  operationalBilling: CampaignOperationalBillingDetail | null;
};

export function CampaignLinesTab({
  workspace,
  po,
  currencyOptions,
  assignmentHierarchy,
  billingGroups,
  operationalBilling,
}: CampaignLinesTabProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceSelection, setInvoiceSelection] = useState<
    OperationalSelectionPayload | undefined
  >();
  const [editing, setEditing] = useState<CampaignLineWorkspace | null>(null);

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(line: CampaignLineWorkspace) {
    setEditing(line);
    setSheetOpen(true);
  }

  function openInvoiceWithLines(lineIds: string[]) {
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
            <Button size="sm" onClick={openCreate} title="Assign influencer (A)">
              <PlusIcon data-icon="inline-start" />
              Assign influencer
            </Button>
          </div>
        }
      >
          {assignmentHierarchy.load_error ? (
            <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              Assignment hierarchy loaded with warnings: {assignmentHierarchy.load_error}. Showing
              available rows — apply pending migrations if commercial columns are missing.
            </div>
          ) : null}
          <AssignmentHierarchyTable
            campaignId={workspace.id}
            hierarchy={assignmentHierarchy}
            onEditLine={openEdit}
            onInvoiceLines={openInvoiceWithLines}
          />
      </OperationalTableSection>

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

      {operationalBilling ? (
        <InvoiceGenerationSheet
          campaignId={workspace.id}
          currency={operationalBilling.currency_code}
          rollup={operationalBilling.rollup}
          operationalRows={operationalBilling.operational_rows}
          appendableInvoices={operationalBilling.appendable_invoices}
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
      ) : (
        <CreateInvoiceSheet
          campaignId={workspace.id}
          groups={billingGroups}
          currency={workspace.currency_code}
          open={invoiceOpen}
          onOpenChange={setInvoiceOpen}
        />
      )}
    </>
  );
}
