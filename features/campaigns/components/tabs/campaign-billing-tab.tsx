"use client";

import Link from "next/link";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRefreshCampaignAfterOperationalMutation } from "@/features/campaigns/hooks/campaign-operational-refresh";
import { DocumentNumber } from "@/components/ui/document-number";
import { DetailClickableLabel } from "@/features/campaigns/components/detail-sheets/detail-clickable-label";
import { InvoiceDetailSheet } from "@/features/campaigns/components/detail-sheets/invoice-detail-sheet";
import { PaymentDetailSheet } from "@/features/campaigns/components/detail-sheets/payment-detail-sheet";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { operationalColumnsFromMetas } from "@/lib/tables/operational-filter-columns";
import type { ConsolidatedInvoiceQueueRow } from "@/lib/billing/consolidated-invoice-queue";
import { FINANCE_INVOICE_REGISTER_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import {
  AuroraEmptyState,
  AuroraStatusPill,
  CampaignWorkspaceFrame,
} from "@/features/campaigns/components/aurora/campaign-workspace-frame";
import { formatMoneyCompact, formatPercent } from "@/features/campaigns/utils";
import { sumIoGatedAssignmentBillable } from "@/lib/billing/queue-eligibility";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import {
  FinanceInvoiceRegisterTable,
  getFinanceInvoiceRegisterColumnMetas,
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
  CampaignBillingQueueFloatingBar,
} from "@/features/campaigns/components/tabs/campaign-billing-queue-table";
import { operationalFloatingBarContentClass } from "@/components/workspace/operational-floating-action-bar";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { CreateInvoiceSheet } from "@/features/billing/components/create-invoice-sheet";
import { useInvoiceConfirmFlow } from "@/features/billing/hooks/use-invoice-confirm-flow";
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
import type { InvoiceDraftPercents } from "@/lib/billing/operational-invoice-draft";
import {
  OPERATIONAL_BILLING_FILTER_OPTIONS,
  type OperationalBillingFilter,
} from "@/lib/billing/operational-row-filters";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { buildConsolidatedInvoiceQueueRows } from "@/lib/billing/consolidated-invoice-queue";
import { cn } from "@/lib/utils";

type CampaignPaymentRow = CampaignWorkspace["payments"][number];

function paymentStatusBadgeClass(status: string): string {
  const key = status.toLowerCase();
  if (key === "paid" || key === "completed") return "thinkway-campaign-badge-green";
  if (key === "pending" || key === "processing") return "thinkway-campaign-badge-blue";
  if (key === "failed" || key === "cancelled") return "thinkway-campaign-badge-red";
  return "thinkway-campaign-badge-gray";
}

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
          className="thinkway-campaign-link-btn font-mono text-[11px]"
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
        <span className={cn("thinkway-campaign-badge capitalize", paymentStatusBadgeClass(p.status))}>
          {p.status}
        </span>
      ),
    },
    {
      id: "paid_at",
      label: "Paid at",
      cellClassName: "text-[11px] text-[var(--camp-text-3)]",
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
  /** When false, Create Invoice is hidden and a lifecycle unlock message is shown. */
  invoiceCreationUnlocked?: boolean;
  /**
   * Human-readable next step when invoice creation is locked.
   * Prefer Decision Center waiting reason so Unlock does not contradict the blocker line.
   */
  invoiceUnlockHint?: string | null;
  onNavigateToLifecycleAction?: () => void;
  /** Deep-link from Decision Center (?invoice=). */
  initialDetailInvoiceId?: string | null;
  /** Deep-link from Decision Center (?payment=). */
  initialDetailPaymentId?: string | null;
};

