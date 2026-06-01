"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Creator assignments</CardTitle>
            <p className="text-sm text-muted-foreground">
              Expand assignments to edit deliverables inline, manage posting schedules, and
              invoice line-by-line. Alt+N adds a deliverable when expanded. Arrow keys expand
              or collapse rows.
            </p>
          </div>
          <Button size="sm" onClick={openCreate} title="Assign influencer (A)">
            <PlusIcon data-icon="inline-start" />
            Assign influencer
          </Button>
        </CardHeader>
        <CardContent>
          <AssignmentHierarchyTable
            campaignId={workspace.id}
            hierarchy={assignmentHierarchy}
            onEditLine={openEdit}
            onInvoiceSelected={openInvoiceWithSelection}
          />
        </CardContent>
      </Card>

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
