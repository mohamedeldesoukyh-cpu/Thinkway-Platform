"use client";

import Link from "next/link";
import {
  CheckIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { DocumentNumber } from "@/components/ui/document-number";
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
  addPostToDeliverableAction,
  deleteAssignmentDeliverableAction,
  updateAssignmentDeliverableAction,
  updatePostScheduleAction,
} from "@/features/campaigns/actions/assignment-deliverable-actions";
import { DeliverableWorkflowBadge } from "@/features/campaigns/components/assignment-hierarchy/deliverable-workflow-badge";
import { DeliverableBillingStatusBadge } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-billing-status-badge";
import {
  OperationalAmountField,
  OperationalQtyField,
} from "@/features/campaigns/components/assignment-hierarchy/operational-amount-field";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import {
  OPERATIONAL_AMOUNT_CLASS,
  OPERATIONAL_TABLE_HEADER_CELL,
  OPERATIONAL_TABLE_HEADER_ROW,
  OPERATIONAL_TABLE_SURFACE,
} from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import {
  PlatformSelect,
  DeliverableTypeSelect,
  platformBadgeClass,
} from "@/features/campaigns/components/assignment-hierarchy/platform-deliverable-selects";
import {
  assignmentChildTypeLabel,
  platformShortLabel,
  SCHEDULE_STATUS_OPTIONS,
} from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import {
  GRID_CELL,
  GRID_HIGHLIGHT_COST,
  GRID_HIGHLIGHT_REV,
  OPERATIONAL_GRID_LABELS,
} from "@/features/campaigns/components/assignment-hierarchy/operational-grid-columns";
import { useOperationalCommercialDraft } from "@/features/campaigns/components/assignment-hierarchy/use-operational-commercial-draft";
import type {
  AssignmentDeliverableHierarchyRow,
  AssignmentPostOperationalRow,
} from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";
import { getDeliverableTypeCodesForPlatform } from "@/lib/campaigns/deliverable-taxonomy";
import { computeVatLine } from "@/lib/vat/calculations";
import { cn } from "@/lib/utils";

type EditablePostRowProps = {
  campaignId: string;
  campaignLineId: string;
  deliverable: AssignmentDeliverableHierarchyRow;
  post: AssignmentPostOperationalRow;
  currency: string;
  parentOperationalStatus: CampaignLineOperationalStatus;
  readOnly: boolean;
  revenueVatExempt: boolean;
  defaultRevenueVatPercent: number;
  platformOptions: { value: string; label: string }[];
  deliverableScoped: boolean;
  showSelection: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  isFirstPost: boolean;
};

type MetaDraft = {
  platform: string;
  deliverable_type: string;
  live_date: string;
  revenue_vat_percent: number;
  workflow_status: string;
  billing_status: string;
  notes: string;
};

function commercialInitial(
  deliverable: AssignmentDeliverableHierarchyRow,
  post: AssignmentPostOperationalRow,
  deliverableScoped: boolean
) {
  if (deliverableScoped) {
    return {
      qty: deliverable.quantity,
      revPerAd: deliverable.unit_revenue,
      rev: deliverable.revenue_before_vat,
      costPerAd: deliverable.unit_cost,
      cost: deliverable.cost_before_vat,
    };
  }
  return {
    qty: 1,
    revPerAd: post.revenue_per_post,
    rev: post.revenue_per_post,
    costPerAd: post.cost_per_post,
    cost: post.cost_per_post,
  };
}

