"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useMemo, useState, useTransition } from "react";
import { DocumentNumber } from "@/components/ui/document-number";
import { DetailClickableLabel } from "@/features/campaigns/components/detail-sheets/detail-clickable-label";
import { InvoiceDetailSheet } from "@/features/campaigns/components/detail-sheets/invoice-detail-sheet";
import { PaymentDetailSheet } from "@/features/campaigns/components/detail-sheets/payment-detail-sheet";
import { format } from "date-fns";
import { PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { operationalColumnsFromMetas } from "@/lib/tables/operational-filter-columns";
import type { ConsolidatedInvoiceQueueRow } from "@/lib/billing/consolidated-invoice-queue";
import { FINANCE_INVOICE_REGISTER_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { CampaignBillingKpiStrip } from "@/features/campaigns/components/campaign-billing-kpi-strip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import {
  FINANCE_INVOICE_REGISTER_COLUMN_METAS_WITH_ACTIONS,
  FinanceInvoiceRegisterTable,
} from "@/features/finance/invoices/components/finance-invoice-register-table";
import type { FinanceInvoiceRegisterRow } from "@/features/finance/invoices/types";
import {
  CAMPAIGN_ASSIGNMENT_BILLING_GROUPS_COLUMN_METAS,
  AssignmentBillingGroupsTable,
} from "@/features/billing/components/assignment-billing-groups-table";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { BillingCampaignDrilldown } from "@/features/billing/components/billing-campaign-drilldown";
import {
  CAMPAIGN_CONSOLIDATED_INVOICE_QUEUE_COLUMN_METAS,
  CampaignBillingQueueTable,
  CampaignBillingQueueToolbar,
} from "@/features/campaigns/components/tabs/campaign-billing-queue-table";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { CreateInvoiceSheet } from "@/features/billing/components/create-invoice-sheet";
import { InvoiceGenerationSheet } from "@/features/billing/components/invoice-generation-sheet";
import { RegenerateInvoiceDialog } from "@/features/billing/components/regenerate-invoice-dialog";
import {
  enrichRegenerationEligibilityInput,
  resolveInvoiceActionForSelection,
} from "@/lib/billing/regeneration-eligibility";
import {
  InvoiceTargetChoiceDialog,
  type InvoiceTargetMode,
} from "@/features/billing/components/invoice-target-choice-dialog";
import type {
  AssignmentBillingGroup,
  BillingLineRow,
  CampaignOperationalBillingDetail,
} from "@/features/billing/types";
import { buildConsolidatedQueueInvoiceSelection } from "@/lib/billing/consolidated-invoice-queue";
import {
  createEmptySelection,
  type OperationalSelectionPayload,
  type OperationalSelectionState,
} from "@/lib/billing/operational-selection";
import {
  OPERATIONAL_BILLING_FILTER_OPTIONS,
  type OperationalBillingFilter,
} from "@/lib/billing/operational-row-filters";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { buildConsolidatedInvoiceQueueRows } from "@/lib/billing/consolidated-invoice-queue";
import { cn } from "@/lib/utils";

type CampaignPaymentRow = CampaignWorkspace["payments"][number];

function buildCampaignPaymentsColumns(
  onOpenDetail: (id: string) => void
): OperationalConfigurableColumnDef<CampaignPaymentRow>[] {
  return [
    {
      id: "payment",
      label: "Payment",
      monoCell: true,
      renderCell: (p) => (
        <DetailClickableLabel
          onClick={() => onOpenDetail(p.id)}
          title={`View ${p.document_number} details`}
          className="font-mono text-[11px]"
        >
          <DocumentNumber value={p.document_number} />
        </DetailClickableLabel>
      ),
    },
    {
      id: "invoice",
      label: "Invoice",
      monoCell: true,
      renderCell: (p) => p.invoice_document_number,
    },
    {
      id: "amount",
      label: "Amount",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (p) => formatOperationalAmount(p.amount),
    },
    {
      id: "status",
      label: "Status",
      renderCell: (p) => (
        <Badge variant="outline" className="text-[10px] capitalize">
          {p.status}
        </Badge>
      ),
    },
    {
      id: "paid_at",
      label: "Paid at",
      cellClassName: "text-muted-foreground",
      renderCell: (p) => formatBillingDateTime(p.paid_at),
    },
  ];
}

const CAMPAIGN_PAYMENTS_COLUMN_METAS = getOperationalTableColumnMetas(
  buildCampaignPaymentsColumns(() => {})
);

function formatBillingDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "MMM d, yyyy");
}

