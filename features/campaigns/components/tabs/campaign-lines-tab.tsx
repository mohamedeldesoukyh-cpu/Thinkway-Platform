"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CreateInvoiceSheet } from "@/features/billing/components/create-invoice-sheet";
import type { AssignmentBillingGroup } from "@/features/billing/types";
import { AssignmentHierarchyTable } from "@/features/campaigns/components/assignment-hierarchy/assignment-hierarchy-table";
import { CampaignLineSheet } from "@/features/campaigns/components/campaign-line-sheet";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type {
  CampaignLineWorkspace,
  CampaignPoSummary,
  CampaignWorkspace,
} from "@/features/campaigns/types";
import { useRegisterShortcut } from "@/lib/productivity/keyboard-shortcuts";

type CampaignLinesTabProps = {
  workspace: CampaignWorkspace;
  po: CampaignPoSummary;
  currencyOptions: { value: string; label: string }[];
  assignmentHierarchy: AssignmentHierarchy;
  billingGroups: AssignmentBillingGroup[];
};

export function CampaignLinesTab({
  workspace,
  po,
  currencyOptions,
  assignmentHierarchy,
  billingGroups,
}: CampaignLinesTabProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceSelection, setInvoiceSelection] = useState<string[]>([]);
  const [editing, setEditing] = useState<CampaignLineWorkspace | null>(null);

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(line: CampaignLineWorkspace) {
    setEditing(line);
    setSheetOpen(true);
  }

  function openInvoiceWithSelection(ids: string[]) {
    setInvoiceSelection(ids);
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
        title="Creator assignments"
        description="Expand assignments to edit deliverables inline, manage posting schedules, and invoice line-by-line. Alt+N adds a deliverable when expanded. Arrow keys expand or collapse rows."
        actions={
          <Button size="sm" onClick={openCreate} title="Assign influencer (A)">
            <PlusIcon data-icon="inline-start" />
            Assign influencer
          </Button>
        }
      >
        {assignmentHierarchy.load_error ? (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-900 dark:text-amber-200">
            Assignment hierarchy loaded with warnings: {assignmentHierarchy.load_error}. Showing
            available rows — apply pending migrations if commercial columns are missing.
          </div>
        ) : null}
        <AssignmentHierarchyTable
          campaignId={workspace.id}
          hierarchy={assignmentHierarchy}
          onEditLine={openEdit}
          onInvoiceSelected={openInvoiceWithSelection}
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

      <CreateInvoiceSheet
        campaignId={workspace.id}
        groups={billingGroups}
        currency={workspace.currency_code}
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
        initialSelectedIds={invoiceSelection}
      />
    </>
  );
}
