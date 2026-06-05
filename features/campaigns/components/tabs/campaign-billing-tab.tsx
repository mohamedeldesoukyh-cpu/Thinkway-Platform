"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import {
  AlertTriangleIcon,
  PlusIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableCell,
  CampaignOperationalTableCellAmount,
  CampaignOperationalTableCellMono,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import { FinanceInvoiceRegisterTable } from "@/features/finance/invoices/components/finance-invoice-register-table";
import type { FinanceInvoiceRegisterRow } from "@/features/finance/invoices/types";
import { AssignmentBillingGroupsTable } from "@/features/billing/components/assignment-billing-groups-table";
import { BillingCampaignDrilldown } from "@/features/billing/components/billing-campaign-drilldown";
import {
  CampaignBillingQueueTable,
  CampaignBillingQueueToolbar,
} from "@/features/campaigns/components/tabs/campaign-billing-queue-table";
import { CreateInvoiceSheet } from "@/features/billing/components/create-invoice-sheet";
import { InvoiceGenerationSheet } from "@/features/billing/components/invoice-generation-sheet";
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
import { formatMoney } from "@/features/campaigns/utils";
import { buildConsolidatedInvoiceQueueRows } from "@/lib/billing/consolidated-invoice-queue";
import { cn } from "@/lib/utils";

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

  const poWarnings = billingLines.filter((l) => l.po_over_consumed);
  const headerPoExceeded = financials.po_exceeded;

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

  function handleQueueGenerateInvoice() {
    if (!operationalBilling || selectedQueueBatchKeys.size === 0) return;
    const payload = buildConsolidatedQueueInvoiceSelection(
      operationalBilling.operational_rows
    );
    setInvoiceSelection(payload);
    setOperationalInvoiceOpen(true);
  }

  return (
    <div className="space-y-4">
      {headerPoExceeded ? (
        <div className="flex items-start gap-2 rounded-3xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Campaign PO exceeded</p>
            <p>
              Consumed {formatMoney(financials.po_consumed, currency)} exceeds approved PO{" "}
              {formatMoney(financials.po_total, currency)}
              {financials.po_consumed > financials.po_total
                ? ` by ${formatMoney(financials.po_consumed - financials.po_total, currency)}`
                : null}
              . Warning only — assignments remain editable.
            </p>
          </div>
        </div>
      ) : poWarnings.length > 0 ? (
        <div className="flex items-start gap-2 rounded-3xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">PO over-consumption warning</p>
            <p>
              {poWarnings.length} line{poWarnings.length === 1 ? "" : "s"} exceed
              PO allocation. Finance override required before billing.
            </p>
          </div>
        </div>
      ) : null}

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
                setInvoiceSelection(undefined);
                setOperationalInvoiceOpen(true);
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

      <CampaignBillingKpiStrip workspace={workspace} />

      {operationalBilling ? (
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <CampaignOperationalSectionHeader
              title="Billing queue"
              description="Consolidated invoice candidates. Select rows to invoice, or click the campaign number to open operational detail below."
            />
          }
          toolbar={
            <CampaignBillingQueueToolbar
              rows={billingQueueRows}
              selectedBatchKeys={selectedQueueBatchKeys}
              onSelectAll={handleQueueSelectAll}
              onClear={() => setSelectedQueueBatchKeys(new Set())}
              onGenerateInvoice={handleQueueGenerateInvoice}
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
      ) : null}

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
              drilldownVisible && operationalBilling ? (
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
        {!operationalBilling ? (
          <div className="p-4">
            <AssignmentBillingGroupsTable
              groups={billingGroups}
              billingLines={billingLines}
              currency={currency}
              campaignId={workspace.id}
            />
          </div>
        ) : !drilldownVisible ? (
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
                setInvoiceSelection(selection);
                setOperationalInvoiceOpen(true);
              }}
            />
          </div>
        )}
      </OperationalTableSection>

      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <CampaignOperationalSectionHeader
            title="Invoices"
            description="Client invoices linked to this campaign."
          />
        }
      >
        <FinanceInvoiceRegisterTable
          rows={campaignInvoiceRegister}
          showUngenerate
          appearance="campaign"
        />
      </OperationalTableSection>

      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <CampaignOperationalSectionHeader
            title="Payments"
            description="Recorded payments against campaign invoices."
          />
        }
      >
        {workspace.payments.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">No payments recorded.</p>
        ) : (
          <CampaignOperationalTable>
            <CampaignOperationalTableHeader>
              <CampaignOperationalTableHeaderRow>
                <CampaignOperationalTableHead>Payment</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>Invoice</CampaignOperationalTableHead>
                <CampaignOperationalTableHead className="text-right">Amount</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>Status</CampaignOperationalTableHead>
                <CampaignOperationalTableHead>Paid at</CampaignOperationalTableHead>
              </CampaignOperationalTableHeaderRow>
            </CampaignOperationalTableHeader>
            <CampaignOperationalTableBody>
              {workspace.payments.map((p) => (
                <CampaignOperationalTableRow key={p.id}>
                  <CampaignOperationalTableCellMono>{p.document_number}</CampaignOperationalTableCellMono>
                  <CampaignOperationalTableCellMono>
                    {p.invoice_document_number}
                  </CampaignOperationalTableCellMono>
                  <CampaignOperationalTableCellAmount>
                    {formatOperationalAmount(p.amount)}
                  </CampaignOperationalTableCellAmount>
                  <CampaignOperationalTableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {p.status}
                    </Badge>
                  </CampaignOperationalTableCell>
                  <CampaignOperationalTableCell className="text-muted-foreground">
                    {formatBillingDateTime(p.paid_at)}
                  </CampaignOperationalTableCell>
                </CampaignOperationalTableRow>
              ))}
            </CampaignOperationalTableBody>
          </CampaignOperationalTable>
        )}
      </OperationalTableSection>

      <CreateInvoiceSheet
        campaignId={workspace.id}
        groups={billingGroups}
        currency={currency}
        open={legacyInvoiceOpen}
        onOpenChange={setLegacyInvoiceOpen}
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
          open={operationalInvoiceOpen}
          onInvoiceComplete={() => router.refresh()}
          onOpenChange={(open) => {
            setOperationalInvoiceOpen(open);
            if (!open) setInvoiceSelection(undefined);
          }}
        />
      ) : null}
    </div>
  );
}
