"use client";

import { useActionState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { DocumentNumber } from "@/components/ui/document-number";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS,
  OperationalFormSection,
  OperationalWorkspaceChrome,
  OperationalWorkspaceSortableTabsBar,
  OperationalWorkspaceTabPanel,
  type OperationalWorkspaceTabDef,
} from "@/components/workspace/operational-workspace-ui";
import { useWorkspaceTabOrder } from "@/hooks/use-workspace-tab-order";
import {
  INVOICE_WORKSPACE_TAB_ORDER,
  INVOICE_WORKSPACE_TAB_STORAGE_KEY,
  isInvoiceWorkspaceTabId,
  type InvoiceWorkspaceTabId,
} from "@/lib/workspace/platform-workspace-tabs";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import {
  DETAIL_FORM_INPUT_CLASS,
  DETAIL_FORM_SELECT_TRIGGER_CLASS,
} from "@/features/campaigns/components/operational-detail-panel";
import { cn } from "@/lib/utils";
import {
  CollectionStatusBadge,
} from "@/features/billing/components/billing-status-badge";
import { InvoiceRegenerationPanel } from "@/features/billing/components/invoice-regeneration-panel";
import { InvoiceViewMenu } from "@/features/billing/components/invoice-view-menu";
import {
  recordCollectionPaymentAction,
  type BillingActionState,
} from "@/features/billing/actions";
import { FINANCIAL_APPROVAL_STAGE_LABELS } from "@/features/billing/constants";
import type { InvoiceWorkspace } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { Badge } from "@/components/ui/badge";

type InvoiceLineRow = InvoiceWorkspace["lines"][number];
type InvoicePaymentRow = InvoiceWorkspace["payments"][number];
type InvoiceApprovalRow = InvoiceWorkspace["approvals"][number];

const INVOICE_DETAIL_LINES_COLUMNS: OperationalConfigurableColumnDef<InvoiceLineRow>[] = [
  {
    id: "campaign_line",
    label: "Campaign line",
    monoCell: true,
    renderCell: (line) => line.line_document_number,
  },
  {
    id: "description",
    label: "Description",
    renderCell: (line) => line.description,
  },
  {
    id: "quantity",
    label: "Qty",
    headerClassName: "text-right",
    cellClassName: "text-right",
    renderCell: (line) => line.quantity,
  },
  {
    id: "unit_price",
    label: "Unit (ex-VAT)",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: () => null,
  },
  {
    id: "vat_percent",
    label: "VAT %",
    headerClassName: "text-right",
    cellClassName: "text-right",
    renderCell: (line) => (line.revenue_vat_exempt ? "Exempt" : `${line.revenue_vat_percent}%`),
  },
  {
    id: "vat_amount",
    label: "VAT",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: () => null,
  },
  {
    id: "line_total",
    label: "Line total",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: () => null,
  },
];

export const INVOICE_DETAIL_LINES_COLUMN_METAS =
  getOperationalTableColumnMetas(INVOICE_DETAIL_LINES_COLUMNS);

const INVOICE_DETAIL_PAYMENTS_COLUMNS: OperationalConfigurableColumnDef<InvoicePaymentRow>[] = [
  {
    id: "payment",
    label: "Payment",
    monoCell: true,
    renderCell: (payment) => payment.document_number,
  },
  {
    id: "amount",
    label: "Amount",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (payment) => formatBillingMoney(payment.amount, payment.currency),
  },
  {
    id: "method",
    label: "Method",
    cellClassName: "capitalize",
    renderCell: (payment) => payment.payment_method.replace("_", " "),
  },
  {
    id: "status",
    label: "Status",
    cellClassName: "capitalize",
    renderCell: (payment) => payment.status,
  },
  {
    id: "paid_at",
    label: "Paid at",
    cellClassName: "text-muted-foreground",
    renderCell: (payment) =>
      payment.paid_at ? format(new Date(payment.paid_at), "MMM d, yyyy HH:mm") : "—",
  },
];

