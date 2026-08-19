"use client";

import Link from "next/link";
import {
  CheckIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { DocumentNumber } from "@/components/ui/document-number";
import { Button } from "@/components/ui/button";
import { useConfirmDelete } from "@/components/shared/confirm-action-provider";
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
  resetLiveDateToPublicationAction,
  updateAssignmentDeliverableAction,
  updatePostScheduleAction,
} from "@/features/campaigns/actions/assignment-deliverable-actions";
import { AssignmentRowCircleControl } from "@/features/campaigns/components/assignment-hierarchy/assignment-row-circle-control";
import { AssignmentDeliverableBillingBadge } from "@/features/campaigns/components/assignment-hierarchy/assignment-status-badges";
import { DeliverableWorkflowBadge } from "@/features/campaigns/components/assignment-hierarchy/deliverable-workflow-badge";
import {
  OperationalAmountField,
  OperationalQtyField,
} from "@/features/campaigns/components/assignment-hierarchy/operational-amount-field";
import { formatOperationalAmount, roundOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import { computeAgencyFeeAmount } from "@/lib/assignments/client-billing-commercial";
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
} from "@/features/campaigns/components/assignment-hierarchy/platform-deliverable-selects";
import {
  assignmentChildColDataAttr,
  assignmentChildLeadingParentColumnIds,
  assignmentChildRowColSpan,
  assignmentChildTypeLabelBesidePlatform,
  assignmentParentToChildLeadingColumnId,
  SCHEDULE_STATUS_OPTIONS,
} from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import { PlatformIcon } from "@/lib/performance/platform-icon";
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
import { useAssignmentGridEditSession } from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-edit-session";
import { isAssignmentPostDraftDirty } from "@/features/campaigns/components/assignment-hierarchy/assignment-post-draft-dirty";
import { persistAssignmentPostRowDraft } from "@/features/campaigns/components/assignment-hierarchy/assignment-post-row-flush";
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
  const confirmDelete = useConfirmDelete();
  const gridEdit = useAssignmentGridEditSession();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fieldsActive = gridEdit.hasSession ? gridEdit.isEditing : editing;
  const useDeliverableCommercial = deliverableScoped || isFirstPost;

  const commercial = useOperationalCommercialDraft(
    commercialInitial(deliverable, post, useDeliverableCommercial)
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
    if (fieldsActive) return;
    commercial.reset(commercialInitial(deliverable, post, useDeliverableCommercial));
    setMeta({
      platform: post.platform,
      deliverable_type: post.deliverable_type,
      live_date: post.live_date ?? "",
      revenue_vat_percent: post.revenue_vat_percent || defaultRevenueVatPercent,
      workflow_status: post.workflow_status,
      billing_status: post.billing_status,
      notes: post.notes ?? "",
    });
    // Keep drafts while Edit is open, including the window after Save before refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
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
    isFirstPost,
    defaultRevenueVatPercent,
    gridEdit.discardEpoch,
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
    post.live_date,
    post.is_locked || deliverable.locked_at
  );
  const canEditDeliverableScope =
    !readOnly && deliverableScoped && postId.length > 0 && !deliverable.is_locked;
  const canEditPostSchedule =
    !readOnly && postId.length > 0 && !isVirtualPost && !deliverable.is_locked;
  const canEdit = canEditDeliverableScope || canEditPostSchedule;
  const canEditCommercial = canEdit;
  const ownsDeliverableCommercial = isFirstPost;
  const commercialLocked =
    !canEditCommercial ||
    (gridEdit.hasSession && !gridEdit.isEditing) ||
    (gridEdit.hasSession && !ownsDeliverableCommercial) ||
    gridEdit.saving;
  const qtyLocked =
    commercialLocked || (!gridEdit.hasSession && !deliverableScoped);
  const amountAlwaysEditing =
    gridEdit.hasSession && gridEdit.isEditing && !commercialLocked;
  const showDeliverableCommercial =
    deliverableScoped || isFirstPost;

  const liveAgencyFeeAmount = useMemo(() => {
    if (!showDeliverableCommercial) return 0;
    return computeAgencyFeeAmount(
      commercial.draft.rev,
      Number(deliverable.usage_rights_amount ?? 0),
      Number(deliverable.agency_fee_percent ?? 0)
    );
  }, [
    showDeliverableCommercial,
    commercial.draft.rev,
    deliverable.usage_rights_amount,
    deliverable.agency_fee_percent,
  ]);

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

  const baselineCommercial = useMemo(
    () => commercialInitial(deliverable, post, useDeliverableCommercial),
    [
      deliverable.quantity,
      deliverable.unit_revenue,
      deliverable.revenue_before_vat,
      deliverable.unit_cost,
      deliverable.cost_before_vat,
      useDeliverableCommercial,
      post.revenue_per_post,
      post.cost_per_post,
    ]
  );
  const baselineMeta = useMemo<MetaDraft>(
    () => ({
      platform: post.platform,
      deliverable_type: post.deliverable_type,
      live_date: post.live_date ?? "",
      revenue_vat_percent: post.revenue_vat_percent || defaultRevenueVatPercent,
      workflow_status: post.workflow_status,
      billing_status: post.billing_status,
      notes: post.notes ?? "",
    }),
    [
      post.platform,
      post.deliverable_type,
      post.live_date,
      post.revenue_vat_percent,
      post.workflow_status,
      post.billing_status,
      post.notes,
      defaultRevenueVatPercent,
    ]
  );

  const flushStateRef = useRef({
    canEdit,
    includeCommercial: ownsDeliverableCommercial,
    commercial: commercial.draft,
    meta,
    baselineCommercial,
    baselineMeta,
  });
  flushStateRef.current = {
    canEdit,
    includeCommercial: ownsDeliverableCommercial,
    commercial: commercial.draft,
    meta,
    baselineCommercial,
    baselineMeta,
  };

  useEffect(() => {
    if (!gridEdit.hasSession || !canEdit) return;
    return gridEdit.registerFlush(`post:${deliverable.id}:${postId}`, async () => {
      const snapshot = flushStateRef.current;
      if (!snapshot.canEdit) return { ok: true };
      if (
        !isAssignmentPostDraftDirty({
          commercial: snapshot.commercial,
          baselineCommercial: snapshot.baselineCommercial,
          meta: snapshot.meta,
          baselineMeta: snapshot.baselineMeta,
          includeCommercial: snapshot.includeCommercial,
        })
      ) {
        return { ok: true };
      }
      return persistAssignmentPostRowDraft({
        campaignId,
        campaignLineId,
        deliverable,
        post,
        deliverableScoped,
        isVirtualPost,
        includeCommercial: snapshot.includeCommercial,
        commercial: snapshot.commercial,
        meta: snapshot.meta,
      });
    });
  }, [
    gridEdit.hasSession,
    gridEdit.registerFlush,
    canEdit,
    campaignId,
    campaignLineId,
    deliverable,
    post,
    deliverableScoped,
    isVirtualPost,
    postId,
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

  function resetLiveDateToPublication() {
    if (!canEditLiveDateField) return;
    startTransition(async () => {
      const result = await resetLiveDateToPublicationAction({
        campaign_id: campaignId,
        campaign_line_id: campaignLineId,
        platform: meta.platform,
      });
      if (!result.ok) {
        setError(result.message ?? "Failed to reset live ad date.");
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
          usage_rights_amount: Number(deliverable.usage_rights_amount ?? 0),
          usage_rights_cost: Number(deliverable.usage_rights_cost ?? 0),
          agency_fee_percent: Number(deliverable.agency_fee_percent ?? 0),
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
    // Virtual deliverable rows have no post schedule — commercial-only save.
    if (deliverableScoped && isVirtualPost) {
      persistCommercial();
      setEditing(false);
      return;
    }
    // STAB-027: single-post deliverables are deliverableScoped, but workflow
    // status lives on assignment_post_schedule. Commercial-only save discarded
    // Draft→Posted (and timeline never advanced).
    if (deliverableScoped && !isVirtualPost) {
      startTransition(async () => {
        const commercialResult = await updateAssignmentDeliverableAction({
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
        if (!commercialResult.ok) {
          setError(commercialResult.message ?? "Failed to save.");
          return;
        }
        const statusResult = await updatePostScheduleAction(buildSchedulePayload());
        if (!statusResult.ok) {
          setError(statusResult.message ?? "Failed to save workflow status.");
          return;
        }
        setEditing(false);
        setError(null);
        router.refresh();
      });
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

  async function deleteDeliverable() {
    if (readOnly || deliverable.is_synthetic) return;
    const ok = await confirmDelete(
      "Remove this deliverable and all its posts from the campaign? This cannot be undone.",
      "Remove deliverable?"
    );
    if (!ok) return;
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
    if (!childColumnId) {
      return (
        <td
          key={parentColumnId}
          className={GRID_CELL.leadingRev}
          aria-hidden
        />
      );
    }

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
      childColumnId === "fullDescriptionSpacer" ||
      !col(childColumnId) ||
      childColumnId === "expand" ||
      childColumnId === "select"
    ) {
      return (
        <td
          key={parentColumnId}
          {...(childColumnId === "fullDescriptionSpacer"
            ? {}
            : assignmentChildColDataAttr(childColumnId))}
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
            <div className="flex min-w-0 items-center gap-1.5">
              {gridEdit.hasSession &&
              gridEdit.isEditing &&
              isFirstPost &&
              !deliverable.is_synthetic &&
              !readOnly ? (
                <AssignmentRowCircleControl
                  kind="remove"
                  disabled={pending || gridEdit.saving}
                  label="Remove deliverable"
                  onClick={() => {
                    void deleteDeliverable();
                  }}
                />
              ) : null}
              {canEdit && fieldsActive && (deliverableScoped || isFirstPost) ? (
                <>
                  <PlatformSelect
                    platform={meta.platform}
                    platformOptions={platformOptions}
                    disabled={pending || gridEdit.saving}
                    onPlatformChange={(platform) => {
                      const types = getDeliverableTypeCodesForPlatform(platform);
                      setMeta((m) => ({
                        ...m,
                        platform,
                        deliverable_type: types[0] ?? "other",
                      }));
                    }}
                  />
                  <DeliverableTypeSelect
                    platform={meta.platform}
                    deliverableType={meta.deliverable_type}
                    disabled={pending || gridEdit.saving}
                    onDeliverableTypeChange={(deliverableType) =>
                      setMeta((m) => ({ ...m, deliverable_type: deliverableType }))
                    }
                  />
                </>
              ) : (
                <>
                  <PlatformIcon
                    platform={post.platform}
                    size="xs"
                    variant="logo"
                    className="size-4 rounded-full"
                  />
                  <span className="min-w-0 truncate">
                    {assignmentChildTypeLabelBesidePlatform(
                      post.deliverable_type,
                      post.deliverable_type_label
                    )}
                    {!deliverableScoped && post.sequence_number
                      ? ` ${post.sequence_number}`
                      : ""}
                  </span>
                </>
              )}
            </div>
          </td>
        );
      case "platform":
        // Alignment slot under parent Creator — platform avatar lives beside Type.
        return (
          <td
            key={parentColumnId}
            {...assignmentChildColDataAttr(childColumnId)}
            className={cellClass}
            aria-hidden
          />
        );
      case "qty":
        return (
          <td key={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
            {showDeliverableCommercial ? (
              <OperationalQtyField
                value={commercial.draft.qty}
                onChange={(q) => commercial.setQty(q)}
                onBlur={gridEdit.hasSession ? undefined : persistCommercial}
                disabled={qtyLocked}
                alwaysEditing={gridEdit.hasSession && gridEdit.isEditing && !qtyLocked}
              />
            ) : (
              <span className={OPERATIONAL_AMOUNT_CLASS}>—</span>
            )}
          </td>
        );
      case "revPerAd":
        return (
          <td key={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
            {showDeliverableCommercial ? (
              <OperationalAmountField
                value={commercial.draft.revPerAd}
                onChange={(n) => commercial.setRevPerAd(n)}
                onBlur={gridEdit.hasSession ? undefined : persistCommercial}
                disabled={commercialLocked}
                alwaysEditing={amountAlwaysEditing}
                perUnit
              />
            ) : (
              <span className={OPERATIONAL_AMOUNT_CLASS}>—</span>
            )}
          </td>
        );
      case "costPerAd":
        return (
          <td key={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
            {showDeliverableCommercial ? (
              <OperationalAmountField
                value={commercial.draft.costPerAd}
                onChange={(n) => commercial.setCostPerAd(n)}
                onBlur={gridEdit.hasSession ? undefined : persistCommercial}
                disabled={commercialLocked}
                alwaysEditing={amountAlwaysEditing}
                perUnit
              />
            ) : (
              <span className={OPERATIONAL_AMOUNT_CLASS}>—</span>
            )}
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
            {showDeliverableCommercial ? (
              <OperationalAmountField
                value={commercial.draft.rev}
                onChange={(n) => commercial.setRev(n)}
                onBlur={gridEdit.hasSession ? undefined : persistCommercial}
                disabled={commercialLocked}
                alwaysEditing={amountAlwaysEditing}
              />
            ) : (
              <span className={OPERATIONAL_AMOUNT_CLASS}>—</span>
            )}
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
          fieldsActive && "bg-[var(--camp-row-open)]"
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
            ? formatOperationalAmount(liveAgencyFeeAmount)
            : "—"}
        </td>
        ) : null}
        {col("cost") ? (
        <td className={cn(GRID_HIGHLIGHT_COST, GRID_CELL.money)}>
          {showDeliverableCommercial ? (
            <OperationalAmountField
              value={commercial.draft.cost}
              onChange={(n) => commercial.setCost(n)}
              onBlur={gridEdit.hasSession ? undefined : persistCommercial}
              disabled={commercialLocked}
              alwaysEditing={amountAlwaysEditing}
            />
          ) : (
            <span className={OPERATIONAL_AMOUNT_CLASS}>—</span>
          )}
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
          {!showDeliverableCommercial ? (
            <span className={OPERATIONAL_AMOUNT_CLASS}>—</span>
          ) : fieldsActive && !revenueVatExempt ? (
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
              disabled={gridEdit.saving}
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
          {showDeliverableCommercial
            ? formatOperationalAmount(computedTotalBilling)
            : "—"}
        </td>
        ) : null}
        {col("postDate") ? (
        <td className={GRID_CELL.postDate}>
          {canEditLiveDateField && (!gridEdit.hasSession || gridEdit.isEditing) ? (
            <div className="flex min-w-0 items-center justify-center gap-0.5 px-0.5">
              <Input
                type="date"
                value={meta.live_date}
                onChange={(e) => setMeta((m) => ({ ...m, live_date: e.target.value }))}
                onBlur={
                  gridEdit.hasSession
                    ? undefined
                    : (e) => persistLiveDate(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !gridEdit.hasSession) {
                    e.preventDefault();
                    persistLiveDate(meta.live_date);
                  }
                }}
                disabled={pending || gridEdit.saving}
                className="h-7 min-w-[8.75rem] flex-1 basis-[8.75rem] px-1 text-[11px] leading-none"
                aria-label="Live ad date"
                title={
                  post.live_date_source === "publication"
                    ? "From publication (you can overwrite)"
                    : post.publication_live_date
                      ? `Manual overwrite · publication default ${post.publication_live_date}`
                      : "Live ad date"
                }
              />
              {gridEdit.hasSession ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  disabled={pending}
                  title="Save live ad date"
                  onClick={() => persistLiveDate(meta.live_date)}
                >
                  <CheckIcon className="size-3.5" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                disabled={pending || gridEdit.saving}
                title={
                  post.publication_live_date
                    ? `Reset to publication (${post.publication_live_date})`
                    : "Reset to publication date"
                }
                onClick={() => {
                  if (gridEdit.hasSession) {
                    setMeta((m) => ({
                      ...m,
                      live_date: post.publication_live_date ?? "",
                    }));
                    return;
                  }
                  resetLiveDateToPublication();
                }}
              >
                <RotateCcwIcon className="size-3.5" />
              </Button>
            </div>
          ) : (
            <span className="whitespace-nowrap text-[11px] text-muted-foreground">
              {post.live_date ?? "—"}
            </span>
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
          {canEdit && fieldsActive ? (
            <Select
              value={meta.workflow_status}
              onValueChange={(v) => setMeta((m) => ({ ...m, workflow_status: v }))}
              disabled={gridEdit.saving}
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
          ) : gridEdit.hasSession ? (
            <div className="flex justify-end gap-0.5">
              {gridEdit.isEditing ? (
                <span className="text-muted-foreground">—</span>
              ) : isFirstPost && !deliverable.is_synthetic ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={addPost}
                    disabled={pending || gridEdit.saving}
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
                    disabled={pending || gridEdit.saving}
                    title="Remove deliverable"
                  >
                    <Trash2Icon className="size-3" />
                  </Button>
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
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
    if (!childColumnId) {
      return (
        <th
          key={parentColumnId}
          className={cn(GRID_CELL.leadingRev, OPERATIONAL_TABLE_HEADER_CELL)}
          aria-hidden
        />
      );
    }

    const cellClass = cn(childLeadingHeaderClass(childColumnId), OPERATIONAL_TABLE_HEADER_CELL);

    if (
      childColumnId === "fullDescriptionSpacer" ||
      !col(childColumnId) ||
      childColumnId === "expand" ||
      childColumnId === "select"
    ) {
      return (
        <th
          key={parentColumnId}
          {...(childColumnId === "fullDescriptionSpacer"
            ? {}
            : assignmentChildColDataAttr(childColumnId))}
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
          <th
            key={parentColumnId}
            {...assignmentChildColDataAttr(childColumnId)}
            className={cellClass}
            aria-hidden
          />
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
