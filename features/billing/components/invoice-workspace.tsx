"use client";

import { useActionState, useEffect, useMemo, useState, type CSSProperties } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DocumentNumber } from "@/components/ui/document-number";
import {
  FinanceSuiteEmpty,
} from "@/components/finance/suite";
import { InvoiceWorkspaceKpiStrip } from "@/features/billing/components/invoice-workspace-kpi-strip";
import { InvoiceRegenerationPanel } from "@/features/billing/components/invoice-regeneration-panel";
import { InvoiceViewMenu } from "@/features/billing/components/invoice-view-menu";
import {
  decideFinancialApprovalAction,
  recordCollectionPaymentAction,
  type BillingActionState,
} from "@/features/billing/actions";
import {
  COLLECTION_STATUS_LABELS,
  FINANCIAL_APPROVAL_CHAIN,
  FINANCIAL_APPROVAL_STAGE_LABELS,
} from "@/features/billing/constants";
import type { CollectionStatus, InvoiceWorkspace } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { navigateBack } from "@/lib/navigation/go-back";

type InvoiceLineRow = InvoiceWorkspace["lines"][number];
type InvoicePaymentRow = InvoiceWorkspace["payments"][number];
type InvoiceApprovalRow = InvoiceWorkspace["approvals"][number];
type InvoiceActivityRow = InvoiceWorkspace["activity"][number];
type InvoiceDetailTab = "lines" | "coll" | "appr" | "audit";

const LINE_COLS = "30px 116px minmax(200px,1fr) 54px 132px 62px 124px 138px";
const PAYMENT_COLS = "30px 116px 130px 130px minmax(150px,1fr) 130px 110px";
const APPROVAL_COLS = "30px 130px minmax(200px,1fr) 120px 130px 150px";
const AUDIT_COLS = "30px 76px 116px 130px minmax(160px,1fr) 90px";

function colsStyle(cols: string): CSSProperties {
  return { ["--cols"]: cols } as CSSProperties;
}

function formatLedgerAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function titleCase(value: string): string {
  if (!value) return value;
  return value.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function collectionPillClass(status: CollectionStatus): string {
  switch (status) {
    case "pending":
      return "p-y";
    case "partial":
      return "p-b";
    case "collected":
      return "p-g";
    case "overdue":
      return "p-r";
    case "written_off":
      return "p-n";
    default:
      return "p-n";
  }
}

function documentStatusPillClass(status: string): string {
  switch (status.toLowerCase()) {
    case "draft":
      return "p-n";
    case "issued":
    case "sent":
      return "p-b";
    case "paid":
      return "p-g";
    case "void":
    case "cancelled":
    case "canceled":
      return "p-r";
    default:
      return "p-n";
  }
}

function approvalStagePillClass(stage: InvoiceApprovalRow["approval_stage"]): string {
  if (stage === "finance") return "p-b";
  if (stage === "cfo_admin") return "p-v";
  return "p-g";
}

function approvalStatusPillClass(status: string): string {
  switch (status.toLowerCase()) {
    case "approved":
      return "p-g";
    case "rejected":
      return "p-r";
    default:
      return "p-y";
  }
}

function chainStatus(
  approvals: InvoiceApprovalRow[],
  stage: (typeof FINANCIAL_APPROVAL_CHAIN)[number]
): { label: string; pill: string } {
  const row = approvals.find((approval) => approval.approval_stage === stage);
  if (!row) return { label: "missing", pill: "p-r" };
  const status = row.status.toLowerCase();
  if (status === "approved") return { label: "Approved", pill: "p-g" };
  if (status === "rejected") return { label: "Rejected", pill: "p-r" };
  return { label: titleCase(row.status), pill: "p-y" };
}

type InvoiceWorkspaceViewProps = {
  invoice: InvoiceWorkspace;
};

export function InvoiceWorkspaceView({ invoice }: InvoiceWorkspaceViewProps) {
  const router = useRouter();
  const [tab, setTab] = useState<InvoiceDetailTab>("lines");
  const campaignNo = invoice.campaign
    ? formatDocumentNumberForDisplay(invoice.campaign.document_number)
    : null;
  const identityMeta = [invoice.client.name, invoice.campaign?.name, campaignNo]
    .filter(Boolean)
    .join(" · ");

  const tabs: { id: InvoiceDetailTab; label: string; count: number }[] = [
    { id: "lines", label: "Line items", count: invoice.lines.length },
    { id: "coll", label: "Collections", count: invoice.payments.length },
    { id: "appr", label: "Approvals", count: invoice.approvals.length },
    { id: "audit", label: "Audit", count: invoice.activity.length },
  ];

  return (
    <>
      <div className="tw-c">
        <div className="tw-ch tw-inv-identity">
          <button
            type="button"
            className="tw-b sm"
            onClick={() => navigateBack(router, "/billing")}
          >
            ← Back to billing
          </button>
          <DocumentNumber value={invoice.document_number} className="tw-inv-no" />
          <span className={`tw-p ${collectionPillClass(invoice.collection_status)}`}>
            {COLLECTION_STATUS_LABELS[invoice.collection_status]}
          </span>
          <span className={`tw-p ${documentStatusPillClass(invoice.status)}`}>
            {titleCase(invoice.status)}
          </span>
          <span className="tw-cs">{identityMeta}</span>
          <span className="tw-sp" />
          <InvoiceViewMenu invoiceId={invoice.id} suite />
          <a
            className="tw-b sm"
            href={`/api/invoices/${invoice.id}/document?format=pdf&download=1`}
          >
            Download PDF
          </a>
          <a
            className="tw-b sm pri"
            href={`/billing/invoices/${invoice.id}/preview?layout=detailed`}
            target="_blank"
            rel="noreferrer"
          >
            Send to client
          </a>
        </div>
        <InvoiceRegenerationPanel invoice={invoice} />
      </div>

      <InvoiceWorkspaceKpiStrip invoice={invoice} />

      <div className="tw-c">
        <div className="tw-ch">
          <span className="tw-lbl tw-inv-ws-lbl">Invoice workspace</span>
          <span className="tw-sp" />
          <span className="tw-seg">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={tab === item.id}
                onClick={() => setTab(item.id)}
              >
                {item.label} <em>{item.count}</em>
              </button>
            ))}
          </span>
        </div>

        {tab === "lines" ? (
          <InvoiceLinesTab invoice={invoice} campaignNo={campaignNo} />
        ) : null}
        {tab === "coll" ? <InvoiceCollectionsTab invoice={invoice} /> : null}
        {tab === "appr" ? <InvoiceApprovalsTab invoice={invoice} /> : null}
        {tab === "audit" ? <InvoiceAuditTab invoice={invoice} /> : null}
      </div>
    </>
  );
}

function InvoiceLinesTab({
  invoice,
  campaignNo,
}: {
  invoice: InvoiceWorkspace;
  campaignNo: string | null;
}) {
  const qtyTotal = invoice.lines.reduce((sum, line) => sum + line.quantity, 0);
  const lineLabel = invoice.lines.length === 1 ? "line" : "lines";
  const footerSource = campaignNo
    ? `${invoice.lines.length} ${lineLabel} pulled from campaign ${campaignNo} · revenue locked on invoicing`
    : `${invoice.lines.length} ${lineLabel} · revenue locked on invoicing`;

  return (
    <>
      <div className="tw-sc">
        <div style={{ minWidth: 940 }}>
          <div className="tw-g tw-hr" style={colsStyle(LINE_COLS)}>
            <span />
            <span>Campaign line</span>
            <span>Description</span>
            <span className="tw-rr">Qty</span>
            <span className="tw-rr">Unit (ex-VAT)</span>
            <span className="tw-rr">VAT %</span>
            <span className="tw-rr">VAT</span>
            <span className="tw-rr">Line total</span>
          </div>
          {invoice.lines.map((line) => (
            <InvoiceLineRowView key={line.id} line={line} />
          ))}
          <div className="tw-g tw-ft" style={colsStyle(LINE_COLS)}>
            <span />
            <span />
            <span>{footerSource}</span>
            <span className="tw-v">{qtyTotal}</span>
            <span className="tw-v">{formatLedgerAmount(invoice.subtotal)}</span>
            <span />
            <span className="tw-v">{formatLedgerAmount(invoice.tax_amount)}</span>
            <span className="tw-v">{formatLedgerAmount(invoice.total)}</span>
          </div>
        </div>
      </div>
      <div className="tw-note">
        Lines are pulled from the campaign and locked on invoicing, so the only way to
        correct one is <b>Un-generate</b> — which is why that control sits at the top
        rather than inside a menu.
      </div>
    </>
  );
}

