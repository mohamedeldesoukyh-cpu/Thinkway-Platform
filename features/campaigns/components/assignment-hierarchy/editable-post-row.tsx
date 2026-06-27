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
import { AssignmentDeliverableBillingBadge } from "@/features/campaigns/components/assignment-hierarchy/assignment-status-badges";
import {
  OperationalAmountField,
  OperationalQtyField,
} from "@/features/campaigns/components/assignment-hierarchy/operational-amount-field";
import { formatOperationalAmount, roundOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import {
  OPERATIONAL_AMOUNT_CLASS,
  OPERATIONAL_TABLE_HEADER_CELL,
  OPERATIONAL_TABLE_HEADER_ROW,
  OPERATIONAL_TABLE_HEADER_SURFACE,
  OPERATIONAL_TABLE_SURFACE,
} from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import {
  PlatformSelect,
  DeliverableTypeSelect,
  platformBadgeClass,
} from "@/features/campaigns/components/assignment-hierarchy/platform-deliverable-selects";
import {
  assignmentChildColDataAttr,
  assignmentChildLeadingParentColumnIds,
  assignmentChildRowColSpan,
  assignmentChildTypeLabel,
  assignmentParentToChildLeadingColumnId,
  platformShortLabel,
  SCHEDULE_STATUS_OPTIONS,
} from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import { formatPercent } from "@/features/campaigns/utils";
import {
  ASSIGNMENT_GRID_MONEY_COL,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-column-widths";
import {
  GRID_CELL,
  GRID_HIGHLIGHT_COST,
  GRID_HIGHLIGHT_REV,
  GRID_HIGHLIGHT_TOTAL_BILLING,
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
import {
  canEditLiveAdDate,
  formatLiveAdMonth,
} from "@/lib/campaigns/live-ad-date";
import { cn } from "@/lib/utils";
import {
  useOperationalChildColumnVisibleChecker,
  useOperationalChildVisibleColumnCount,
} from "@/components/tables/operational-table-column-context";

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
  isLastChildRow?: boolean;
  showExpandColumn?: boolean;
  leadingParentColumnIds?: readonly string[];
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
  currency,
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
  isLastChildRow = false,
  showExpandColumn = false,
  leadingParentColumnIds: leadingParentColumnIdsProp,
}: EditablePostRowProps) {
  const col = useOperationalChildColumnVisibleChecker();
  const leadingParentColumnIds =
    leadingParentColumnIdsProp ?? assignmentChildLeadingParentColumnIds(showExpandColumn);
  const childColSpanBase = useOperationalChildVisibleColumnCount();
  const childColSpan =
    !showExpandColumn && col("expand") ? childColSpanBase - 1 : childColSpanBase;
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
    post.live_date,
    post.revenue_per_post,
    post.cost_per_post,
    deliverable.id,
    deliverable.quantity,
    deliverable.unit_revenue,
    deliverable.revenue_before_vat,
    deliverable.unit_cost,
    deliverable.cost_before_vat,
    deliverable.usage_rights_cost,
    deliverable.revenue_after_vat,
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
  const isVirtualPost = postId.startsWith("virtual-");
  const canEditLiveDateField = canEditLiveAdDate(
    post.live_date ?? deliverable.live_date,
    deliverable.locked_at
  );
  const canEditDeliverableScope =
    !readOnly && deliverableScoped && postId.length > 0 && !deliverable.is_locked;
  const canEditPostSchedule =
    !readOnly && postId.length > 0 && !isVirtualPost && !deliverable.is_locked;
  const canEdit = canEditDeliverableScope || canEditPostSchedule;
  const canEditCommercial = canEdit;
  const showDeliverableCommercial =
    deliverableScoped || isFirstPost;

  const computedTotalBilling = useMemo(() => {
    if (showDeliverableCommercial) {
      return deliverable.revenue_after_vat;
    }
    return roundOperationalAmount(
      commercial.draft.rev + (revenueVatExempt ? 0 : computedVat)
    );
  }, [
    showDeliverableCommercial,
    deliverable.revenue_after_vat,
    commercial.draft.rev,
    revenueVatExempt,
    computedVat,
  ]);

  function persistLiveDate(nextLiveDate: string) {
    if (!canEditLiveDateField) return;
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
          live_date: nextLiveDate || null,
          notes: meta.notes || null,
          billing_status: meta.billing_status as typeof post.billing_status,
        });
        if (!result.ok) {
          setError(result.message ?? "Failed to save live ad date.");
          return;
        }
      } else if (!isVirtualPost && postId) {
        const result = await updatePostScheduleAction({
          campaign_id: campaignId,
          schedule_id: postId,
          live_date: nextLiveDate || null,
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
          setError(result.message ?? "Failed to save live ad date.");
          return;
        }
      } else {
        return;
      }
      setError(null);
      router.refresh();
    });
  }

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

  function persistDeliverableMeta(
    patch: Partial<MetaDraft>,
    options?: { closeEdit?: boolean }
  ) {
    if (!canEditDeliverableScope) return;
    const merged = { ...meta, ...patch };
    startTransition(async () => {
      const result = await updateAssignmentDeliverableAction({
        campaign_id: campaignId,
        campaign_line_id: campaignLineId,
        deliverable_id: deliverable.id,
        platform: merged.platform,
        deliverable_type: merged.deliverable_type,
        quantity: commercial.draft.qty,
        unit_revenue: commercial.draft.revPerAd,
        unit_cost: commercial.draft.costPerAd,
        revenue_vat_percent: merged.revenue_vat_percent,
        live_date: merged.live_date || null,
        notes: merged.notes || null,
        billing_status: merged.billing_status as typeof post.billing_status,
      });
      if (!result.ok) {
        setError(result.message ?? "Failed to save.");
        return;
      }
      if (options?.closeEdit) setEditing(false);
      setError(null);
      router.refresh();
    });
  }

  function persistMetaPatch(patch: Partial<MetaDraft>, options?: { closeEdit?: boolean }) {
    if (!canEdit) return;
    if (deliverableScoped && isVirtualPost) {
      persistDeliverableMeta(patch, options);
      return;
    }
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

  function renderLeadingBodyCell(parentColumnId: string) {
    const childColumnId = assignmentParentToChildLeadingColumnId(parentColumnId);
    if (!childColumnId) return null;

    const cellClass =
      childColumnId === "rev"
        ? cn(GRID_HIGHLIGHT_REV, GRID_CELL.leadingRev)
        : childColumnId === "expand"
          ? GRID_CELL.expand
          : childColumnId === "select"
            ? GRID_CELL.select
            : childColumnId === "type"
              ? GRID_CELL.type
              : childColumnId === "platform"
                ? GRID_CELL.platform
                : childColumnId === "qty"
                  ? GRID_CELL.qty
                  : childColumnId === "revPerAd"
                    ? GRID_CELL.revPerAd
                    : childColumnId === "costPerAd"
                      ? GRID_CELL.costPerAd
                      : childColumnId === "ccy"
                        ? GRID_CELL.ccy
                        : GRID_CELL.leadingRev;

    if (
      !col(childColumnId) ||
      childColumnId === "expand" ||
      childColumnId === "select"
    ) {
      return (
        <td
          key={parentColumnId}
          {...assignmentChildColDataAttr(childColumnId)}
          className={cellClass}
          aria-hidden
        />
      );
    }

    switch (childColumnId) {
      case "type":
        return (
          <td
            key={parentColumnId}
            {...assignmentChildColDataAttr(childColumnId)}
            className={cellClass}
          >
            <div className="flex min-w-0 items-center">
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
                  {assignmentChildTypeLabel(
                    post.deliverable_type,
                    post.deliverable_type_label
                  )}
                </span>
              )}
            </div>
          </td>
        );
      case "platform":
        return (
          <td key={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
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
        );
      case "qty":
        return (
          <td key={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
            <OperationalQtyField
              value={commercial.draft.qty}
              onChange={(q) => commercial.setQty(q)}
              onBlur={persistCommercial}
              disabled={!canEditCommercial || !deliverableScoped}
            />
          </td>
        );
      case "revPerAd":
        return (
          <td key={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
            <OperationalAmountField
              value={commercial.draft.revPerAd}
              onChange={(n) => commercial.setRevPerAd(n)}
              onBlur={persistCommercial}
              disabled={!canEditCommercial}
              perUnit
            />
          </td>
        );
      case "costPerAd":
        return (
          <td key={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
            <OperationalAmountField
              value={commercial.draft.costPerAd}
              onChange={(n) => commercial.setCostPerAd(n)}
              onBlur={persistCommercial}
              disabled={!canEditCommercial}
              perUnit
            />
          </td>
        );
      case "ccy":
        return (
          <td key={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
            {currency}
          </td>
        );
      case "rev":
        return (
          <td key={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
            <OperationalAmountField
              value={commercial.draft.rev}
              onChange={(n) => commercial.setRev(n)}
              onBlur={persistCommercial}
              disabled={!canEditCommercial}
            />
          </td>
        );
      default:
        return (
          <td
            key={parentColumnId}
            {...assignmentChildColDataAttr(childColumnId)}
            className={cellClass}
            aria-hidden
          />
        );
    }
  }

  return (
    <>
      <tr
        className={cn(
          "thinkway-campaign-asgn-child text-[11px] font-normal text-[var(--camp-text-2)]",
          !isLastChildRow && "border-b border-[var(--camp-border)]",
          "hover:bg-[var(--camp-row-open-hover)]",
          editing && "bg-[var(--camp-row-open)]"
        )}
      >
        {leadingParentColumnIds.map(renderLeadingBodyCell)}
        {col("usageRights") ? (
        <td className={cn(GRID_CELL.usageRights, OPERATIONAL_AMOUNT_CLASS)}>
          {showDeliverableCommercial
            ? formatOperationalAmount(deliverable.usage_rights_amount)
            : "—"}
        </td>
        ) : null}
        {col("agencyFeePercent") ? (
        <td
          className={cn(
            GRID_CELL.agencyFeePercent,
            OPERATIONAL_AMOUNT_CLASS,
            "text-muted-foreground"
          )}
        >
          {showDeliverableCommercial ? formatPercent(deliverable.agency_fee_percent) : "—"}
        </td>
        ) : null}
        {col("agencyFee") ? (
        <td className={cn(GRID_CELL.agencyFee, OPERATIONAL_AMOUNT_CLASS)}>
          {showDeliverableCommercial
            ? formatOperationalAmount(deliverable.agency_fee_amount)
            : "—"}
        </td>
        ) : null}
        {col("cost") ? (
        <td className={cn(GRID_HIGHLIGHT_COST, GRID_CELL.money)}>
          <OperationalAmountField
            value={commercial.draft.cost}
            onChange={(n) => commercial.setCost(n)}
            onBlur={persistCommercial}
            disabled={!canEditCommercial}
          />
        </td>
        ) : null}
        {col("usageRightsCost") ? (
        <td className={cn(GRID_CELL.usageRightsCost, OPERATIONAL_AMOUNT_CLASS)}>
          {showDeliverableCommercial
            ? formatOperationalAmount(deliverable.usage_rights_cost)
            : "—"}
        </td>
        ) : null}
        {col("vat") ? (
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
                "h-auto min-h-0 w-full border-0 bg-transparent py-0 text-center text-[11px] font-normal shadow-none focus-visible:ring-1"
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
        ) : null}
        {col("totalBilling") ? (
        <td className={cn(GRID_HIGHLIGHT_TOTAL_BILLING)}>
          {formatOperationalAmount(computedTotalBilling)}
        </td>
        ) : null}
        {col("postDate") ? (
        <td className={GRID_CELL.postDate}>
          {canEditLiveDateField ? (
            <div className="flex items-center justify-center gap-0.5">
              <Input
                type="date"
                value={meta.live_date}
                onChange={(e) => setMeta((m) => ({ ...m, live_date: e.target.value }))}
                onBlur={(e) => persistLiveDate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    persistLiveDate(meta.live_date);
                  }
                }}
                disabled={pending}
                className="h-6 min-w-0 flex-1 text-[10px]"
                aria-label="Live ad date"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                disabled={pending}
                title="Save live ad date"
                onClick={() => persistLiveDate(meta.live_date)}
              >
                <CheckIcon className="size-3" />
              </Button>
            </div>
          ) : (
            <span className="text-muted-foreground">{post.live_date ?? "—"}</span>
          )}
        </td>
        ) : null}
        {col("liveAdMonth") ? (
        <td className={cn(GRID_CELL.month, "text-[10px] text-muted-foreground")}>
          {formatLiveAdMonth(meta.live_date || post.live_date)}
        </td>
        ) : null}
        {col("invoice") ? (
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
        ) : null}
        {col("billing") ? (
        <td className={GRID_CELL.status}>
          <AssignmentDeliverableBillingBadge billingStatus={post.billing_status} />
        </td>
        ) : null}
        {col("collection") ? (
        <td className={GRID_CELL.collection}>{collectionLabel}</td>
        ) : null}
        {col("payout") ? (
        <td className={GRID_CELL.payout}>
          {post.payout_status ? (
            <Badge variant="secondary" className="text-[9px] font-normal">
              {post.payout_status.replace(/_/g, " ")}
            </Badge>
          ) : (
            "—"
          )}
        </td>
        ) : null}
        {col("workflow") ? (
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
        ) : null}
        {col("actions") ? (
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
        ) : null}
      </tr>
      {error ? (
        <tr>
          <td colSpan={childColSpan} className="px-4 pb-1 text-[10px] text-destructive">
            {error}
          </td>
        </tr>
      ) : null}
    </>
  );
}

type OperationalGridHeaderProps = {
  actions?: ReactNode;
  showExpandColumn?: boolean;
  leadingParentColumnIds?: readonly string[];
};

function childLeadingHeaderClass(childColumnId: string): string {
  switch (childColumnId) {
    case "expand":
      return GRID_CELL.expand;
    case "select":
      return GRID_CELL.select;
    case "type":
      return GRID_CELL.type;
    case "platform":
      return GRID_CELL.platform;
    case "qty":
      return GRID_CELL.qty;
    case "revPerAd":
      return GRID_CELL.revPerAd;
    case "costPerAd":
      return GRID_CELL.costPerAd;
    case "ccy":
      return GRID_CELL.ccy;
    case "rev":
      return GRID_CELL.leadingRev;
    default:
      return GRID_CELL.type;
  }
}

export function OperationalGridHeader({
  actions,
  showExpandColumn = false,
  leadingParentColumnIds: leadingParentColumnIdsProp,
}: OperationalGridHeaderProps) {
  const col = useOperationalChildColumnVisibleChecker();
  const leadingParentColumnIds =
    leadingParentColumnIdsProp ?? assignmentChildLeadingParentColumnIds(showExpandColumn);

  function renderLeadingHeaderCell(parentColumnId: string) {
    const childColumnId = assignmentParentToChildLeadingColumnId(parentColumnId);
    if (!childColumnId) return null;

    const cellClass = cn(childLeadingHeaderClass(childColumnId), OPERATIONAL_TABLE_HEADER_CELL);

    if (
      !col(childColumnId) ||
      childColumnId === "expand" ||
      childColumnId === "select"
    ) {
      return (
        <th
          key={parentColumnId}
          {...assignmentChildColDataAttr(childColumnId)}
          className={cellClass}
          aria-hidden
        />
      );
    }

    switch (childColumnId) {
      case "type":
        return (
          <th key={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
            {OPERATIONAL_GRID_LABELS.type}
          </th>
        );
      case "platform":
        return (
          <th key={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
            {OPERATIONAL_GRID_LABELS.platform}
          </th>
        );
      case "qty":
        return (
          <th key={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
            {OPERATIONAL_GRID_LABELS.qty}
          </th>
        );
      case "revPerAd":
        return (
          <th
            key={parentColumnId}
            {...assignmentChildColDataAttr(childColumnId)}
            className={cn(cellClass, "whitespace-nowrap px-1.5")}
          >
            {OPERATIONAL_GRID_LABELS.revPerAd}
          </th>
        );
      case "costPerAd":
        return (
          <th
            key={parentColumnId}
            {...assignmentChildColDataAttr(childColumnId)}
            className={cn(cellClass, "whitespace-nowrap px-1.5")}
          >
            {OPERATIONAL_GRID_LABELS.costPerAd}
          </th>
        );
      case "ccy":
        return (
          <th key={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
            {OPERATIONAL_GRID_LABELS.ccy}
          </th>
        );
      case "rev":
        return (
          <th
            key={parentColumnId}
            {...assignmentChildColDataAttr(childColumnId)}
            className={cn(
              cellClass,
              OPERATIONAL_TABLE_HEADER_SURFACE,
              "py-1.5"
            )}
          >
            {OPERATIONAL_GRID_LABELS.rev}
          </th>
        );
      default:
        return (
          <th
            key={parentColumnId}
            {...assignmentChildColDataAttr(childColumnId)}
            className={cellClass}
            aria-hidden
          />
        );
    }
  }

  return (
    <tr className={cn(OPERATIONAL_TABLE_HEADER_ROW, "thinkway-campaign-asgn-child-hdr")}>
      {leadingParentColumnIds.map(renderLeadingHeaderCell)}
      {col("usageRights") ? (
      <th
        className={cn(
          GRID_CELL.usageRights,
          OPERATIONAL_TABLE_HEADER_CELL,
          OPERATIONAL_TABLE_HEADER_SURFACE,
          "py-1.5"
        )}
      >
        {OPERATIONAL_GRID_LABELS.usageRights}
      </th>
      ) : null}
      {col("agencyFeePercent") ? (
      <th
        className={cn(
          GRID_CELL.agencyFeePercent,
          OPERATIONAL_TABLE_HEADER_CELL,
          OPERATIONAL_TABLE_HEADER_SURFACE,
          "py-1.5 text-muted-foreground"
        )}
      >
        {OPERATIONAL_GRID_LABELS.agencyFeePercent}
      </th>
      ) : null}
      {col("agencyFee") ? (
      <th
        className={cn(
          GRID_CELL.agencyFee,
          OPERATIONAL_TABLE_HEADER_CELL,
          OPERATIONAL_TABLE_HEADER_SURFACE,
          "py-1.5"
        )}
      >
        {OPERATIONAL_GRID_LABELS.agencyFee}
      </th>
      ) : null}
      {col("cost") ? (
      <th
        className={cn(
          GRID_CELL.money,
          OPERATIONAL_TABLE_HEADER_CELL,
          OPERATIONAL_TABLE_HEADER_SURFACE,
          "px-1.5 py-1.5"
        )}
      >
        {OPERATIONAL_GRID_LABELS.cost}
      </th>
      ) : null}
      {col("usageRightsCost") ? (
      <th
        className={cn(
          GRID_CELL.usageRightsCost,
          OPERATIONAL_TABLE_HEADER_CELL,
          OPERATIONAL_TABLE_HEADER_SURFACE,
          "py-1.5"
        )}
      >
        {OPERATIONAL_GRID_LABELS.usageRightsCost}
      </th>
      ) : null}
      {col("vat") ? (
      <th className={cn(GRID_CELL.vat, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.vat}
      </th>
      ) : null}
      {col("totalBilling") ? (
      <th
        className={cn(
          GRID_CELL.totalBilling,
          OPERATIONAL_TABLE_HEADER_CELL,
          OPERATIONAL_TABLE_HEADER_SURFACE,
          "py-1.5"
        )}
      >
        {OPERATIONAL_GRID_LABELS.totalBilling}
      </th>
      ) : null}
      {col("postDate") ? (
      <th className={cn(GRID_CELL.postDate, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.postDate}
      </th>
      ) : null}
      {col("liveAdMonth") ? (
      <th className={cn(GRID_CELL.month, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.liveAdMonth}
      </th>
      ) : null}
      {col("invoice") ? (
      <th className={cn(GRID_CELL.invoice, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.invoice}
      </th>
      ) : null}
      {col("billing") ? (
      <th className={cn(GRID_CELL.status, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.billing}
      </th>
      ) : null}
      {col("collection") ? (
      <th className={cn(GRID_CELL.collection, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.collection}
      </th>
      ) : null}
      {col("payout") ? (
      <th className={cn(GRID_CELL.payout, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.payout}
      </th>
      ) : null}
      {col("workflow") ? (
      <th className={cn(GRID_CELL.workflow, OPERATIONAL_TABLE_HEADER_CELL)}>
        {OPERATIONAL_GRID_LABELS.workflow}
      </th>
      ) : null}
      {col("actions") ? (
      <th className={cn(GRID_CELL.actions, OPERATIONAL_TABLE_HEADER_CELL)}>
        {actions}
      </th>
      ) : null}
    </tr>
  );
}
