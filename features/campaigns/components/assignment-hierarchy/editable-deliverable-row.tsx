"use client";

import Link from "next/link";
import { CheckIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteAssignmentDeliverableAction,
  updateAssignmentDeliverableAction,
} from "@/features/campaigns/actions/assignment-deliverable-actions";
import { DeliverableBillingBadge } from "@/features/campaigns/components/assignment-hierarchy/deliverable-billing-badge";
import { DeliverableScheduleGrid } from "@/features/campaigns/components/assignment-hierarchy/deliverable-schedule-grid";
import { DeliverableWorkflowBadge } from "@/features/campaigns/components/assignment-hierarchy/deliverable-workflow-badge";
import {
  platformShortLabel,
} from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import { DeliverableTypeTag } from "@/features/campaigns/components/assignment-hierarchy/deliverable-type-tag";
import { PLATFORM_OPTIONS } from "@/features/campaigns/constants";
import { PLATFORM_DELIVERABLES } from "@/features/campaigns/line-assignment";
import type { AssignmentDeliverableHierarchyRow } from "@/features/campaigns/types/assignment-hierarchy";
import { formatMoney } from "@/features/campaigns/utils";
import { computeVatLine } from "@/lib/vat/calculations";
import { cn } from "@/lib/utils";

type EditableDeliverableRowProps = {
  campaignId: string;
  campaignLineId: string;
  deliverable: AssignmentDeliverableHierarchyRow;
  currency: string;
  selected: boolean;
  onToggleSelect: () => void;
  showSelection: boolean;
  defaultRevenueVatPercent: number;
  defaultCostVatPercent: number;
  revenueVatExempt: boolean;
  costVatExempt: boolean;
  onRequestAddSibling?: () => void;
  registerAddShortcut?: boolean;
};