export function CampaignBillingTab({
  workspace,
  billingLines,
  billingGroups,
  operationalBilling,
  campaignInvoiceRegister,
  invoiceCreationUnlocked = true,
  invoiceUnlockHint = null,
  onNavigateToLifecycleAction,
  initialDetailInvoiceId = null,
  initialDetailPaymentId = null,
}: CampaignBillingTabProps) {
  const refreshAfterOperationalMutation = useRefreshCampaignAfterOperationalMutation();
  const { financials } = workspace;
  const currency = workspace.currency_code;
  const [legacyInvoiceOpen, setLegacyInvoiceOpen] = useState(false);
  const [invoiceDraftPercents, setInvoiceDraftPercents] = useState<InvoiceDraftPercents>({});
  const invoiceConfirm = useInvoiceConfirmFlow({
    campaignId: workspace.id,
    campaignName: workspace.name,
    campaignNo: workspace.document_number,
    currency,
    operationalBilling,
    percents: invoiceDraftPercents,
    onComplete: () => {
      setInvoiceDraftPercents({});
      refreshAfterOperationalMutation();
    },
  });
  const invoicePending = invoiceConfirm.pending;
  const [billingFilter, setBillingFilter] = useState<OperationalBillingFilter>("all");
  const [selectedQueueBatchKeys, setSelectedQueueBatchKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [activeQueueBatchKey, setActiveQueueBatchKey] = useState<string | null>(null);
  const [drilldownVisible, setDrilldownVisible] = useState(false);
  const [drilldownSelection, setDrilldownSelection] =
    useState<OperationalSelectionState>(createEmptySelection);
  const [drilldownPending, startDrilldownTransition] = useTransition();
  const [detailInvoiceId, setDetailInvoiceId] = useState<string | null>(
    () => initialDetailInvoiceId
  );
  const [detailPaymentId, setDetailPaymentId] = useState<string | null>(
    () => initialDetailPaymentId
  );

  useEffect(() => {
    if (!initialDetailInvoiceId) return;
    const inRegister = campaignInvoiceRegister.some(
      (row) => row.id === initialDetailInvoiceId
    );
    if (inRegister) setDetailInvoiceId(initialDetailInvoiceId);
  }, [initialDetailInvoiceId, campaignInvoiceRegister]);

  useEffect(() => {
    if (!initialDetailPaymentId) return;
    if (workspace.payments.some((row) => row.id === initialDetailPaymentId)) {
      setDetailPaymentId(initialDetailPaymentId);
    }
  }, [initialDetailPaymentId, workspace.payments]);

  useEffect(() => {
    setInvoiceDraftPercents({});
  }, [operationalBilling?.campaign_header_id, operationalBilling?.rollup.remaining_to_invoice]);

  const campaignInvoiceColumnMetas = useMemo(
    () => getFinanceInvoiceRegisterColumnMetas(true, "campaign"),
    []
  );

  const paymentColumns = useMemo(
    () => buildCampaignPaymentsColumns(setDetailPaymentId),
    []
  );

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

  function beginInvoiceFlow(selection?: OperationalSelectionPayload) {
    if (!operationalBilling || invoicePending) return;
    invoiceConfirm.requestConfirm(selection);
  }

  function handleQueueGenerateInvoice() {
    if (!operationalBilling || selectedQueueBatchKeys.size === 0) return;
    const payload = buildConsolidatedQueueInvoiceSelection(
      operationalBilling.operational_rows
    );
    beginInvoiceFlow(payload);
  }

  const operationalRows = operationalBilling?.operational_rows;
  const ioGatedBillable =
    operationalRows && operationalRows.length > 0
      ? sumIoGatedAssignmentBillable(operationalRows)
      : null;
  const billingRevenue = ioGatedBillable ?? financials.revenue;
  const billingPoConsumed = ioGatedBillable ?? financials.po_consumed;
  const billingRemainingPo = financials.po_total - billingPoConsumed;

  return (
    <div>
      {!invoiceCreationUnlocked ? (
        <aside className="thinkway-lc-finance-lock mb-3" aria-label="Invoice availability">
          <div className="thinkway-bp-label">Create Invoice unavailable</div>
          <p>
            <b>Unlock:</b>{" "}
            {invoiceUnlockHint?.trim() ||
              "Advance the campaign to Billing to unlock invoice creation."}
          </p>
          <p className="thinkway-lc-muted">
            Invoices become available when the campaign reaches the Billing stage.
          </p>
          {onNavigateToLifecycleAction ? (
            <button
              type="button"
              className="thinkway-bp-continue mt-2"
              onClick={onNavigateToLifecycleAction}
            >
              Take next action
            </button>
          ) : null}
        </aside>
      ) : null}
      <CampaignWorkspaceFrame
        title="Finance"
        subtitle="Commercial snapshot and billing registers"
        registerCount={
          campaignInvoiceRegister.length + (workspace.payments?.length ?? 0)
        }
        registerStorageKey={`finance-${workspace.id}`}
        forceRegisterOpen={Boolean(
          initialDetailInvoiceId || initialDetailPaymentId
        )}
        registerLabel="Registers"
        status={
          <AuroraStatusPill
            tone={financials.billing_outstanding > 0 ? "amber" : "green"}
          >
            {financials.billing_outstanding > 0 ? "Outstanding balance" : "Clear"}
          </AuroraStatusPill>
        }
        tools={
          <>
            <Button size="sm" variant="outline" asChild className="thinkway-campaign-btn">
              <Link href="/finance/invoices">Invoice register</Link>
            </Button>
            <Button size="sm" variant="outline" asChild className="thinkway-campaign-btn">
              <Link href="/billing">Finance workspace</Link>
            </Button>
            {invoiceCreationUnlocked ? (
              <Button
                size="sm"
                className="thinkway-campaign-btn thinkway-campaign-btn-primary"
                onClick={() => {
                  if (operationalBilling) {
                    beginInvoiceFlow(undefined);
                  } else {
                    setLegacyInvoiceOpen(true);
                  }
                }}
              >
                Create invoice
              </Button>
            ) : null}
          </>
        }
        stats={[
          {
            key: "revenue",
            label: "Revenue",
            value: formatMoneyCompact(billingRevenue, currency),
            tone: "blue",
          },
          {
            key: "cost",
            label: "Cost",
            value: formatMoneyCompact(financials.cost, currency),
          },
          {
            key: "gp",
            label: "Gross Profit",
            value: formatMoneyCompact(financials.gp, currency),
            tone: financials.gp < 0 ? "amber" : "pos",
          },
          {
            key: "margin",
            label: "Margin",
            value: formatPercent(financials.margin_percent),
          },
          {
            key: "collected",
            label: "Collected",
            value: formatMoneyCompact(financials.collected, currency),
            tone: "pos",
          },
          {
            key: "outstanding",
            label: "Outstanding",
            value: formatMoneyCompact(financials.billing_outstanding, currency),
            tone: financials.billing_outstanding > 0 ? "amber" : "mut",
          },
          {
            key: "receivable",
            label: "Receivable",
            value: formatMoneyCompact(financials.billing_outstanding, currency),
            tone: financials.billing_outstanding > 0 ? "amber" : "mut",
          },
          {
            key: "po",
            label: "Remaining PO",
            value: formatMoneyCompact(billingRemainingPo, currency),
          },
        ]}
        detailsLabel="Billing lifecycle"
        details={
          <div className="thinkway-campaign-billing-flow">
            <span className="thinkway-campaign-billing-flow-step">draft</span>
            <span className="thinkway-campaign-billing-flow-sep" aria-hidden>
              →
            </span>
            <span className="thinkway-campaign-billing-flow-step">approved</span>
            <span className="thinkway-campaign-billing-flow-sep" aria-hidden>
              →
            </span>
            <span className="thinkway-campaign-billing-flow-step">moved to billing</span>
            <span className="thinkway-campaign-billing-flow-sep" aria-hidden>
              →
            </span>
            <span className="thinkway-campaign-billing-flow-step">partially invoiced</span>
            <span className="thinkway-campaign-billing-flow-sep" aria-hidden>
              →
            </span>
            <span className="thinkway-campaign-billing-flow-step">invoiced</span>
            <span className="thinkway-campaign-billing-flow-sep" aria-hidden>
              →
            </span>
            <span className="thinkway-campaign-billing-flow-step">paid</span>
            <span className="thinkway-campaign-billing-flow-sep" aria-hidden>
              →
            </span>
            <span className="thinkway-campaign-billing-flow-step">closed</span>
          </div>
        }
      >
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
          className={operationalFloatingBarContentClass(selectedQueueBatchKeys.size > 0)}
          leading={
            <CampaignOperationalSectionHeader
              title="Billing queue"
              actions={
                <OperationalTableControlsSlot contextLabel="Consolidated invoice queue" />
              }
            />
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
        {operationalBilling ? (
          <CampaignBillingQueueFloatingBar
            rows={billingQueueRows}
            selectedBatchKeys={selectedQueueBatchKeys}
            onSelectAll={handleQueueSelectAll}
            onClear={() => setSelectedQueueBatchKeys(new Set())}
            onGenerateInvoice={handleQueueGenerateInvoice}
            invoicePending={invoicePending}
          />
        ) : null}
      </OperationalTableSuiteProvider>

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
                actions={
                  <OperationalTableControlsSlot contextLabel="Assignment billing groups" />
                }
              />
            }
          >
            <AssignmentBillingGroupsTable
              groups={billingGroups}
              billingLines={billingLines}
              currency={currency}
              campaignId={workspace.id}
            />
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
            <AuroraEmptyState
              title="Select a queue row to open operational billing."
              description="Click a campaign number in the billing queue above to load assignment-level detail."
            />
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
                invoicePercents={invoiceDraftPercents}
                onInvoicePercentsChange={setInvoiceDraftPercents}
                invoicePending={invoicePending}
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
          campaignInvoiceColumnMetas,
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
              actions={<OperationalTableControlsSlot contextLabel="Campaign invoices" />}
            />
          }
        >
          <FinanceInvoiceRegisterTable
            rows={campaignInvoiceRegister}
            showUngenerate
            appearance="campaign"
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
              actions={<OperationalTableControlsSlot contextLabel="Campaign payments" />}
            />
          }
        >
          {workspace.payments.length === 0 ? (
            <AuroraEmptyState
              title="Payments are not available yet."
              description="Collections unlock after invoices exist. Decision Center shows any finance blocker. Owner: Finance — open the invoice register action when Billing starts."
            />
          ) : (
            <OperationalConfigurableTable
              columns={paymentColumns}
              rows={workspace.payments}
              rowKey={(p) => p.id}
            />
          )}
        </OperationalTableSection>
      </OperationalTableSuiteProvider>
      </CampaignWorkspaceFrame>

      <CreateInvoiceSheet
        campaignId={workspace.id}
        groups={billingGroups}
        currency={currency}
        open={legacyInvoiceOpen}
        onOpenChange={setLegacyInvoiceOpen}
      />

      {operationalBilling ? (
        <>
          {invoiceConfirm.confirmDialog}
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