function InvoiceLineRowView({ line }: { line: InvoiceLineRow }) {
  const vatLabel = line.revenue_vat_exempt ? "Exempt" : `${line.revenue_vat_percent}%`;
  return (
    <div className="tw-g tw-r" style={colsStyle(LINE_COLS)}>
      <span>
        <input type="checkbox" className="tw-ck" aria-label="Select line" />
      </span>
      <span className="tw-id">
        <DocumentNumber value={line.line_document_number} fallback="—" />
      </span>
      <span>
        <span className="tw-nm" title={line.description}>
          {line.description}
        </span>
        {line.deliverable_label ? <span className="tw-s">{line.deliverable_label}</span> : null}
      </span>
      <span className="tw-v">{line.quantity}</span>
      <span className="tw-v">{formatLedgerAmount(line.revenue_before_vat)}</span>
      <span className="tw-v">{vatLabel}</span>
      <span className="tw-v">{formatLedgerAmount(line.revenue_vat_amount)}</span>
      <span className="tw-v">
        <b>{formatLedgerAmount(line.line_total)}</b>
      </span>
    </div>
  );
}

function InvoiceCollectionsTab({ invoice }: { invoice: InvoiceWorkspace }) {
  const [paymentState, paymentAction, paymentPending] = useActionState(
    recordCollectionPaymentAction,
    { ok: false } satisfies BillingActionState
  );

  useEffect(() => {
    if (!paymentState.message) return;
    if (paymentState.ok) toast.success(paymentState.message);
    else toast.error(paymentState.message);
  }, [paymentState]);

  return (
    <>
      <div className="tw-pad tw-coll-form">
        <div className="tw-lbl">Record payment</div>
        <form action={paymentAction} className="tw-coll-grid">
          <input type="hidden" name="invoice_id" value={invoice.id} />
          <div>
            <label className="tw-lbl" htmlFor="amount">
              Amount
            </label>
            <input
              id="amount"
              name="amount"
              className="tw-in"
              placeholder="0.00"
              inputMode="decimal"
              type="number"
              step="0.01"
              min="0.01"
              max={invoice.outstanding || undefined}
              defaultValue={invoice.outstanding || undefined}
              required
            />
          </div>
          <div>
            <label className="tw-lbl" htmlFor="currency">
              Currency
            </label>
            <input id="currency" className="tw-in" value={invoice.currency} readOnly />
          </div>
          <div>
            <label className="tw-lbl" htmlFor="payment_method">
              Method
            </label>
            <select
              id="payment_method"
              name="payment_method"
              className="tw-in"
              defaultValue="bank_transfer"
            >
              <option value="bank_transfer">Bank transfer</option>
              <option value="wire">Wire</option>
              <option value="check">Check</option>
              <option value="credit_card">Credit card</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="tw-lbl" htmlFor="value_date">
              Value date
            </label>
            <input id="value_date" className="tw-in" type="date" />
          </div>
          <div>
            <label className="tw-lbl" htmlFor="reference_number">
              Reference
            </label>
            <input
              id="reference_number"
              name="reference_number"
              className="tw-in"
              placeholder="Bank ref / cheque no."
            />
          </div>
          <div>
            <button
              type="submit"
              className="tw-b pri tw-coll-submit"
              disabled={paymentPending || invoice.outstanding <= 0}
            >
              {paymentPending ? "Recording…" : "Record collection"}
            </button>
          </div>
        </form>
      </div>

      <div className="tw-sc">
        <div style={{ minWidth: 880 }}>
          <div className="tw-g tw-hr" style={colsStyle(PAYMENT_COLS)}>
            <span />
            <span>Date</span>
            <span className="tw-rr">Amount</span>
            <span>Method</span>
            <span>Reference</span>
            <span>Recorded by</span>
            <span>State</span>
          </div>
          {invoice.payments.map((payment) => (
            <InvoicePaymentRowView key={payment.id} payment={payment} />
          ))}
        </div>
      </div>

      {invoice.payments.length === 0 ? (
        <FinanceSuiteEmpty
          title="No payments recorded"
          body={`Outstanding is ${formatBillingMoney(invoice.outstanding, invoice.currency)} and collected is ${formatBillingMoney(invoice.amount_paid, invoice.currency)}. Nothing has been received against this invoice.`}
        />
      ) : null}
    </>
  );
}