type DraftState = {
  platform: string;
  deliverable_type: string;
  quantity: number;
  unit_cost: number;
  unit_revenue: number;
  revenue_vat_percent: number;
  live_date: string;
  notes: string;
  billing_status: string;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildDraft(deliverable: AssignmentDeliverableHierarchyRow): DraftState {
  return {
    platform: deliverable.platform,
    deliverable_type: deliverable.deliverable_type,
    quantity: deliverable.quantity,
    unit_cost: deliverable.unit_cost,
    unit_revenue: deliverable.unit_revenue,
    revenue_vat_percent: deliverable.revenue_vat_percent,
    live_date: deliverable.live_date ?? "",
    notes: deliverable.notes ?? "",
    billing_status: deliverable.billing_status,
  };
}

export function EditableDeliverableRow({
  campaignId,
  campaignLineId,
  deliverable,
  currency,
  selected,
  onToggleSelect,
  showSelection,
  defaultRevenueVatPercent,
  defaultCostVatPercent,
  revenueVatExempt,
  costVatExempt,
  onRequestAddSibling,
  registerAddShortcut,
}: EditableDeliverableRowProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<DraftState>(() => buildDraft(deliverable));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const readOnly = deliverable.is_synthetic || deliverable.is_locked;

  useEffect(() => {
    if (!isEditing) {
      setDraft(buildDraft(deliverable));
    }
  }, [deliverable, isEditing]);

  useEffect(() => {
    if (!registerAddShortcut || !onRequestAddSibling) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        onRequestAddSibling?.();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onRequestAddSibling, registerAddShortcut]);

  const computed = useMemo(() => {
    const revenueBeforeVat = roundMoney(draft.quantity * draft.unit_revenue);
    const costBeforeVat = roundMoney(draft.quantity * draft.unit_cost);
    const revenueVat = computeVatLine({
      beforeVat: revenueBeforeVat,
      vatPercent: revenueVatExempt ? 0 : draft.revenue_vat_percent,
      exempt: revenueVatExempt,
    });
    return {
      revenueBeforeVat,
      costBeforeVat,
      revenueVatAmount: revenueVat.vatAmount,
    };
  }, [draft, revenueVatExempt]);

  const deliverableOptions =
    PLATFORM_DELIVERABLES[draft.platform] ?? PLATFORM_DELIVERABLES.other;

  const patchDraft = useCallback((patch: Partial<DraftState>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  function beginEdit() {
    if (readOnly) return;
    setDraft(buildDraft(deliverable));
    setIsEditing(true);
    setError(null);
  }

  function cancelEdit() {
    setDraft(buildDraft(deliverable));
    setIsEditing(false);
    setError(null);
  }

  function saveEdit() {
    if (deliverable.is_synthetic) return;

    startTransition(async () => {
      const result = await updateAssignmentDeliverableAction({
        campaign_id: campaignId,
        campaign_line_id: campaignLineId,
        deliverable_id: deliverable.id,
        platform: draft.platform,
        deliverable_type: draft.deliverable_type,
        quantity: draft.quantity,
        unit_cost: draft.unit_cost,
        unit_revenue: draft.unit_revenue,
        revenue_vat_percent: draft.revenue_vat_percent,
        cost_vat_percent: defaultCostVatPercent,
        live_date: draft.live_date || null,
        notes: draft.notes || null,
        billing_status: draft.billing_status as typeof deliverable.billing_status,
      });

      if (!result.ok) {
        setError(result.message ?? "Failed to save.");
        return;
      }

      setIsEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (readOnly || deliverable.is_synthetic) return;
    if (!window.confirm("Remove this deliverable from the assignment?")) return;

    startTransition(async () => {
      const result = await deleteAssignmentDeliverableAction({
        campaign_id: campaignId,
        deliverable_id: deliverable.id,
      });
      if (!result.ok) {
        setError(result.message ?? "Failed to delete.");
        return;
      }
      router.refresh();
    });
  }

  const collectionLabel =
    deliverable.collection_status === "collected"
      ? "Collected"
      : deliverable.collection_status === "partial"
        ? "Partial"
        : deliverable.collection_status === "pending"
          ? "Pending"
          : "—";

  return (
    <>
      <tr
        className={cn(
          "border-b border-border/40 text-xs last:border-0",
          selected && "bg-primary/5",
          isEditing && "bg-background ring-1 ring-inset ring-primary/20"
        )}
      >
        <td className="w-8 px-2 py-2">
          {showSelection && deliverable.invoice_eligible && !deliverable.is_synthetic ? (
            <input
              type="checkbox"
              className="size-3.5 rounded border-border"
              checked={selected}
              onChange={onToggleSelect}
              aria-label={`Select ${deliverable.label}`}
            />
          ) : null}
        </td>
        <td className="px-2 py-2">
          <DeliverableTypeTag
            platform={isEditing ? draft.platform : deliverable.platform}
            deliverableType={isEditing ? draft.deliverable_type : deliverable.deliverable_type}
          />
        </td>
        <td className="px-2 py-2">
          {isEditing ? (
            <Select
              value={draft.platform}
              onValueChange={(value) =>
                patchDraft({
                  platform: value,
                  deliverable_type:
                    PLATFORM_DELIVERABLES[value]?.[0] ?? PLATFORM_DELIVERABLES.other[0],
                })
              }
            >
              <SelectTrigger className="h-7 w-[72px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORM_OPTIONS.filter((p) => p.value !== "multi").map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {platformShortLabel(opt.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="font-medium">{platformShortLabel(deliverable.platform)}</span>
          )}
        </td>
        <td className="px-2 py-2">
          {isEditing ? (
            <Select
              value={draft.deliverable_type}
              onValueChange={(value) => patchDraft({ deliverable_type: value })}
            >
              <SelectTrigger className="h-7 min-w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {deliverableOptions.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-muted-foreground">{deliverable.deliverable_type_label}</span>
          )}
        </td>
        <td className="px-2 py-2">
          {isEditing ? (
            <Input
              type="date"
              value={draft.live_date}
              onChange={(e) => patchDraft({ live_date: e.target.value })}
              className="h-7 w-[118px] text-xs"
            />
          ) : deliverable.live_date ? (
            deliverable.live_date
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-2 py-2 text-right">
          {isEditing ? (
            <Input
              type="number"
              min={1}
              value={draft.quantity}
              onChange={(e) => patchDraft({ quantity: Number(e.target.value) || 1 })}
              className="h-7 w-14 text-right text-xs"
            />
          ) : (
            deliverable.quantity
          )}
        </td>
        <td className="px-2 py-2 text-right font-mono">
          {isEditing ? (
            <Input
              type="number"
              min={0}
              step="0.01"
              value={draft.unit_revenue}
              onChange={(e) => patchDraft({ unit_revenue: Number(e.target.value) || 0 })}
              className="h-7 w-20 text-right text-xs"
            />
          ) : (
            formatMoney(deliverable.unit_revenue, currency)
          )}
        </td>
        <td className="px-2 py-2 text-right font-mono">
          {isEditing ? (
            <Input
              type="number"
              min={0}
              step="0.01"
              value={draft.unit_cost}
              onChange={(e) => patchDraft({ unit_cost: Number(e.target.value) || 0 })}
              className="h-7 w-20 text-right text-xs"
            />
          ) : (
            formatMoney(deliverable.unit_cost, currency)
          )}
        </td>
        <td className="px-2 py-2 text-right font-mono font-medium">
          {formatMoney(
            isEditing ? computed.revenueBeforeVat : deliverable.revenue_before_vat,
            currency
          )}
        </td>
        <td className="px-2 py-2 text-right font-mono">
          {formatMoney(
            isEditing ? computed.costBeforeVat : deliverable.cost_before_vat,
            currency
          )}
        </td>
        <td className="px-2 py-2 text-right font-mono text-muted-foreground">
          {isEditing ? (
            <Input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={draft.revenue_vat_percent}
              onChange={(e) =>
                patchDraft({ revenue_vat_percent: Number(e.target.value) || 0 })
              }
              className="h-7 w-14 text-right text-xs"
              disabled={revenueVatExempt}
            />
          ) : revenueVatExempt ? (
            "Exempt"
          ) : (
            formatMoney(deliverable.revenue_vat_amount, currency)
          )}
        </td>
        <td className="px-2 py-2">
          {isEditing ? (
            <Select
              value={draft.billing_status}
              onValueChange={(value) => patchDraft({ billing_status: value })}
            >
              <SelectTrigger className="h-7 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="ready_to_invoice">Ready</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <DeliverableBillingBadge status={deliverable.billing_status} />
          )}
        </td>
        <td className="px-2 py-2">
          {deliverable.invoice_document_number ? (
            <Link
              href={`/billing/invoices/${deliverable.invoice_id}`}
              className="font-mono text-[10px] hover:underline"
            >
              {deliverable.invoice_document_number}
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-2 py-2 text-[10px] text-muted-foreground">{collectionLabel}</td>
        <td className="px-2 py-2">
          {deliverable.payout_status ? (
            <Badge variant="secondary" className="text-[10px] font-normal">
              {deliverable.payout_status.replace(/_/g, " ")}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-2 py-2">
          <DeliverableWorkflowBadge status={deliverable.workflow_status} />
        </td>
        <td className="max-w-[120px] px-2 py-2">
          {isEditing ? (
            <Input
              value={draft.notes}
              onChange={(e) => patchDraft({ notes: e.target.value })}
              placeholder="Notes"
              className="h-7 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") cancelEdit();
              }}
            />
          ) : (
            <span className="line-clamp-2 text-[10px] text-muted-foreground">
              {deliverable.notes ?? "—"}
            </span>
          )}
        </td>
        <td className="px-2 py-2 text-right">
          {readOnly ? (
            <span className="text-[10px] text-muted-foreground">
              {deliverable.is_synthetic ? "Package" : "Locked"}
            </span>
          ) : isEditing ? (
            <div className="flex justify-end gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={saveEdit}
                disabled={pending}
                title="Save (Enter)"
              >
                <CheckIcon className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={cancelEdit}
                disabled={pending}
                title="Cancel (Esc)"
              >
                <XIcon className="size-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex justify-end gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={beginEdit}
                title="Edit inline"
              >
                <PencilIcon className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-destructive"
                onClick={handleDelete}
                disabled={pending}
                title="Delete deliverable"
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </div>
          )}
        </td>
      </tr>
      {deliverable.schedules.length > 0 ? (
        <tr className="bg-muted/10">
          <td colSpan={18} className="px-4 pb-3 pt-0">
            <DeliverableScheduleGrid
              campaignId={campaignId}
              schedules={deliverable.schedules}
              disabled={readOnly}
            />
          </td>
        </tr>
      ) : null}
      {error ? (
        <tr>
          <td colSpan={18} className="px-4 pb-2 text-xs text-destructive">
            {error}
          </td>
        </tr>
      ) : null}
    </>
  );
}