export const INVOICE_DETAIL_PAYMENTS_COLUMN_METAS = getOperationalTableColumnMetas(
  INVOICE_DETAIL_PAYMENTS_COLUMNS
);

const INVOICE_DETAIL_APPROVALS_COLUMNS: OperationalConfigurableColumnDef<InvoiceApprovalRow>[] = [
  {
    id: "stage",
    label: "Stage",
    renderCell: (approval) => FINANCIAL_APPROVAL_STAGE_LABELS[approval.approval_stage],
  },
  {
    id: "title",
    label: "Title",
    renderCell: (approval) => approval.title,
  },
  {
    id: "status",
    label: "Status",
    cellClassName: "capitalize",
    renderCell: (approval) => approval.status,
  },
  {
    id: "decided",
    label: "Decided",
    cellClassName: "text-muted-foreground",
    renderCell: (approval) =>
      approval.decided_at ? format(new Date(approval.decided_at), "MMM d, yyyy") : "Pending",
  },
];

export const INVOICE_DETAIL_APPROVALS_COLUMN_METAS = getOperationalTableColumnMetas(
  INVOICE_DETAIL_APPROVALS_COLUMNS
);

function InvoiceDetailLinesTable({
  lines,
  currency,
}: {
  lines: InvoiceLineRow[];
  currency: string;
}) {
  const columns = useMemo(
    () =>
      INVOICE_DETAIL_LINES_COLUMNS.map((column) => ({
        ...column,
        renderCell: (line: InvoiceLineRow) => {
          if (column.id === "unit_price") {
            return formatBillingMoney(line.revenue_before_vat, currency);
          }
          if (column.id === "vat_amount") {
            return formatBillingMoney(line.revenue_vat_amount, currency);
          }
          if (column.id === "line_total") {
            return formatBillingMoney(line.line_total, currency);
          }
          return column.renderCell(line);
        },
      })),
    [currency]
  );

  return (
    <OperationalConfigurableTable columns={columns} rows={lines} rowKey={(line) => line.id} />
  );
}

type InvoiceWorkspaceViewProps = {
  invoice: InvoiceWorkspace;
};