export function EditablePostRow({
  campaignId,
  campaignLineId,
  deliverable,
  post,
  currency: _currency,
  parentOperationalStatus,
  readOnly,
  revenueVatExempt,
  defaultRevenueVatPercent,
  platformOptions,
  deliverableScoped,
  showSelection,
  selected,
  onToggleSelect,
  isFirstPost,
}: EditablePostRowProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const commercial = useOperationalCommercialDraft(
    commercialInitial(deliverable, post, deliverableScoped)
  );

  const [meta, setMeta] = useState<MetaDraft>(() => ({
    platform: post.platform,
    deliverable_type: post.deliverable_type,
    live_date: post.live_date ?? "",
    revenue_vat_percent: post.revenue_vat_percent || defaultRevenueVatPercent,
    workflow_status: post.workflow_status,
    billing_status: post.billing_status,
    notes: post.notes ?? "",
  }));

  useEffect(() => {
    if (editing) return;
    commercial.reset(commercialInitial(deliverable, post, deliverableScoped));
    setMeta({
      platform: post.platform,
      deliverable_type: post.deliverable_type,
      live_date: post.live_date ?? "",
      revenue_vat_percent: post.revenue_vat_percent || defaultRevenueVatPercent,
      workflow_status: post.workflow_status,
      billing_status: post.billing_status,
      notes: post.notes ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when server row changes
  }, [
    editing,
    post.id,
    post.revenue_per_post,
    post.cost_per_post,
    deliverable.id,
    deliverable.quantity,
    deliverable.unit_revenue,
    deliverable.revenue_before_vat,
    deliverable.unit_cost,
    deliverable.cost_before_vat,
    deliverableScoped,
    defaultRevenueVatPercent,
  ]);

  const computedVat = useMemo(() => {
    const revenue = computeVatLine({
      beforeVat: commercial.draft.rev,
      vatPercent: revenueVatExempt ? 0 : meta.revenue_vat_percent,
      exempt: revenueVatExempt,
    });
    return revenue.vatAmount;
  }, [commercial.draft.rev, meta.revenue_vat_percent, revenueVatExempt]);

  const collectionLabel =
    post.collection_status === "collected"
      ? "Coll"
      : post.collection_status === "partial"
        ? "Part"
        : post.collection_status === "pending"
          ? "Pend"
          : "—";

  const postId = typeof post.id === "string" ? post.id : "";
  const canEdit = !readOnly && postId.length > 0 && !postId.startsWith("virtual-");
  const canEditCommercial = canEdit && !deliverable.is_locked;

  function persistCommercial() {
    if (!canEditCommercial) return;
    startTransition(async () => {
      if (deliverableScoped) {
        const result = await updateAssignmentDeliverableAction({
          campaign_id: campaignId,
          campaign_line_id: campaignLineId,
          deliverable_id: deliverable.id,
          platform: meta.platform,
          deliverable_type: meta.deliverable_type,
          quantity: commercial.draft.qty,
          unit_revenue: commercial.draft.revPerAd,
          unit_cost: commercial.draft.costPerAd,
          revenue_vat_percent: meta.revenue_vat_percent,
          live_date: meta.live_date || null,
          notes: meta.notes || null,
          billing_status: meta.billing_status as typeof post.billing_status,
        });
        if (!result.ok) {
          setError(result.message ?? "Failed to save.");
          return;
        }
      } else {
        const result = await updatePostScheduleAction({
          campaign_id: campaignId,
          schedule_id: postId,
          live_date: meta.live_date || null,
          status: meta.workflow_status,
          revenue_per_post: commercial.draft.revPerAd,
          cost_per_post: commercial.draft.costPerAd,
          revenue_vat_percent: meta.revenue_vat_percent,
          notes: meta.notes || null,
          billing_status: meta.billing_status as typeof post.billing_status,
          platform: meta.platform,
          deliverable_type: meta.deliverable_type,
        });
        if (!result.ok) {
          setError(result.message ?? "Failed to save.");
          return;
        }
      }
      setError(null);
      router.refresh();
    });
  }

  function buildSchedulePayload(overrides: Partial<MetaDraft> = {}) {
    const merged = { ...meta, ...overrides };
    return {
      campaign_id: campaignId,
          schedule_id: postId,
      live_date: merged.live_date || null,
      status: merged.workflow_status,
      revenue_per_post: commercial.draft.revPerAd,
      cost_per_post: commercial.draft.costPerAd,
      revenue_vat_percent: merged.revenue_vat_percent,
      notes: merged.notes || null,
      billing_status: merged.billing_status as typeof post.billing_status,
      platform: merged.platform,
      deliverable_type: merged.deliverable_type,
    };
  }

  function persistMetaPatch(patch: Partial<MetaDraft>, options?: { closeEdit?: boolean }) {
    if (!canEdit) return;
    startTransition(async () => {
      const result = await updatePostScheduleAction(buildSchedulePayload(patch));
      if (!result.ok) {
        setError(result.message ?? "Failed to save.");
        return;
      }
      if (options?.closeEdit) setEditing(false);
      setError(null);
      router.refresh();
    });
  }

  function saveMeta() {
    if (!canEdit) return;
    if (deliverableScoped) {
      persistCommercial();
      setEditing(false);
      return;
    }
    persistMetaPatch({}, { closeEdit: true });
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
          "border-b border-border/15 text-[11px] font-normal text-foreground/80",
          OPERATIONAL_TABLE_SURFACE,
          "hover:bg-muted/15",
          editing && OPERATIONAL_TABLE_SURFACE
        )}
      >
        <td className={GRID_CELL.select}>
          {showSelection && deliverable.invoice_eligible && !deliverable.is_synthetic ? (
            <input
              type="checkbox"
              className="size-3 rounded border-border"
              checked={selected}
              onChange={onToggleSelect}
            />
          ) : showSelection &&
            !deliverable.is_synthetic &&
            (deliverable.invoiced_amount > 0 ||
              deliverable.invoice_document_number ||
              deliverable.is_locked) ? (
            <div className="flex flex-col items-start gap-0.5">
              <input
                type="checkbox"
                className="size-3 rounded border-border opacity-40"
                checked
                disabled
                aria-label="Already invoiced"
              />
              {deliverable.invoice_document_number ? (
                <span className="max-w-[5rem] truncate text-[9px] text-muted-foreground">
                  {deliverable.invoice_document_number}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-muted-foreground/50">·</span>
          )}
        </td>
        <td className={cn(GRID_CELL.type, "text-left font-normal text-foreground/90")}>
          <div className="flex items-center gap-1.5 text-left">
            <span className="w-4 shrink-0 text-left tabular-nums text-[10px] text-muted-foreground">
              {post.sequence_number}
            </span>
            {canEdit && editing ? (
              <DeliverableTypeSelect
                platform={meta.platform}
                deliverableType={meta.deliverable_type}
                disabled={pending}
                onDeliverableTypeChange={(deliverableType) =>
                  setMeta((m) => ({ ...m, deliverable_type: deliverableType }))
                }
              />
            ) : (
              <span className="min-w-0 truncate">
                {assignmentChildTypeLabel(post.deliverable_type, post.deliverable_type_label)}
              </span>
            )}
          </div>
        </td>
        <td className={GRID_CELL.platform}>
          {canEdit && editing ? (
            <PlatformSelect
              platform={meta.platform}
              platformOptions={platformOptions}
              disabled={pending}
              onPlatformChange={(platform) => {
                const types = getDeliverableTypeCodesForPlatform(platform);
                setMeta((m) => ({
                  ...m,
                  platform,
                  deliverable_type: types[0] ?? "other",
                }));
              }}
            />
          ) : (
            <span
              className={cn(
                "inline-flex min-w-[2rem] justify-center rounded-md border px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                platformBadgeClass(post.platform)
              )}
            >
              {platformShortLabel(post.platform)}
            </span>
          )}
        </td>
        <td className={GRID_CELL.postDate}>
          {canEdit && editing ? (
            <Input
              type="date"
              value={meta.live_date}
              onChange={(e) => setMeta((m) => ({ ...m, live_date: e.target.value }))}
              className="h-6 w-full text-[10px]"
            />
          ) : (
            <span className="text-muted-foreground">{post.live_date ?? "—"}</span>
          )}
        </td>
        <td className={GRID_CELL.qty}>
          <OperationalQtyField
            value={commercial.draft.qty}
            onChange={(q) => commercial.setQty(q)}
            onBlur={persistCommercial}
            disabled={!canEditCommercial || !deliverableScoped}
          />
        </td>
        <td className={GRID_CELL.money}>
          <OperationalAmountField
            value={commercial.draft.revPerAd}
            onChange={(n) => commercial.setRevPerAd(n)}
            onBlur={persistCommercial}
            disabled={!canEditCommercial}
          />
        </td>
        <td className={GRID_CELL.money}>
          <OperationalAmountField
            value={commercial.draft.costPerAd}
            onChange={(n) => commercial.setCostPerAd(n)}
            onBlur={persistCommercial}
            disabled={!canEditCommercial}
          />
        </td>
        <td className={GRID_HIGHLIGHT_REV}>
          <OperationalAmountField
            value={commercial.draft.rev}
            onChange={(n) => commercial.setRev(n)}
            onBlur={persistCommercial}
            disabled={!canEditCommercial}
          />
        </td>
        <td className={GRID_HIGHLIGHT_COST}>
          <OperationalAmountField
            value={commercial.draft.cost}
            onChange={(n) => commercial.setCost(n)}
            onBlur={persistCommercial}
            disabled={!canEditCommercial}
          />
        </td>
        <td className={GRID_CELL.vat}>
          {editing && !revenueVatExempt ? (
            <Input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={meta.revenue_vat_percent}
              onChange={(e) =>
                setMeta((m) => ({
                  ...m,
                  revenue_vat_percent: Number(e.target.value) || 0,
                }))
              }
              className={cn(
                "h-auto min-h-0 w-full border-0 bg-transparent py-0 text-right text-[11px] font-normal shadow-none focus-visible:ring-1"
              )}
            />
          ) : revenueVatExempt ? (
            <span className={OPERATIONAL_AMOUNT_CLASS}>Ex</span>
          ) : (
            <span className={OPERATIONAL_AMOUNT_CLASS}>
              {formatOperationalAmount(computedVat)}
            </span>
          )}
        </td>
        <td className={GRID_CELL.status}>
          <DeliverableBillingStatusBadge billingStatus={post.billing_status} />
        </td>
        <td className={GRID_CELL.invoice}>
          {post.invoice_document_number ? (
            <Link
              href={`/billing/invoices/${post.invoice_id}`}
              className="text-[9px] hover:underline"
            >
              <DocumentNumber
                value={post.invoice_document_number}
                showCanonicalTitle={false}
              />
            </Link>
          ) : (
            "—"
          )}
        </td>
        <td className={GRID_CELL.collection}>{collectionLabel}</td>
        <td className={GRID_CELL.payout}>
          {post.payout_status ? (
            <Badge variant="secondary" className="text-[9px] font-normal">
              {post.payout_status.replace(/_/g, " ")}
            </Badge>
          ) : (
            "—"
          )}
        </td>
        <td className={GRID_CELL.workflow}>
          {canEdit && editing ? (
            <Select
              value={meta.workflow_status}
              onValueChange={(v) => setMeta((m) => ({ ...m, workflow_status: v }))}
            >
              <SelectTrigger className="h-6 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <DeliverableWorkflowBadge status={post.workflow_status} />
          )}
        </td>
        <td className={GRID_CELL.actions}>
          {!canEdit ? (
            <span className="text-muted-foreground">—</span>
          ) : editing ? (
            <div className="flex justify-end gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={saveMeta}
                disabled={pending}
              >
                <CheckIcon className="size-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => setEditing(false)}
              >
                <XIcon className="size-3" />
              </Button>
            </div>
          ) : (
            <div className="flex justify-end gap-0.5">
              {isFirstPost && !deliverable.is_synthetic ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={addPost}
                    disabled={pending}
                    title="Add post"
                  >
                    <PlusIcon className="size-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 text-destructive"
                    onClick={deleteDeliverable}
                    disabled={pending}
                    title="Remove deliverable"
                  >
                    <Trash2Icon className="size-3" />
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => setEditing(true)}
              >
                <PencilIcon className="size-3" />
              </Button>
            </div>
          )}
        </td>
      </tr>
      {error ? (
        <tr>
          <td colSpan={17} className="px-4 pb-1 text-[10px] text-destructive">
            {error}
          </td>
        </tr>
      ) : null}
    </>
  );
}

type OperationalGridHeaderProps = {
  actions?: ReactNode;
};

export function OperationalGridHeader({ actions }: OperationalGridHeaderProps) {
  return (
    <tr className={OPERATIONAL_TABLE_HEADER_ROW}>
      <th className={cn(GRID_CELL.select, OPERATIONAL_TABLE_HEADER_CELL)} />
      <th className={cn(GRID_CELL.type, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.type}
      </th>
      <th className={cn(GRID_CELL.platform, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.platform}
      </th>
      <th className={cn(GRID_CELL.postDate, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.postDate}
      </th>
      <th className={cn(GRID_CELL.qty, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.qty}
      </th>
      <th className={cn(GRID_CELL.money, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.revPerAd}
      </th>
      <th className={cn(GRID_CELL.money, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.costPerAd}
      </th>
      <th className={cn(GRID_CELL.money, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.rev}
      </th>
      <th className={cn(GRID_CELL.money, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.cost}
      </th>
      <th className={cn(GRID_CELL.vat, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.vat}
      </th>
      <th className={cn(GRID_CELL.status, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.billing}
      </th>
      <th className={cn(GRID_CELL.invoice, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.invoice}
      </th>
      <th className={cn(GRID_CELL.collection, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.collection}
      </th>
      <th className={cn(GRID_CELL.payout, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.payout}
      </th>
      <th className={cn(GRID_CELL.workflow, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.workflow}
      </th>
      <th className={cn(GRID_CELL.actions, OPERATIONAL_TABLE_HEADER_CELL)}>
        {actions}
      </th>
    </tr>
  );
}
