"use client";

import { ChevronDownIcon, ChevronRightIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  addPostToDeliverableAction,
  deleteAssignmentDeliverableAction,
  updateDeliverablePlatformTypeAction,
} from "@/features/campaigns/actions/assignment-deliverable-actions";
import { DeliverableBillingBadge } from "@/features/campaigns/components/assignment-hierarchy/deliverable-billing-badge";
import { DeliverableTypeTag } from "@/features/campaigns/components/assignment-hierarchy/deliverable-type-tag";
import { DeliverableWorkflowBadge } from "@/features/campaigns/components/assignment-hierarchy/deliverable-workflow-badge";
import { EditablePostRow } from "@/features/campaigns/components/assignment-hierarchy/editable-post-row";
import {
  DeliverableTypeSelect,
  PlatformBadge,
  PlatformSelect,
} from "@/features/campaigns/components/assignment-hierarchy/platform-deliverable-selects";
import { GRID_CELL } from "@/features/campaigns/components/assignment-hierarchy/operational-grid-columns";
import type { AssignmentDeliverableHierarchyRow } from "@/features/campaigns/types/assignment-hierarchy";
import { formatMoney } from "@/features/campaigns/utils";
import { getDeliverableTypeCodesForPlatform } from "@/lib/campaigns/deliverable-taxonomy";
import { cn } from "@/lib/utils";

type DeliverableGroupRowProps = {
  campaignId: string;
  campaignLineId: string;
  deliverable: AssignmentDeliverableHierarchyRow;
  currency: string;
  selected: boolean;
  onToggleSelect: () => void;
  showSelection: boolean;
  revenueVatExempt: boolean;
  defaultRevenueVatPercent: number;
  platformOptions: { value: string; label: string }[];
};

