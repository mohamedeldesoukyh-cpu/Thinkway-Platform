"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ChevronDownIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { showErrorToastOnce, showSuccessToastOnce, resetToastOnce } from "@/lib/ui/toast-once";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  OperationalFloatingActionBar,
  operationalFloatingBarContentClass,
} from "@/components/workspace/operational-floating-action-bar";
import { DeliverableBillingStatusBadge } from "@/features/billing/components/deliverable-billing-status-badge";
import { createInvoiceFromLinesAction,
  type BillingActionState,
} from "@/features/billing/actions";
import type { AssignmentBillingGroup } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import { isDeliverableInvoiceEligible } from "@/lib/billing/deliverable-billing";
import { cn } from "@/lib/utils";

type CreateInvoiceSheetProps = {
  campaignId: string;
  groups: AssignmentBillingGroup[];
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSelectedIds?: string[];
  appendableInvoices?: import("@/features/billing/types").AppendableInvoiceOption[];
  rollup?: {
    total_campaign_amount: number;
    achieved_revenue: number;
    already_invoiced: number;
    remaining_to_invoice: number;
    unachieved_revenue: number;
  };
};

/** @deprecated Prefer InvoiceGenerationSheet for finance-first partial billing. */
export function CreateInvoiceSheet({
  campaignId,
  groups,
  currency,
  open,
  onOpenChange,
  initialSelectedIds,
}: CreateInvoiceSheetProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && initialSelectedIds?.length) {
      setSelected(new Set(initialSelectedIds));
      setExpanded(
        new Set(
          groups
            .filter((g) =>
              g.deliverables.some((d) => initialSelectedIds.includes(d.id))
            )
            .map((g) => g.line_id)
        )
      );
    }
    if (!open) {
      setSelected(new Set());
    }
  }, [open, initialSelectedIds, groups]);

  const eligibleGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          deliverables: group.deliverables.filter((d) =>
            isDeliverableInvoiceEligible(d, group.billing_status)
          ),
        }))
        .filter((g) => g.deliverables.length > 0),
    [groups]
  );

  const [state, formAction, pending] = useActionState(
    createInvoiceFromLinesAction,
    { ok: false } satisfies BillingActionState
  );
  const handledActionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      handledActionRef.current = null;
      resetToastOnce("create-invoice");
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!state.message) return;
    const actionKey = `${state.ok}:${state.message}`;
    if (handledActionRef.current === actionKey) return;
    handledActionRef.current = actionKey;

    if (state.ok) {
      showSuccessToastOnce(state.message, { id: "create-invoice" });
      onOpenChange(false);
      setSelected(new Set());
    } else {
      showErrorToastOnce(state.message, { id: "create-invoice" });
    }
  }, [state.message, state.ok, onOpenChange]);

  function toggleDeliverable(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(group: AssignmentBillingGroup) {
    const ids = group.deliverables.map((d) => d.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function toggleExpanded(lineId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }

  const selectedDeliverables = eligibleGroups.flatMap((g) =>
    g.deliverables.filter((d) => selected.has(d.id))
  );

  const selectedTotal = selectedDeliverables.reduce(
    (sum, d) => sum + d.remaining_amount,
    0
  );

  const alreadyInvoicedTotal = eligibleGroups.reduce(
    (sum, g) => sum + g.invoiced_value,
    0
  );

  const assignmentTotal = eligibleGroups.reduce(
    (sum, g) => sum + g.total_value,
    0
  );

  const remainingAfterInvoice = Math.max(
    0,
    assignmentTotal - alreadyInvoicedTotal - selectedTotal
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Create invoice</SheetTitle>
          <SheetDescription>
            Select individual deliverables or entire assignments. Invoiced
            deliverables are locked; uninvoiced items remain editable.
          </SheetDescription>
        </SheetHeader>

        <form id="create-invoice-sheet-form" action={formAction} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="campaign_id" value={campaignId} />
          <input type="hidden" name="post_ids" value="" />
          <input type="hidden" name="invoice_mode" value="new" />
          <input type="hidden" name="existing_invoice_id" value="" />
          <input
            type="hidden"
            name="deliverable_ids"
            value={[...selected].join(",")}
          />

          <div
            className={cn(
              "min-h-0 flex-1 space-y-3 overflow-y-auto py-4",
              operationalFloatingBarContentClass(selected.size > 0)
            )}
          >
            {eligibleGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No deliverables ready for invoicing. Approve assignments and move
                them to billing first.
              </p>
            ) : (
              eligibleGroups.map((group) => {
                const isOpen = expanded.has(group.line_id);
                const groupSelected = group.deliverables.every((d) =>
                  selected.has(d.id)
                );
                const groupPartial =
                  group.deliverables.some((d) => selected.has(d.id)) &&
                  !groupSelected;
                const title =
                  group.influencer_name != null
                    ? `${group.influencer_name} — ${group.pricing_mode === "package" ? "Package" : "Per deliverable"}`
                    : group.name;

                return (
                  <div
                    key={group.line_id}
                    className="rounded-3xl border"
                  >
                    <div className="flex items-start gap-2 p-3">
                      <button
                        type="button"
                        className="mt-0.5 rounded p-1 hover:bg-muted"
                        onClick={() => toggleExpanded(group.line_id)}
                      >
                        {isOpen ? (
                          <ChevronDownIcon className="size-4" />
                        ) : (
                          <ChevronRightIcon className="size-4" />
                        )}
                      </button>
                      <input
                        type="checkbox"
                        className="mt-1 size-4 rounded border-border"
                        checked={groupSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = groupPartial;
                        }}
                        onChange={() => toggleGroup(group)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBillingMoney(group.total_value, currency)} total ·{" "}
                          {formatBillingMoney(group.invoiced_value, currency)} invoiced ·{" "}
                          {formatBillingMoney(group.remaining_value, currency)} remaining
                        </p>
                      </div>
                    </div>

                    {isOpen ? (
                      <div className="space-y-2 border-t px-3 py-2">
                        {group.deliverables.map((deliverable) => (
                          <label
                            key={deliverable.id}
                            className="flex cursor-pointer items-start gap-3 rounded-2xl p-2 hover:bg-muted/50"
                          >
                            <input
                              type="checkbox"
                              className="mt-1 size-4 rounded border-border"
                              checked={selected.has(deliverable.id)}
                              onChange={() => toggleDeliverable(deliverable.id)}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium">
                                  {deliverable.label}
                                </p>
                                <DeliverableBillingStatusBadge
                                  status={deliverable.billing_status}
                                />
                              </div>
                              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                {deliverable.live_date ? (
                                  <span>
                                    Live{" "}
                                    {format(
                                      new Date(`${deliverable.live_date}T00:00:00`),
                                      "MMM d, yyyy"
                                    )}
                                  </span>
                                ) : null}
                                <span>
                                  Uninvoiced{" "}
                                  {formatBillingMoney(
                                    deliverable.remaining_amount,
                                    currency
                                  )}
                                </span>
                                {deliverable.invoiced_amount > 0 ? (
                                  <span>
                                    Invoiced{" "}
                                    {formatBillingMoney(
                                      deliverable.invoiced_amount,
                                      currency
                                    )}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="due_date">Due date</Label>
              <Input id="due_date" name="due_date" type="date" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>
          </div>

          <SheetFooter className="px-0 pt-4">
            <Button type="submit" disabled={pending || selected.size === 0} className="w-full sm:hidden">
              Create invoice
            </Button>
          </SheetFooter>
        </form>

        <OperationalFloatingActionBar visible={selected.size > 0}>
          <Badge
            variant="secondary"
            className="h-6 shrink-0 rounded-full px-2.5 text-[11px] font-semibold"
          >
            {selected.size} selected
          </Badge>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="size-6 shrink-0 rounded-full text-muted-foreground"
            onClick={() => setSelected(new Set())}
            aria-label="Clear selection"
          >
            <XIcon className="size-3.5" />
          </Button>
          <span className="shrink-0 text-xs text-muted-foreground">
            Invoice{" "}
            <span className="font-semibold text-foreground">
              {formatBillingMoney(selectedTotal, currency)}
            </span>
          </span>
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
            Remaining {formatBillingMoney(remainingAfterInvoice, currency)}
          </span>
          <Button
            type="submit"
            form="create-invoice-sheet-form"
            size="sm"
            className="ml-auto h-8 shrink-0 rounded-full text-xs"
            disabled={pending}
          >
            {pending ? "Creating…" : "Create invoice"}
          </Button>
        </OperationalFloatingActionBar>
      </SheetContent>
    </Sheet>
  );
}