function InvoicePaymentRowView({ payment }: { payment: InvoicePaymentRow }) {
  return (
    <div className="tw-g tw-r" style={colsStyle(PAYMENT_COLS)}>
      <span>
        <input type="checkbox" className="tw-ck" aria-label="Select payment" />
      </span>
      <span className="tw-d">
        {payment.paid_at ? format(new Date(payment.paid_at), "MMM d, yyyy") : "—"}
      </span>
      <span className="tw-v">{formatLedgerAmount(payment.amount)}</span>
      <span className="tw-t">{titleCase(payment.payment_method)}</span>
      <span className="tw-id">
        <DocumentNumber value={payment.document_number} fallback="—" />
      </span>
      <span className="tw-miss">—</span>
      <span>
        <span className={`tw-p ${approvalStatusPillClass(payment.status)}`}>
          {titleCase(payment.status)}
        </span>
      </span>
    </div>
  );
}

function InvoiceApprovalsTab({ invoice }: { invoice: InvoiceWorkspace }) {
  const displayNo = formatDocumentNumberForDisplay(invoice.document_number);

  return (
    <>
      <div className="tw-pad tw-appr-chain">
        <div className="tw-lbl">Approval chain</div>
        <div className="tw-appr-pills">
          {FINANCIAL_APPROVAL_CHAIN.map((stage, index) => {
            const status = chainStatus(invoice.approvals, stage);
            return (
              <span key={stage} className="tw-appr-step">
                {index > 0 ? <span className="tw-appr-arrow">→</span> : null}
                <span
                  className={`tw-p ${status.pill} tw-appr-pill`}
                >
                  {FINANCIAL_APPROVAL_STAGE_LABELS[stage]} · {status.label}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      <div className="tw-sc">
        <div style={{ minWidth: 860 }}>
          <div className="tw-g tw-hr" style={colsStyle(APPROVAL_COLS)}>
            <span />
            <span>Stage</span>
            <span>Title</span>
            <span>Status</span>
            <span>Decided</span>
            <span className="tw-rr">Action</span>
          </div>
          {invoice.approvals.map((approval) => (
            <InvoiceApprovalRowView
              key={approval.id}
              approval={approval}
              fallbackTitle={`Invoice ${displayNo} — ${approval.approval_stage}`}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function InvoiceApprovalRowView({
  approval,
  fallbackTitle,
}: {
  approval: InvoiceApprovalRow;
  fallbackTitle: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    decideFinancialApprovalAction,
    { ok: false } satisfies BillingActionState
  );
  const pendingDecision = approval.status.toLowerCase() === "pending";

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      router.refresh();
    } else {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <div
      className={`tw-g tw-r${pendingDecision ? " wrn" : ""}`}
      style={colsStyle(APPROVAL_COLS)}
    >
      <span>
        <input type="checkbox" className="tw-ck" aria-label="Select stage" />
      </span>
      <span>
        <span className={`tw-p ${approvalStagePillClass(approval.approval_stage)}`}>
          {FINANCIAL_APPROVAL_STAGE_LABELS[approval.approval_stage]}
        </span>
      </span>
      <span className="tw-nm">{approval.title || fallbackTitle}</span>
      <span>
        <span className={`tw-p ${approvalStatusPillClass(approval.status)}`}>
          {titleCase(approval.status)}
        </span>
      </span>
      {approval.decided_at ? (
        <span className="tw-d">{format(new Date(approval.decided_at), "MMM d, yyyy")}</span>
      ) : (
        <span className="tw-miss">not decided</span>
      )}
      <span className="tw-act">
        {pendingDecision ? (
          <>
            <form action={formAction}>
              <input type="hidden" name="approval_id" value={approval.id} />
              <input type="hidden" name="decision" value="rejected" />
              <button type="submit" className="tw-b sm" disabled={pending}>
                Reject
              </button>
            </form>
            <form action={formAction}>
              <input type="hidden" name="approval_id" value={approval.id} />
              <input type="hidden" name="decision" value="approved" />
              <button type="submit" className="tw-b sm pri" disabled={pending}>
                Approve
              </button>
            </form>
          </>
        ) : null}
      </span>
    </div>
  );
}

function InvoiceAuditTab({ invoice }: { invoice: InvoiceWorkspace }) {
  const grouped = useMemo(() => {
    const days = new Map<string, InvoiceActivityRow[]>();
    for (const item of invoice.activity) {
      const day = format(new Date(item.created_at), "MMM d, yyyy");
      const list = days.get(day) ?? [];
      list.push(item);
      days.set(day, list);
    }
    return [...days.entries()];
  }, [invoice.activity]);

  if (invoice.activity.length === 0) {
    return (
      <FinanceSuiteEmpty
        title="No audit entries"
        body="Nothing has been recorded against this invoice yet."
      />
    );
  }

  return (
    <div className="tw-sc">
      <div style={{ minWidth: 880 }}>
        <div className="tw-g tw-hr" style={colsStyle(AUDIT_COLS)}>
          <span>Action</span>
          <span>Time</span>
          <span>Table</span>
          <span>Actor</span>
          <span>What changed</span>
          <span className="tw-rr">Act</span>
        </div>
        {grouped.map(([day, events]) => (
          <div key={day}>
            <div className="tw-gp">
              {day}
              <em>
                {events.length} event{events.length === 1 ? "" : "s"}
              </em>
            </div>
            {events.map((item) => (
              <InvoiceAuditRowView key={item.id} item={item} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function InvoiceAuditRowView({ item }: { item: InvoiceActivityRow }) {
  const actorName = item.actor?.full_name ?? item.actor?.email ?? "System";
  const isSystem = actorName === "System";
  const isPayment =
    item.entity_type === "payments" || item.entity_type === "payment";
  const action = (item.action || "update").toLowerCase();

  return (
    <div className={`tw-g tw-r${isPayment ? " bad" : ""}`} style={colsStyle(AUDIT_COLS)}>
      <span>
        <span className={`tw-p ${action === "create" ? "p-g" : "p-b"} tw-audit-act`}>
          {action}
        </span>
      </span>
      <span className="tw-d">{format(new Date(item.created_at), "HH:mm")}</span>
      <span className="tw-id">{item.entity_type}</span>
      <span className={isSystem ? "tw-miss" : "tw-t"}>{actorName}</span>
      <span className={item.summary ? "tw-t" : "tw-miss"}>
        {item.summary || "no field-level detail recorded"}
      </span>
      <span className="tw-act" />
    </div>
  );
}