type CampaignBillingTabProps = {
  workspace: CampaignWorkspace;
  billingLines: BillingLineRow[];
  billingGroups: AssignmentBillingGroup[];
  operationalBilling: CampaignOperationalBillingDetail | null;
  campaignInvoiceRegister: FinanceInvoiceRegisterRow[];
};

export function CampaignBillingTab({
  workspace,
  billingLines,
  billingGroups,
  operationalBilling,
  campaignInvoiceRegister,
}: CampaignBillingTabProps) {
  const router = useRouter();
  const { financials, po } = workspace;
  const currency = workspace.currency_code;
  const [legacyInvoiceOpen, setLegacyInvoiceOpen] = useState(false);
  const [operationalInvoiceOpen, setOperationalInvoiceOpen] = useState(false);
  const [invoiceChoiceOpen, setInvoiceChoiceOpen] = useState(false);
  const [invoiceTargetMode, setInvoiceTargetMode] = useState<InvoiceTargetMode>("new");
  const [appendInvoiceId, setAppendInvoiceId] = useState<string | undefined>();
  const [invoiceSelection, setInvoiceSelection] = useState<
    OperationalSelectionPayload | undefined
  >();
  const [billingFilter, setBillingFilter] = useState<OperationalBillingFilter>("all");
  const [selectedQueueBatchKeys, setSelectedQueueBatchKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [activeQueueBatchKey, setActiveQueueBatchKey] = useState<string | null>(null);
  const [drilldownVisible, setDrilldownVisible] = useState(false);
  const [drilldownSelection, setDrilldownSelection] =
    useState<OperationalSelectionState>(createEmptySelection);
  const [drilldownPending, startDrilldownTransition] = useTransition();
  const [regenerateInvoiceOpen, setRegenerateInvoiceOpen] = useState(false);
  const [detailInvoiceId, setDetailInvoiceId] = useState<string | null>(null);
  const [detailPaymentId, setDetailPaymentId] = useState<string | null>(null);

  const paymentColumns = useMemo(
    () => buildCampaignPaymentsColumns(setDetailPaymentId),
    []
  );

  const pendingRegenerationInvoice = useMemo(() => {
    const fromRegister = campaignInvoiceRegister.find(
      (row) => row.regeneration_status === "pending_regeneration"
    );
    if (fromRegister) {
      return { id: fromRegister.id, document_number: fromRegister.document_number };
    }
    const fromWorkspace = workspace.invoices.find(
      (row) => row.regeneration_status === "pending_regeneration"
    );
    if (fromWorkspace) {
      return { id: fromWorkspace.id, document_number: fromWorkspace.document_number };
    }
    return null;
  }, [campaignInvoiceRegister, workspace.invoices]);

  const detailInvoice = useMemo(
    () =>
      detailInvoiceId
        ? (campaignInvoiceRegister.find((row) => row.id === detailInvoiceId) ?? null)
        : null,
    [detailInvoiceId, campaignInvoiceRegister]
  );

  const detailPayment = useMemo(
    () =>
      detailPaymentId
        ? (workspace.payments.find((row) => row.id === detailPaymentId) ?? null)
        : null,
    [detailPaymentId, workspace.payments]
  );

  const billingQueueRows = useMemo(() => {
    if (!operationalBilling) return [];
    return buildConsolidatedInvoiceQueueRows({
      campaign_header_id: workspace.id,
      campaign_document_number: workspace.document_number,
      campaign_name: workspace.name,
      client_name: workspace.client?.name ?? "—",
      brand_name: workspace.brand?.name ?? null,
      currency_code: operationalBilling.currency_code,
      operational_rows: operationalBilling.operational_rows,
    });
  }, [operationalBilling, workspace]);

  function openQueueDrilldown(batchKey: string) {
    setActiveQueueBatchKey(batchKey);
    startDrilldownTransition(() => {
      setDrilldownVisible(true);
    });
  }

  function toggleQueueBatchSelection(batchKey: string) {
    setSelectedQueueBatchKeys((prev) => {
      const next = new Set(prev);
      if (next.has(batchKey)) next.delete(batchKey);
      else next.add(batchKey);
      return next;
    });
  }

  function handleQueueSelectAll() {
    const status =
      selectedQueueBatchKeys.size === billingQueueRows.length ? "clear" : "all";
    if (status === "clear") {
      setSelectedQueueBatchKeys(new Set());
      return;
    }
    setSelectedQueueBatchKeys(new Set(billingQueueRows.map((r) => r.batch_key)));
  }

  const appendableInvoices = operationalBilling?.appendable_invoices ?? [];

  function operationalLineEligibility(lineId: string) {
    const row = operationalBilling?.operational_rows.find(
      (entry) => entry.kind === "assignment" && entry.campaign_line_id === lineId
    );
    if (!row) return null;

    return enrichRegenerationEligibilityInput(
      {
        billing_status: row.line_billing_status,
        operational_status: row.operational_status,
        vendor_io_id: row.vendor_io_id,
        vendor_io_document_number: row.vendor_io_document_number,
        invoice_id: row.invoice_id ?? row.linked_invoice_id,
        invoiced_amount: row.invoiced_amount,
        billable_amount: row.billable_amount,
        remaining_amount: row.remaining_amount,
      },
      pendingRegenerationInvoice
        ? {
            pending_regeneration_invoice_id: pendingRegenerationInvoice.id,
            regeneration_status: "pending_regeneration",
            invoice_status: "draft",
          }
        : undefined
    );
  }

  function beginInvoiceFlow(selection?: OperationalSelectionPayload) {
    if (!operationalBilling) return;

    let flowSelection = selection;

    if (pendingRegenerationInvoice && (selection?.line_ids?.length ?? 0) > 0) {
      const invoiceAction = resolveInvoiceActionForSelection({
        lineIds: selection?.line_ids ?? [],
        getRow: operationalLineEligibility,
      });

      if (invoiceAction.action === "regenerate") {
        setRegenerateInvoiceOpen(true);
        return;
      }

      flowSelection = {
        line_ids: invoiceAction.generateLineIds,
        deliverable_ids: selection?.deliverable_ids ?? [],
        post_ids: selection?.post_ids ?? [],
      };
    }

    const eligible = appendableInvoices.filter(
      (inv) =>
        !inv.is_locked &&
        inv.status !== "void" &&
        inv.status !== "paid" &&
        inv.regeneration_status !== "pending_regeneration"
    );
    if (eligible.length > 0) {
      setInvoiceSelection(flowSelection);
      setInvoiceChoiceOpen(true);
      return;
    }
    setInvoiceTargetMode("new");
    setAppendInvoiceId(undefined);
    setInvoiceSelection(flowSelection);
    setOperationalInvoiceOpen(true);
  }

  function handleQueueGenerateInvoice() {
    if (!operationalBilling || selectedQueueBatchKeys.size === 0) return;
    const payload = buildConsolidatedQueueInvoiceSelection(
      operationalBilling.operational_rows
    );
    beginInvoiceFlow(payload);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Billing lifecycle: draft → approved → moved to billing → partially invoiced → invoiced → paid → closed
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/finance/invoices">Invoice register</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/billing">Finance workspace</Link>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (operationalBilling) {
                beginInvoiceFlow(undefined);
              } else {
                setLegacyInvoiceOpen(true);
              }
            }}
          >
            <PlusIcon data-icon="inline-start" />
            Create new invoice
          </Button>
        </div>
      </div>

      <CampaignBillingKpiStrip
        workspace={workspace}
        operationalRows={operationalBilling?.operational_rows}
      />

      {operationalBilling ? (
        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.campaignConsolidatedInvoiceQueue}
          columns={operationalColumnsFromMetas(CAMPAIGN_CONSOLIDATED_INVOICE_QUEUE_COLUMN_METAS, {
            campaign_number: (row: ConsolidatedInvoiceQueueRow) => row.campaign_document_number,
            client: (row: ConsolidatedInvoiceQueueRow) => row.client_name,
            brand: (row: ConsolidatedInvoiceQueueRow) => row.brand_name,
            campaign_name: (row: ConsolidatedInvoiceQueueRow) => row.campaign_name,
            revenue_before_vat: (row: ConsolidatedInvoiceQueueRow) => row.revenue_before_vat,
            vat_amount: (row: ConsolidatedInvoiceQueueRow) => row.vat_amount,
            revenue_after_vat: (row: ConsolidatedInvoiceQueueRow) => row.revenue_after_vat,
          })}
          rows={billingQueueRows}
          filterAccessors={{
            campaign_number: (row: ConsolidatedInvoiceQueueRow) => row.campaign_document_number,
            client: (row: ConsolidatedInvoiceQueueRow) => row.client_name,
            brand: (row: ConsolidatedInvoiceQueueRow) => row.brand_name,
            campaign_name: (row: ConsolidatedInvoiceQueueRow) => row.campaign_name,
            revenue_before_vat: (row: ConsolidatedInvoiceQueueRow) => row.revenue_before_vat,
            vat_amount: (row: ConsolidatedInvoiceQueueRow) => row.vat_amount,
            revenue_after_vat: (row: ConsolidatedInvoiceQueueRow) => row.revenue_after_vat,
          }}
        >
          <OperationalTableSection
            wide
            tableOnly
            cardSurface
            compact
            leading={
              <div className="flex w-full flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Billing queue
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <OperationalTableControlsSlot contextLabel="Consolidated invoice queue" />
                  <CampaignBillingQueueToolbar
                    rows={billingQueueRows}
                    selectedBatchKeys={selectedQueueBatchKeys}
                    onSelectAll={handleQueueSelectAll}
                    onClear={() => setSelectedQueueBatchKeys(new Set())}
                    onGenerateInvoice={handleQueueGenerateInvoice}
                  />
                </div>
              </div>
            }
          >
            <CampaignBillingQueueTable
              rows={billingQueueRows}
              selectedBatchKeys={selectedQueueBatchKeys}
              activeBatchKey={activeQueueBatchKey}
              onToggleRowSelect={toggleQueueBatchSelection}
              onSelectRow={(row) => openQueueDrilldown(row.batch_key)}
            />
          </OperationalTableSection>
        </OperationalTableSuiteProvider>
      ) : null}

      {!operationalBilling ? (
        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.campaignAssignmentBillingGroups}
          columns={operationalColumnsFromMetas(CAMPAIGN_ASSIGNMENT_BILLING_GROUPS_COLUMN_METAS)}
          rows={billingGroups}
        >
          <OperationalTableSection
            wide
            tableOnly
            cardSurface
            leading={
              <CampaignOperationalSectionHeader
                title="Operational billing"
                description="Assignment lines, IO status, and invoice actions for this campaign."
                actions={
                  <OperationalTableControlsSlot contextLabel="Assignment billing groups" />
                }
              />
            }
          >
            <div className="p-4">
              <AssignmentBillingGroupsTable
                groups={billingGroups}
                billingLines={billingLines}
                currency={currency}
                campaignId={workspace.id}
              />
            </div>
          </OperationalTableSection>
        </OperationalTableSuiteProvider>
      ) : (
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <CampaignOperationalSectionHeader
              title="Operational billing"
              description={
                drilldownVisible
                  ? "Assignment lines, IO status, and invoice actions for the selected queue row."
                  : "Select a campaign row in the billing queue above to load operational detail."
              }
              actions={
                drilldownVisible ? (
                  <Select
                    value={billingFilter}
                    onValueChange={(value) => {
                      setBillingFilter(value as OperationalBillingFilter);
                    }}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATIONAL_BILLING_FILTER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null
              }
            />
          }
        >
          {!drilldownVisible ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Click the campaign number in the billing queue to open assignment-level operational
              billing.
            </p>
          ) : (
            <div
              className={cn(
                "transition-opacity duration-200",
                drilldownPending ? "opacity-40" : "opacity-100"
              )}
            >
              <BillingCampaignDrilldown
                detail={operationalBilling}
                filter={billingFilter}
                selection={drilldownSelection}
                onSelectionChange={setDrilldownSelection}
                appearance="campaign"
                onInvoice={(selection) => {
                  beginInvoiceFlow(selection);
                }}
              />
            </div>
          )}
        </OperationalTableSection>
      )}

      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.campaignInvoiceRegister}
        columns={operationalColumnsFromMetas(
          FINANCE_INVOICE_REGISTER_COLUMN_METAS_WITH_ACTIONS,
          FINANCE_INVOICE_REGISTER_FILTER_ACCESSORS
        )}
        rows={campaignInvoiceRegister}
        filterAccessors={FINANCE_INVOICE_REGISTER_FILTER_ACCESSORS}
      >
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <CampaignOperationalSectionHeader
              title="Invoices"
              description="Client invoices linked to this campaign."
              actions={<OperationalTableControlsSlot contextLabel="Campaign invoices" />}
            />
          }
        >
          <FinanceInvoiceRegisterTable
            rows={campaignInvoiceRegister}
            showUngenerate
            onOpenDetail={(row) => setDetailInvoiceId(row.id)}
          />
        </OperationalTableSection>
      </OperationalTableSuiteProvider>

      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.campaignPayments}
        columns={paymentColumns}
        rows={workspace.payments}
        filterAccessors={{
          payment: (row) => row.document_number,
          invoice: (row) => row.invoice_document_number,
          amount: (row) => row.amount,
          status: (row) => row.status,
          paid_at: (row) => row.paid_at,
        }}
      >
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <CampaignOperationalSectionHeader
              title="Payments"
              description="Recorded payments against campaign invoices."
              actions={<OperationalTableControlsSlot contextLabel="Campaign payments" />}
            />
          }
        >
          {workspace.payments.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">No payments recorded.</p>
          ) : (
            <OperationalConfigurableTable
              columns={paymentColumns}
              rows={workspace.payments}
              rowKey={(p) => p.id}
            />
          )}
        </OperationalTableSection>
      </OperationalTableSuiteProvider>

      <CreateInvoiceSheet
        campaignId={workspace.id}
        groups={billingGroups}
        currency={currency}
        open={legacyInvoiceOpen}
        onOpenChange={setLegacyInvoiceOpen}
      />

      {operationalBilling ? (
        <>
          <InvoiceTargetChoiceDialog
            open={invoiceChoiceOpen}
            onOpenChange={setInvoiceChoiceOpen}
            appendableInvoices={appendableInvoices}
            onConfirm={(mode, existingInvoiceId) => {
              setInvoiceTargetMode(mode);
              setAppendInvoiceId(existingInvoiceId);
              setOperationalInvoiceOpen(true);
            }}
          />
          <InvoiceGenerationSheet
            campaignId={workspace.id}
            currency={operationalBilling.currency_code}
            rollup={operationalBilling.rollup}
            operationalRows={operationalBilling.operational_rows}
            appendableInvoices={operationalBilling.appendable_invoices}
            defaultVatPercent={operationalBilling.default_vat_percent}
            targetMode={invoiceTargetMode}
            initialExistingInvoiceId={appendInvoiceId}
            initialSelection={invoiceSelection}
            open={operationalInvoiceOpen}
            onInvoiceComplete={() => router.refresh()}
            onOpenChange={(open) => {
              setOperationalInvoiceOpen(open);
              if (!open) setInvoiceSelection(undefined);
            }}
          />
          {pendingRegenerationInvoice ? (
            <RegenerateInvoiceDialog
              invoiceId={pendingRegenerationInvoice.id}
              documentNumber={pendingRegenerationInvoice.document_number}
              open={regenerateInvoiceOpen}
              onOpenChange={setRegenerateInvoiceOpen}
              onComplete={() => router.refresh()}
            />
          ) : null}
        </>
      ) : null}

      <InvoiceDetailSheet
        open={detailInvoiceId != null}
        onOpenChange={(open) => {
          if (!open) setDetailInvoiceId(null);
        }}
        row={detailInvoice}
      />

      <PaymentDetailSheet
        open={detailPaymentId != null}
        onOpenChange={(open) => {
          if (!open) setDetailPaymentId(null);
        }}
        row={detailPayment}
        campaignName={workspace.name}
      />
    </div>
  );
}