export function InvoiceWorkspaceView({ invoice }: InvoiceWorkspaceViewProps) {
  const [paymentState, paymentAction, paymentPending] = useActionState(
    recordCollectionPaymentAction,
    { ok: false } satisfies BillingActionState
  );

  useEffect(() => {
    if (!paymentState.message) return;
    if (paymentState.ok) toast.success(paymentState.message);
    else toast.error(paymentState.message);
  }, [paymentState]);

  const { tabOrder, moveTab } = useWorkspaceTabOrder({
    storageKey: INVOICE_WORKSPACE_TAB_STORAGE_KEY,
    defaultOrder: INVOICE_WORKSPACE_TAB_ORDER,
    isValidId: isInvoiceWorkspaceTabId,
  });

  const tabsById = useMemo(
    (): Record<InvoiceWorkspaceTabId, OperationalWorkspaceTabDef> => ({
      lines: { value: "lines", label: "Line items", count: invoice.lines.length },
      collections: {
        value: "collections",
        label: "Collections",
        count: invoice.payments.length,
      },
      approvals: {
        value: "approvals",
        label: "Approvals",
        count: invoice.approvals.length,
      },
      activity: { value: "activity", label: "Audit", count: invoice.activity.length },
    }),
    [
      invoice.lines.length,
      invoice.payments.length,
      invoice.approvals.length,
      invoice.activity.length,
    ]
  );

  return (
    <div className="space-y-6">
      <OperationalWorkspaceChrome
        backButton={
          <PageBackButton fallbackHref="/billing" label="Back to billing" />
        }
        title={<DocumentNumber value={invoice.document_number} />}
        badges={
          <>
            <CollectionStatusBadge status={invoice.collection_status} />
            <Badge variant="outline" className="capitalize">
              {invoice.status}
            </Badge>
            <InvoiceViewMenu invoiceId={invoice.id} />
          </>
        }
        meta={
          <>
            {invoice.client.name}
            {invoice.campaign ? ` · ${invoice.campaign.name}` : null}
          </>
        }
      />

      <InvoiceRegenerationPanel invoice={invoice} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Subtotal (ex-VAT)"
          value={formatBillingMoney(invoice.subtotal, invoice.currency)}
        />
        <SummaryCard
          label="Output VAT"
          value={formatBillingMoney(invoice.tax_amount, invoice.currency)}
        />
        <SummaryCard label="Grand total" value={formatBillingMoney(invoice.total, invoice.currency)} />
        <SummaryCard
          label="Outstanding"
          value={formatBillingMoney(invoice.outstanding, invoice.currency)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Collected"
          value={formatBillingMoney(invoice.amount_paid, invoice.currency)}
        />
        <SummaryCard
          label="Due date"
          value={
            invoice.due_date
              ? format(new Date(`${invoice.due_date}T00:00:00`), "MMM d, yyyy")
              : "—"
          }
        />
      </div>

      <Tabs defaultValue="lines" className="flex flex-col gap-0">
        <OperationalWorkspaceSortableTabsBar
          sectionLabel="Invoice workspace"
          tabOrder={tabOrder}
          tabsById={tabsById}
          onReorder={moveTab}
        />

        <TabsContent value="lines" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
            <OperationalTableSuiteProvider
              tableId={OPERATIONAL_TABLE_IDS.invoiceDetailLines}
              columns={INVOICE_DETAIL_LINES_COLUMNS}
              rows={invoice.lines}
              filterAccessors={{
                campaign_line: (row: InvoiceLineRow) => row.line_document_number,
                description: (row: InvoiceLineRow) => row.description,
                quantity: (row: InvoiceLineRow) => row.quantity,
                unit_price: (row: InvoiceLineRow) => row.revenue_before_vat,
                vat_percent: (row: InvoiceLineRow) => row.revenue_vat_percent,
                vat_amount: (row: InvoiceLineRow) => row.revenue_vat_amount,
                line_total: (row: InvoiceLineRow) => row.line_total,
              }}
            >
              <OperationalTableSection
                wide
                tableOnly
                cardSurface
                leading={
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <h2 className="text-sm font-semibold tracking-tight text-foreground">
                        Invoice lines
                      </h2>
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        Pulled from campaign lines · revenue locked on invoicing
                      </p>
                    </div>
                    <OperationalTableControlsSlot contextLabel="Invoice lines" />
                  </div>
                }
              >
                <InvoiceDetailLinesTable lines={invoice.lines} currency={invoice.currency} />
              </OperationalTableSection>
            </OperationalTableSuiteProvider>
          </OperationalWorkspaceTabPanel>
        </TabsContent>

        <TabsContent value="collections" className={cn(OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS, "space-y-4")}>
          <OperationalWorkspaceTabPanel className="space-y-4">
          {invoice.outstanding > 0 ? (
            <OperationalFormSection
              title="Record payment"
              footer={
                <Button type="submit" form="record-payment-form" disabled={paymentPending}>
                  Record collection
                </Button>
              }
            >
              <form id="record-payment-form" action={paymentAction} className="grid max-w-md gap-4">
                <input type="hidden" name="invoice_id" value={invoice.id} />
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={invoice.outstanding}
                    defaultValue={invoice.outstanding}
                    className={DETAIL_FORM_INPUT_CLASS}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_method">Method</Label>
                  <Select name="payment_method" defaultValue="bank_transfer">
                    <SelectTrigger id="payment_method" className={DETAIL_FORM_SELECT_TRIGGER_CLASS}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                      <SelectItem value="wire">Wire</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="credit_card">Credit card</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference_number">Reference</Label>
                  <Input id="reference_number" name="reference_number" className={DETAIL_FORM_INPUT_CLASS} />
                </div>
              </form>
            </OperationalFormSection>
          ) : null}

          <OperationalTableSuiteProvider
            tableId={OPERATIONAL_TABLE_IDS.invoiceDetailPayments}
            columns={INVOICE_DETAIL_PAYMENTS_COLUMNS}
            rows={invoice.payments}
            filterAccessors={{
              payment: (row: InvoicePaymentRow) => row.document_number,
              amount: (row: InvoicePaymentRow) => row.amount,
              method: (row: InvoicePaymentRow) => row.payment_method,
              status: (row: InvoicePaymentRow) => row.status,
              paid_at: (row: InvoicePaymentRow) => row.paid_at,
            }}
          >
            <OperationalTableSection
              wide
              tableOnly
              cardSurface
              leading={
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <h2 className="text-sm font-semibold tracking-tight text-foreground">
                      Payment history
                    </h2>
                  </div>
                  <OperationalTableControlsSlot contextLabel="Payment history" />
                </div>
              }
            >
              {invoice.payments.length === 0 ? (
                <p className="px-4 py-8 text-[11px] text-muted-foreground">No payments recorded.</p>
              ) : (
                <OperationalConfigurableTable
                  columns={INVOICE_DETAIL_PAYMENTS_COLUMNS}
                  rows={invoice.payments}
                  rowKey={(payment) => payment.id}
                />
              )}
            </OperationalTableSection>
          </OperationalTableSuiteProvider>
          </OperationalWorkspaceTabPanel>
        </TabsContent>

        <TabsContent value="approvals" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
            <OperationalTableSuiteProvider
              tableId={OPERATIONAL_TABLE_IDS.invoiceDetailApprovals}
              columns={INVOICE_DETAIL_APPROVALS_COLUMNS}
              rows={invoice.approvals}
              filterAccessors={{
                stage: (row: InvoiceApprovalRow) => row.approval_stage,
                title: (row: InvoiceApprovalRow) => row.title,
                status: (row: InvoiceApprovalRow) => row.status,
                decided: (row: InvoiceApprovalRow) => row.decided_at,
              }}
            >
              <OperationalTableSection
                wide
                tableOnly
                cardSurface
                leading={
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <h2 className="text-sm font-semibold tracking-tight text-foreground">
                        Approval chain
                      </h2>
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        Finance → CFO/Admin
                      </p>
                    </div>
                    <OperationalTableControlsSlot contextLabel="Approval chain" />
                  </div>
                }
              >
                {invoice.approvals.length === 0 ? (
                  <p className="px-4 py-8 text-[11px] text-muted-foreground">No approval requests.</p>
                ) : (
                  <OperationalConfigurableTable
                    columns={INVOICE_DETAIL_APPROVALS_COLUMNS}
                    rows={invoice.approvals}
                    rowKey={(approval) => approval.id}
                  />
                )}
              </OperationalTableSection>
            </OperationalTableSuiteProvider>
          </OperationalWorkspaceTabPanel>
        </TabsContent>

        <TabsContent value="activity" className={OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS}>
          <OperationalWorkspaceTabPanel>
          <OperationalTableSection
            wide
            tableOnly
            cardSurface
            leading={
              <div className="min-w-0 space-y-0.5">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Audit trail
                </h2>
              </div>
            }
          >
            {invoice.activity.length === 0 ? (
              <p className="px-4 py-8 text-[11px] text-muted-foreground">No audit entries.</p>
            ) : (
              <ul className="divide-y divide-border/40 px-4 md:px-5">
                {invoice.activity.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-4 last:pb-4"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.summary}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.actor?.full_name ?? item.actor?.email ?? "System"}
                      </p>
                    </div>
                    <time className="text-[11px] text-muted-foreground">
                      {format(new Date(item.created_at), "MMM d, yyyy HH:mm")}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </OperationalTableSection>
          </OperationalWorkspaceTabPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <CampaignFlatSection title={label}>
      <p className="font-heading text-xl font-semibold">{value}</p>
    </CampaignFlatSection>
  );
}
