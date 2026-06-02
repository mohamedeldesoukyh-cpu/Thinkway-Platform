"use client";

import { Fragment, useMemo, useState } from "react";
import { useActionState, useEffect } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  bulkApproveOperationalBillingAction,
  bulkMoveOperationalBillingAction,
  type BillingActionState,
} from "@/features/billing/actions";
import { DeliverableBillingStatusBadge } from "@/features/billing/components/deliverable-billing-status-badge";
import { BillingStatusBadge } from "@/features/billing/components/billing-status-badge";
import type { CampaignOperationalBillingDetail } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import {
  flattenOperationalLeaves,
  isOperationalRowActionEligible,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";

type BillingCampaignDrilldownProps = {
  detail: CampaignOperationalBillingDetail;
  onInvoice?: () => void;
};

type SelectionState = {
  line_ids: Set<string>;
  deliverable_ids: Set<string>;
  post_ids: Set<string>;
};

export function BillingCampaignDrilldown({
  detail,
  onInvoice,
}: BillingCampaignDrilldownProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<SelectionState>({
    line_ids: new Set(),
    deliverable_ids: new Set(),
    post_ids: new Set(),
  });

  const [approveState, approveAction, approvePending] = useActionState(
    bulkApproveOperationalBillingAction,
    { ok: false } satisfies BillingActionState
  );
  const [moveState, moveAction, movePending] = useActionState(
    bulkMoveOperationalBillingAction,
    { ok: false } satisfies BillingActionState
  );

  useEffect(() => {
    for (const state of [approveState, moveState]) {
      if (!state.message) continue;
      if (state.ok) toast.success(state.message);
      else toast.error(state.message);
    }
  }, [approveState, moveState]);

  const selectedCount =
    selection.line_ids.size + selection.deliverable_ids.size + selection.post_ids.size;

  const rollup = detail.rollup;

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleRow(row: OperationalBillingRow) {
    setSelection((prev) => {
      const next = {
        line_ids: new Set(prev.line_ids),
        deliverable_ids: new Set(prev.deliverable_ids),
        post_ids: new Set(prev.post_ids),
      };
      const set =
        row.kind === "assignment"
          ? next.line_ids
          : row.kind === "deliverable_group"
            ? next.deliverable_ids
            : next.post_ids;
      if (set.has(row.id)) set.delete(row.id);
      else set.add(row.id);

      if (process.env.NODE_ENV === "development") {
        console.debug("[billing-drilldown] selection toggled", {
          kind: row.kind,
          id: row.id,
          selected: set.has(row.id),
        });
      }

      return next;
    });
  }

  function isSelected(row: OperationalBillingRow): boolean {
    if (row.kind === "assignment") return selection.line_ids.has(row.id);
    if (row.kind === "deliverable_group") return selection.deliverable_ids.has(row.id);
    return selection.post_ids.has(row.id);
  }

  const hiddenFormFields = useMemo(
    () => ({
      campaign_id: detail.campaign_header_id,
      line_ids: [...selection.line_ids].join(","),
      deliverable_ids: [...selection.deliverable_ids].join(","),
      post_ids: [...selection.post_ids].join(","),
    }),
    [detail.campaign_header_id, selection]
  );

  return (
    <div className="space-y-3 border-t p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-5">
          <span>
            Total:{" "}
            <strong className="text-foreground">
              {formatBillingMoney(rollup.total_campaign_amount, detail.currency_code)}
            </strong>
          </span>
          <span>
            Achieved:{" "}
            <strong className="text-foreground">
              {formatBillingMoney(rollup.achieved_revenue, detail.currency_code)}
            </strong>
          </span>
          <span>
            Invoiced:{" "}
            <strong className="text-foreground">
              {formatBillingMoney(rollup.already_invoiced, detail.currency_code)}
            </strong>
          </span>
          <span>
            Remaining:{" "}
            <strong className="text-foreground">
              {formatBillingMoney(rollup.remaining_to_invoice, detail.currency_code)}
            </strong>
          </span>
          <span>
            Unachieved:{" "}
            <strong className="text-foreground">
              {formatBillingMoney(rollup.unachieved_revenue, detail.currency_code)}
            </strong>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={approveAction}>
            <input type="hidden" name="campaign_id" value={hiddenFormFields.campaign_id} />
            <input type="hidden" name="line_ids" value={hiddenFormFields.line_ids} />
            <input type="hidden" name="deliverable_ids" value={hiddenFormFields.deliverable_ids} />
            <input type="hidden" name="post_ids" value={hiddenFormFields.post_ids} />
            <Button type="submit" size="sm" variant="outline" disabled={approvePending || selectedCount === 0}>
              Bulk approve
            </Button>
          </form>
          <form action={moveAction}>
            <input type="hidden" name="campaign_id" value={hiddenFormFields.campaign_id} />
            <input type="hidden" name="line_ids" value={hiddenFormFields.line_ids} />
            <input type="hidden" name="deliverable_ids" value={hiddenFormFields.deliverable_ids} />
            <input type="hidden" name="post_ids" value={hiddenFormFields.post_ids} />
            <Button type="submit" size="sm" variant="outline" disabled={movePending || selectedCount === 0}>
              Move to billing
            </Button>
          </form>
          {onInvoice ? (
            <Button type="button" size="sm" onClick={onInvoice} disabled={selectedCount === 0}>
              Invoice selected
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-1">
        {detail.operational_rows.map((assignment) => (
          <OperationalRowTree
            key={assignment.id}
            row={assignment}
            depth={0}
            currency={detail.currency_code}
            expanded={expanded}
            onToggleExpand={toggleExpanded}
            isSelected={isSelected}
            onToggleSelect={toggleRow}
          />
        ))}
      </div>
    </div>
  );
}

function OperationalRowTree({
  row,
  depth,
  currency,
  expanded,
  onToggleExpand,
  isSelected,
  onToggleSelect,
}: {
  row: OperationalBillingRow;
  depth: number;
  currency: string;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  isSelected: (row: OperationalBillingRow) => boolean;
  onToggleSelect: (row: OperationalBillingRow) => void;
}) {
  const hasChildren = row.children.length > 0;
  const isOpen = expanded.has(row.id);
  const eligible = isOperationalRowActionEligible(row);
  const indent = depth * 16;

  return (
    <Fragment>
      <div
        className="flex items-center gap-2 rounded-2xl px-2 py-1.5 hover:bg-muted/40"
        style={{ paddingLeft: indent + 8 }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="rounded p-0.5 hover:bg-muted"
            onClick={() => onToggleExpand(row.id)}
          >
            {isOpen ? (
              <ChevronDownIcon className="size-3.5" />
            ) : (
              <ChevronRightIcon className="size-3.5" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <input
          type="checkbox"
          className="size-4 rounded border-border"
          checked={isSelected(row)}
          onChange={() => onToggleSelect(row)}
          disabled={!eligible}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{row.label}</p>
            {row.document_number ? (
              <span className="font-mono text-[10px] text-muted-foreground">
                {row.document_number}
              </span>
            ) : null}
            {row.kind === "assignment" ? (
              <BillingStatusBadge status={row.line_billing_status} />
            ) : (
              <DeliverableBillingStatusBadge
                status={row.billing_status as import("@/features/billing/types").AssignmentDeliverableBillingStatus}
              />
            )}
            {row.is_locked ? (
              <span className="text-[10px] text-muted-foreground">Locked</span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatBillingMoney(row.remaining_amount, currency)} remaining ·{" "}
            {formatBillingMoney(row.invoiced_amount, currency)} invoiced
            {row.invoice_document_number ? ` · ${row.invoice_document_number}` : ""}
          </p>
        </div>
      </div>
      {isOpen
        ? row.children.map((child) => (
            <OperationalRowTree
              key={child.id}
              row={child}
              depth={depth + 1}
              currency={currency}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              isSelected={isSelected}
              onToggleSelect={onToggleSelect}
            />
          ))
        : null}
    </Fragment>
  );
}