export function DeliverableGroupRow({
  campaignId,
  campaignLineId,
  deliverable,
  currency,
  selected,
  onToggleSelect,
  showSelection,
  revenueVatExempt,
  defaultRevenueVatPercent,
  platformOptions,
}: DeliverableGroupRowProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [pending, startTransition] = useTransition();
  const readOnly = deliverable.is_synthetic || deliverable.is_locked;

  const collectionLabel =
    deliverable.collection_status === "collected"
      ? "Coll"
      : deliverable.collection_status === "partial"
        ? "Part"
        : deliverable.collection_status === "pending"
          ? "Pend"
          : "—";

  function updatePlatformType(platform: string, deliverableType: string) {
    if (readOnly || deliverable.is_synthetic) return;
    startTransition(async () => {
      const result = await updateDeliverablePlatformTypeAction({
        campaign_id: campaignId,
        campaign_line_id: campaignLineId,
        deliverable_id: deliverable.id,
        platform,
        deliverable_type: deliverableType,
      });
      if (result.ok) router.refresh();
    });
  }

  function addPost() {
    if (readOnly || deliverable.is_synthetic) return;
    startTransition(async () => {
      const result = await addPostToDeliverableAction({
        campaign_id: campaignId,
        deliverable_id: deliverable.id,
      });
      if (result.ok) router.refresh();
    });
  }

  function deleteDeliverable() {
    if (readOnly || deliverable.is_synthetic) return;
    if (!window.confirm("Remove this deliverable and all posts?")) return;
    startTransition(async () => {
      const result = await deleteAssignmentDeliverableAction({
        campaign_id: campaignId,
        deliverable_id: deliverable.id,
      });
      if (result.ok) router.refresh();
    });
  }

  return (
    <>
      <tr
        className={cn(
          "border-b border-border/50 bg-muted/40 text-[11px] font-medium",
          selected && "bg-primary/5"
        )}
      >
        <td className={cn(GRID_CELL.select, "pl-3")}>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded p-0.5 hover:bg-muted"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Collapse posts" : "Expand posts"}
            >
              {expanded ? (
                <ChevronDownIcon className="size-3.5" />
              ) : (
                <ChevronRightIcon className="size-3.5" />
              )}
            </button>
            {showSelection && deliverable.invoice_eligible && !deliverable.is_synthetic ? (
              <input
                type="checkbox"
                className="size-3.5 rounded border-border"
                checked={selected}
                onChange={onToggleSelect}
              />
            ) : null}
          </div>
        </td>
        <td className={GRID_CELL.type}>
          <DeliverableTypeTag
            platform={deliverable.platform}
            deliverableType={deliverable.deliverable_type}
          />
        </td>
        <td className={GRID_CELL.platform}>
          {!readOnly && !deliverable.is_synthetic ? (
            <PlatformSelect
              platform={deliverable.platform}
              platformOptions={platformOptions}
              disabled={pending}
              onPlatformChange={(platform) => {
                const types = getDeliverableTypeCodesForPlatform(platform);
                updatePlatformType(platform, types[0] ?? "other");
              }}
            />
          ) : (
            <PlatformBadge platform={deliverable.platform} />
          )}
        </td>
        <td className={GRID_CELL.deliverableType}>
          {!readOnly && !deliverable.is_synthetic ? (
            <DeliverableTypeSelect
              platform={deliverable.platform}
              deliverableType={deliverable.deliverable_type}
              disabled={pending}
              onDeliverableTypeChange={(type) =>
                updatePlatformType(deliverable.platform, type)
              }
            />
          ) : (
            <span className="text-muted-foreground">{deliverable.deliverable_type_label}</span>
          )}
        </td>
        <td className={cn(GRID_CELL.postDate, "text-muted-foreground")}>
          {deliverable.posts.length > 1
            ? `${deliverable.posts.length} posts`
            : deliverable.posts[0]?.live_date ?? "—"}
        </td>
        <td className={GRID_CELL.qty}>{deliverable.posts.length}</td>
        <td className={cn(GRID_CELL.money, "text-muted-foreground")}>
          {formatMoney(deliverable.unit_revenue, currency)}
        </td>
        <td className={cn(GRID_CELL.money, "text-muted-foreground")}>
          {formatMoney(deliverable.unit_cost, currency)}
        </td>
        <td className={GRID_CELL.money}>{formatMoney(deliverable.revenue_before_vat, currency)}</td>
        <td className={GRID_CELL.money}>{formatMoney(deliverable.cost_before_vat, currency)}</td>
        <td className={GRID_CELL.vat}>
          {revenueVatExempt
            ? "Ex"
            : formatMoney(deliverable.revenue_vat_amount, currency)}
        </td>
        <td className={GRID_CELL.status}>
          <DeliverableBillingBadge status={deliverable.billing_status} />
        </td>
        <td className={GRID_CELL.invoice}>
          {deliverable.invoice_document_number ? (
            <Link href={`/billing/invoices/${deliverable.invoice_id}`} className="font-mono text-[10px] hover:underline">
              {deliverable.invoice_document_number}
            </Link>
          ) : (
            "—"
          )}
        </td>
        <td className={GRID_CELL.collection}>{collectionLabel}</td>
        <td className={GRID_CELL.payout}>—</td>
        <td className={GRID_CELL.workflow}>
          <DeliverableWorkflowBadge status={deliverable.workflow_status} />
        </td>
        <td className={GRID_CELL.notes}>
          <span className="line-clamp-1 text-[10px] text-muted-foreground">
            {deliverable.notes ?? "—"}
          </span>
        </td>
        <td className={GRID_CELL.actions}>
          {!readOnly && !deliverable.is_synthetic ? (
            <div className="flex justify-end gap-0.5">
              <Button type="button" variant="ghost" size="icon" className="size-6" onClick={addPost} disabled={pending} title="Add post">
                <PlusIcon className="size-3" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-6 text-destructive" onClick={deleteDeliverable} disabled={pending}>
                <Trash2Icon className="size-3" />
              </Button>
            </div>
          ) : null}
        </td>
      </tr>

      {expanded
        ? deliverable.posts.map((post) => (
            <EditablePostRow
              key={post.id}
              campaignId={campaignId}
              campaignLineId={campaignLineId}
              deliverableId={deliverable.id}
              post={post}
              currency={currency}
              readOnly={readOnly}
              revenueVatExempt={revenueVatExempt}
              defaultRevenueVatPercent={defaultRevenueVatPercent}
              platformOptions={platformOptions}
            />
          ))
        : null}
    </>
  );
}
