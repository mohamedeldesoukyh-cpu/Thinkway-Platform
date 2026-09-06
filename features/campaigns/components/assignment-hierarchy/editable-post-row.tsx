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
  AssignmentGridCell,
  AssignmentGridRow,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-cell";
import { PARENT_TRACK_TO_CHILD_FIELD } from "@/features/campaigns/components/assignment-hierarchy/assignment-css-grid";
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
  isFirstOfType?: boolean;
  mixedTypes?: boolean;
  packageLine?: boolean;
  typeCommercial?: import("@/lib/campaigns/assignment-type-commercial").AssignmentTypeCommercialSlice | null;
  isLastChildRow?: boolean;
  showExpandColumn?: boolean;
  leadingParentColumnIds?: readonly string[];
  gridCols?: string;
  parentTrackIds?: readonly string[];
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
  deliverableScoped: boolean,
  typeCommercial?: import("@/lib/campaigns/assignment-type-commercial").AssignmentTypeCommercialSlice | null,
  mixedTypes = false
) {
  if (typeCommercial) {
    return {
      qty: typeCommercial.qty,
      revPerAd: typeCommercial.revPerAd,
      rev: typeCommercial.rev,
      costPerAd: typeCommercial.costPerAd,
      cost: typeCommercial.cost,
    };
  }
  if (deliverableScoped && !mixedTypes) {
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
  isFirstOfType = isFirstPost,
  mixedTypes = false,
  packageLine = false,
  typeCommercial = null,
  isLastChildRow = false,
  showExpandColumn = false,
  leadingParentColumnIds: leadingParentColumnIdsProp,
  gridCols,
  parentTrackIds,
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
  const useDeliverableCommercial = Boolean(typeCommercial) || deliverableScoped || isFirstOfType;

  const commercial = useOperationalCommercialDraft(
    commercialInitial(deliverable, post, useDeliverableCommercial, typeCommercial, mixedTypes)
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
    commercial.reset(commercialInitial(deliverable, post, useDeliverableCommercial, typeCommercial, mixedTypes));
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
    isFirstOfType,
    mixedTypes,
    typeCommercial?.qty,
    typeCommercial?.rev,
    typeCommercial?.cost,
    typeCommercial?.revPerAd,
    typeCommercial?.costPerAd,
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
    post.is_locked ? (deliverable.locked_at ?? "locked") : deliverable.locked_at
  );
  const canEditDeliverableScope =
    !readOnly && deliverableScoped && postId.length > 0 && !deliverable.is_locked;
  const canEditPostSchedule =
    !readOnly && postId.length > 0 && !isVirtualPost && !deliverable.is_locked;
  const canEdit = canEditDeliverableScope || canEditPostSchedule;
  const canEditCommercial = canEdit && !packageLine;
  const ownsDeliverableCommercial = isFirstOfType;
  const commercialLocked =
    packageLine ||
    !canEdit ||
    (gridEdit.hasSession && !gridEdit.isEditing) ||
    (gridEdit.hasSession && !ownsDeliverableCommercial) ||
    gridEdit.saving;
  const qtyLocked =
    !canEdit ||
    (gridEdit.hasSession && !gridEdit.isEditing) ||
    (gridEdit.hasSession && !ownsDeliverableCommercial) ||
    gridEdit.saving ||
    (!packageLine && mixedTypes) ||
    (!gridEdit.hasSession && !deliverableScoped && !packageLine);
  const amountAlwaysEditing =
    gridEdit.hasSession && gridEdit.isEditing && !commercialLocked;
  const showDeliverableCommercial =
    Boolean(typeCommercial) || deliverableScoped || isFirstOfType;

  const liveAgencyFeeAmount = useMemo(() => {
    if (!showDeliverableCommercial) return 0;
    return computeAgencyFeeAmount(
      commercial.draft.rev,
      Number(typeCommercial?.usageRightsAmount ?? deliverable.usage_rights_amount ?? 0),
      Number(typeCommercial?.agencyFeePercent ?? deliverable.agency_fee_percent ?? 0)
    );
  }, [
    showDeliverableCommercial,
    commercial.draft.rev,
    typeCommercial?.usageRightsAmount,
    typeCommercial?.agencyFeePercent,
    deliverable.usage_rights_amount,
    deliverable.agency_fee_percent,
  ]);

  const computedTotalBilling = useMemo(() => {
    if (showDeliverableCommercial && !mixedTypes && !typeCommercial) {
      return deliverable.revenue_after_vat;
    }
    return roundOperationalAmount(
      commercial.draft.rev + (revenueVatExempt ? 0 : computedVat)
    );
  }, [
    showDeliverableCommercial,
    mixedTypes,
    typeCommercial,
    deliverable.revenue_after_vat,
    commercial.draft.rev,
    revenueVatExempt,
    computedVat,
  ]);

  const baselineCommercial = useMemo(
    () => commercialInitial(deliverable, post, useDeliverableCommercial, typeCommercial, mixedTypes),
    [
      deliverable.quantity,
      deliverable.unit_revenue,
      deliverable.revenue_before_vat,
      deliverable.unit_cost,
      deliverable.cost_before_vat,
      useDeliverableCommercial,
      mixedTypes,
      typeCommercial?.qty,
      typeCommercial?.rev,
      typeCommercial?.cost,
      typeCommercial?.revPerAd,
      typeCommercial?.costPerAd,
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
        mixedTypes,
        packageLine,
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
    mixedTypes,
    packageLine,
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
    if (packageLine) {
      if (!ownsDeliverableCommercial || !canEdit) return;
    } else if (!canEditCommercial) {
      return;
    }
    startTransition(async () => {
      const result = await persistAssignmentPostRowDraft({
        campaignId,
        campaignLineId,
        deliverable,
        post,
        deliverableScoped,
        isVirtualPost,
        includeCommercial: ownsDeliverableCommercial,
        mixedTypes,
        packageLine,
        commercial: commercial.draft,
        meta,
      });
      if (!result.ok) {
        setError(result.message ?? "Failed to save.");
        return;
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
        <AssignmentGridCell
          key={parentColumnId} columnId={parentColumnId}
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
        <AssignmentGridCell
          key={parentColumnId} columnId={parentColumnId}
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
          <AssignmentGridCell
            key={parentColumnId} columnId={parentColumnId}
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
          </AssignmentGridCell>
        );
      case "platform":
        // Alignment slot under parent Creator — platform avatar lives beside Type.
        return (
          <AssignmentGridCell
            key={parentColumnId} columnId={parentColumnId}
            {...assignmentChildColDataAttr(childColumnId)}
            className={cellClass}
            aria-hidden
          />
        );
      case "qty":
        return (
          <AssignmentGridCell key={parentColumnId} columnId={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
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
          </AssignmentGridCell>
        );
      case "revPerAd":
        return (
          <AssignmentGridCell key={parentColumnId} columnId={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
            {showDeliverableCommercial ? (
              <OperationalAmountField
                value={commercial.draft.revPerAd}
                onChange={(n) => commercial.setRevPerAd(n)}
                onBlur={gridEdit.hasSession ? undefined : persistCommercial}
                disabled={commercialLocked}
                alwaysEditing={amountAlwaysEditing}
                editTint="rev"
                perUnit
              />
            ) : (
              <span className={OPERATIONAL_AMOUNT_CLASS}>—</span>
            )}
          </AssignmentGridCell>
        );
      case "costPerAd":
        return (
          <AssignmentGridCell key={parentColumnId} columnId={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
            {showDeliverableCommercial ? (
              <OperationalAmountField
                value={commercial.draft.costPerAd}
                onChange={(n) => commercial.setCostPerAd(n)}
                onBlur={gridEdit.hasSession ? undefined : persistCommercial}
                disabled={commercialLocked}
                alwaysEditing={amountAlwaysEditing}
                editTint="cost"
                perUnit
              />
            ) : (
              <span className={OPERATIONAL_AMOUNT_CLASS}>—</span>
            )}
          </AssignmentGridCell>
        );
      case "ccy":
        return (
          <AssignmentGridCell key={parentColumnId} columnId={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
            {currency}
          </AssignmentGridCell>
        );
      case "rev":
        return (
          <AssignmentGridCell key={parentColumnId} columnId={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
            {showDeliverableCommercial ? (
              <OperationalAmountField
                value={commercial.draft.rev}
                onChange={(n) => commercial.setRev(n)}
                onBlur={gridEdit.hasSession ? undefined : persistCommercial}
                disabled={commercialLocked}
                alwaysEditing={amountAlwaysEditing}
                editTint="rev"
              />
            ) : (
              <span className={OPERATIONAL_AMOUNT_CLASS}>—</span>
            )}
          </AssignmentGridCell>
        );
      default:
        return (
          <AssignmentGridCell
            key={parentColumnId} columnId={parentColumnId}
            {...assignmentChildColDataAttr(childColumnId)}
            className={cellClass}
            aria-hidden
          />
        );
    }
  }

  function emptyTrack(parentColumnId: string) {
    return (
      <AssignmentGridCell key={parentColumnId} columnId={parentColumnId}>
        <span />
      </AssignmentGridCell>
    );
  }

  function renderChildTrackCell(parentColumnId: string) {
    switch (parentColumnId) {
      case "usageRights":
        return (
          <AssignmentGridCell
            key={parentColumnId}
            columnId={parentColumnId}
            className={cn(GRID_CELL.usageRights, OPERATIONAL_AMOUNT_CLASS)}
          >
            {col("usageRights") && showDeliverableCommercial
              ? formatOperationalAmount(
                  typeCommercial?.usageRightsAmount ?? deliverable.usage_rights_amount
                )
              : col("usageRights")
                ? "—"
                : <span />}
          </AssignmentGridCell>
        );
      case "agencyFeePercent":
        return (
          <AssignmentGridCell
            key={parentColumnId}
            columnId={parentColumnId}
            className={cn(GRID_CELL.agencyFeePercent, OPERATIONAL_AMOUNT_CLASS, "text-muted-foreground")}
          >
            {col("agencyFeePercent") && showDeliverableCommercial
              ? formatPercent(typeCommercial?.agencyFeePercent ?? deliverable.agency_fee_percent)
              : col("agencyFeePercent")
                ? "—"
                : <span />}
          </AssignmentGridCell>
        );
      case "agencyFee":
        return (
          <AssignmentGridCell
            key={parentColumnId}
            columnId={parentColumnId}
            className={cn(GRID_CELL.agencyFee, OPERATIONAL_AMOUNT_CLASS)}
          >
            {col("agencyFee") && showDeliverableCommercial
              ? formatOperationalAmount(liveAgencyFeeAmount)
              : col("agencyFee")
                ? "—"
                : <span />}
          </AssignmentGridCell>
        );
      case "cost":
        return (
          <AssignmentGridCell
            key={parentColumnId}
            columnId={parentColumnId}
            className={cn(GRID_HIGHLIGHT_COST, GRID_CELL.money)}
          >
            {col("cost") && showDeliverableCommercial ? (
              <OperationalAmountField
                value={commercial.draft.cost}
                onChange={(n) => commercial.setCost(n)}
                onBlur={gridEdit.hasSession ? undefined : persistCommercial}
                disabled={commercialLocked}
                alwaysEditing={amountAlwaysEditing}
                editTint="cost"
              />
            ) : col("cost") ? (
              <span className={OPERATIONAL_AMOUNT_CLASS}>—</span>
            ) : (
              <span />
            )}
          </AssignmentGridCell>
        );
      case "usageRightsCost":
        return (
          <AssignmentGridCell
            key={parentColumnId}
            columnId={parentColumnId}
            className={cn(GRID_CELL.usageRightsCost, OPERATIONAL_AMOUNT_CLASS)}
          >
            {col("usageRightsCost") && showDeliverableCommercial
              ? formatOperationalAmount(
                  typeCommercial?.usageRightsCost ?? deliverable.usage_rights_cost
                )
              : col("usageRightsCost")
                ? "—"
                : <span />}
          </AssignmentGridCell>
        );
      case "vat":
        return (
          <AssignmentGridCell key={parentColumnId} columnId={parentColumnId} className={GRID_CELL.vat}>
            {!col("vat") ? (
              <span />
            ) : !showDeliverableCommercial ? (
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
                className="h-auto min-h-0 w-full border-0 bg-transparent py-0 text-center text-[11px] font-normal shadow-none focus-visible:ring-1"
              />
            ) : revenueVatExempt ? (
              <span className={OPERATIONAL_AMOUNT_CLASS}>Ex</span>
            ) : (
              <span className={OPERATIONAL_AMOUNT_CLASS}>
                {formatOperationalAmount(computedVat)}
              </span>
            )}
          </AssignmentGridCell>
        );
      case "totalBilling":
        return (
          <AssignmentGridCell
            key={parentColumnId}
            columnId={parentColumnId}
            className={cn(GRID_HIGHLIGHT_TOTAL_BILLING)}
          >
            {col("totalBilling") && showDeliverableCommercial
              ? formatOperationalAmount(computedTotalBilling)
              : col("totalBilling")
                ? "—"
                : <span />}
          </AssignmentGridCell>
        );
      case "gp":
        if (!col("postDate")) return emptyTrack(parentColumnId);
        return (
          <AssignmentGridCell key={parentColumnId} columnId={parentColumnId} className={GRID_CELL.postDate}>
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
                  disabled={pending || gridEdit.saving}
                  className="h-7 min-w-0 flex-1 px-1 text-[11px] leading-none"
                  aria-label="Live ad date"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  disabled={pending || gridEdit.saving}
                  title="Reset to publication date"
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
                {post.live_date ?? "not set"}
              </span>
            )}
          </AssignmentGridCell>
        );
      case "margin":
        if (!col("liveAdMonth")) return emptyTrack(parentColumnId);
        return (
          <AssignmentGridCell
            key={parentColumnId}
            columnId={parentColumnId}
            className={cn(GRID_CELL.month, "text-[10px] text-muted-foreground")}
          >
            {formatLiveAdMonth(meta.live_date || post.live_date)}
          </AssignmentGridCell>
        );
      case "opsStatus":
        if (!col("invoice")) return emptyTrack(parentColumnId);
        return (
          <AssignmentGridCell key={parentColumnId} columnId={parentColumnId} className={GRID_CELL.invoice}>
            {post.invoice_document_number ? (
              <Link href={`/billing/invoices/${post.invoice_id}`} className="text-[9px] hover:underline">
                <DocumentNumber value={post.invoice_document_number} showCanonicalTitle={false} />
              </Link>
            ) : (
              "—"
            )}
          </AssignmentGridCell>
        );
      case "billing":
        return (
          <AssignmentGridCell key={parentColumnId} columnId={parentColumnId} className={GRID_CELL.status}>
            <div className="flex min-w-0 flex-col items-start gap-0.5">
              {col("billing") ? (
                <AssignmentDeliverableBillingBadge billingStatus={post.billing_status} />
              ) : null}
              {col("collection") ? (
                <span className="text-[10px] text-muted-foreground">{collectionLabel}</span>
              ) : null}
              {!col("billing") && !col("collection") ? <span /> : null}
            </div>
          </AssignmentGridCell>
        );
      case "payout":
        if (!col("payout")) return emptyTrack(parentColumnId);
        return (
          <AssignmentGridCell key={parentColumnId} columnId={parentColumnId} className={GRID_CELL.payout}>
            {post.payout_status ? (
              <Badge variant="secondary" className="text-[9px] font-normal">
                {post.payout_status.replace(/_/g, " ")}
              </Badge>
            ) : (
              "—"
            )}
          </AssignmentGridCell>
        );
      case "actions":
        return (
          <AssignmentGridCell key={parentColumnId} columnId={parentColumnId} className={GRID_CELL.actions}>
            <div className="flex min-w-0 flex-col items-end gap-1">
              {col("workflow") ? (
                canEdit && fieldsActive ? (
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
                )
              ) : null}
              {!canEdit ? (
                <span className="text-muted-foreground">—</span>
              ) : gridEdit.hasSession ? (
                gridEdit.isEditing ? (
                  <span className="text-muted-foreground">—</span>
                ) : isFirstPost && !deliverable.is_synthetic ? (
                  <div className="flex justify-end gap-0.5">
                    <Button type="button" variant="ghost" size="icon" className="size-6" onClick={addPost} disabled={pending || gridEdit.saving} title="Add post">
                      <PlusIcon className="size-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="size-6 text-destructive" onClick={deleteDeliverable} disabled={pending || gridEdit.saving} title="Remove deliverable">
                      <Trash2Icon className="size-3" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )
              ) : editing ? (
                <div className="flex justify-end gap-0.5">
                  <Button type="button" variant="ghost" size="icon" className="size-6" onClick={saveMeta} disabled={pending}>
                    <CheckIcon className="size-3" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => setEditing(false)}>
                    <XIcon className="size-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex justify-end gap-0.5">
                  {isFirstPost && !deliverable.is_synthetic ? (
                    <>
                      <Button type="button" variant="ghost" size="icon" className="size-6" onClick={addPost} disabled={pending} title="Add post">
                        <PlusIcon className="size-3" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="size-6 text-destructive" onClick={deleteDeliverable} disabled={pending} title="Remove deliverable">
                        <Trash2Icon className="size-3" />
                      </Button>
                    </>
                  ) : null}
                  <Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => setEditing(true)}>
                    <PencilIcon className="size-3" />
                  </Button>
                </div>
              )}
            </div>
          </AssignmentGridCell>
        );
      default:
        return emptyTrack(parentColumnId);
    }
  }

  return (
    <>
      <AssignmentGridRow
        cols={gridCols ?? ""}
        className={cn(
          "tw-r tw-ad thinkway-campaign-asgn-child text-[11px] font-normal text-[var(--camp-text-2)]",
          !isLastChildRow && "border-b border-[var(--camp-border)]"
        )}
      >
        {(parentTrackIds ?? leadingParentColumnIds).map((parentColumnId) => {
          if (
            assignmentParentToChildLeadingColumnId(parentColumnId) != null ||
            parentColumnId === "select"
          ) {
            return renderLeadingBodyCell(parentColumnId);
          }
          return renderChildTrackCell(parentColumnId);
        })}
      </AssignmentGridRow>
      {error ? (
        <AssignmentGridRow cols={gridCols ?? ""} className="tw-r tw-ad">
          <div
            className="px-4 pb-1 text-[10px] text-destructive"
            style={{
              gridColumn: `1 / span ${parentTrackIds?.length || childColSpan}`,
            }}
          >
            {error}
          </div>
        </AssignmentGridRow>
      ) : null}
    </>
  );
}

type OperationalGridHeaderProps = {
  actions?: ReactNode;
  showExpandColumn?: boolean;
  leadingParentColumnIds?: readonly string[];
  gridCols?: string;
  parentTrackIds?: readonly string[];
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
  gridCols,
  parentTrackIds,
}: OperationalGridHeaderProps) {
  const col = useOperationalChildColumnVisibleChecker();
  const leadingParentColumnIds =
    leadingParentColumnIdsProp ?? assignmentChildLeadingParentColumnIds(showExpandColumn);

  function renderLeadingHeaderCell(parentColumnId: string) {
    const childColumnId = assignmentParentToChildLeadingColumnId(parentColumnId);
    if (!childColumnId) {
      return (
        <AssignmentGridCell header
          key={parentColumnId} columnId={parentColumnId}
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
        <AssignmentGridCell header
          key={parentColumnId} columnId={parentColumnId}
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
          <AssignmentGridCell header key={parentColumnId} columnId={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
            {OPERATIONAL_GRID_LABELS.type}
          </AssignmentGridCell>
        );
      case "platform":
        return (
          <AssignmentGridCell header
            key={parentColumnId} columnId={parentColumnId}
            {...assignmentChildColDataAttr(childColumnId)}
            className={cellClass}
            aria-hidden
          />
        );
      case "qty":
        return (
          <AssignmentGridCell header key={parentColumnId} columnId={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
            {OPERATIONAL_GRID_LABELS.qty}
          </AssignmentGridCell>
        );
      case "revPerAd":
        return (
          <AssignmentGridCell header
            key={parentColumnId} columnId={parentColumnId}
            {...assignmentChildColDataAttr(childColumnId)}
            className={cn(cellClass, "whitespace-nowrap px-1.5")}
          >
            {OPERATIONAL_GRID_LABELS.revPerAd}
          </AssignmentGridCell>
        );
      case "costPerAd":
        return (
          <AssignmentGridCell header
            key={parentColumnId} columnId={parentColumnId}
            {...assignmentChildColDataAttr(childColumnId)}
            className={cn(cellClass, "whitespace-nowrap px-1.5")}
          >
            {OPERATIONAL_GRID_LABELS.costPerAd}
          </AssignmentGridCell>
        );
      case "ccy":
        return (
          <AssignmentGridCell header key={parentColumnId} columnId={parentColumnId} {...assignmentChildColDataAttr(childColumnId)} className={cellClass}>
            {OPERATIONAL_GRID_LABELS.ccy}
          </AssignmentGridCell>
        );
      case "rev":
        return (
          <AssignmentGridCell header
            key={parentColumnId} columnId={parentColumnId}
            {...assignmentChildColDataAttr(childColumnId)}
            className={cn(
              cellClass,
              OPERATIONAL_TABLE_HEADER_SURFACE,
              "py-1.5"
            )}
          >
            {OPERATIONAL_GRID_LABELS.rev}
          </AssignmentGridCell>
        );
      default:
        return (
          <AssignmentGridCell header
            key={parentColumnId} columnId={parentColumnId}
            {...assignmentChildColDataAttr(childColumnId)}
            className={cellClass}
            aria-hidden
          />
        );
    }
  }

  function renderHeaderTrack(parentColumnId: string) {
    if (
      assignmentParentToChildLeadingColumnId(parentColumnId) != null ||
      parentColumnId === "select"
    ) {
      return renderLeadingHeaderCell(parentColumnId);
    }
    const labels: Record<string, string> = {
      usageRights: OPERATIONAL_GRID_LABELS.usageRights,
      agencyFeePercent: OPERATIONAL_GRID_LABELS.agencyFeePercent,
      agencyFee: OPERATIONAL_GRID_LABELS.agencyFee,
      cost: OPERATIONAL_GRID_LABELS.cost,
      usageRightsCost: OPERATIONAL_GRID_LABELS.usageRightsCost,
      vat: OPERATIONAL_GRID_LABELS.vat,
      totalBilling: OPERATIONAL_GRID_LABELS.totalBilling,
      gp: OPERATIONAL_GRID_LABELS.postDate,
      margin: OPERATIONAL_GRID_LABELS.liveAdMonth,
      opsStatus: OPERATIONAL_GRID_LABELS.invoice,
      billing: OPERATIONAL_GRID_LABELS.billing,
      payout: OPERATIONAL_GRID_LABELS.payout,
      actions: "",
    };
    const childField = PARENT_TRACK_TO_CHILD_FIELD[parentColumnId];
    const show =
      parentColumnId === "actions" ||
      parentColumnId === "billing" ||
      (childField ? col(childField) : false) ||
      (parentColumnId === "gp" && col("postDate")) ||
      (parentColumnId === "margin" && col("liveAdMonth")) ||
      (parentColumnId === "opsStatus" && col("invoice"));
    return (
      <AssignmentGridCell
        header
        key={parentColumnId}
        columnId={parentColumnId}
        className={cn(OPERATIONAL_TABLE_HEADER_CELL, OPERATIONAL_TABLE_HEADER_SURFACE, "py-1.5")}
      >
        {parentColumnId === "actions"
          ? actions
          : show
            ? labels[parentColumnId] ?? ""
            : <span />}
      </AssignmentGridCell>
    );
  }

  return (
    <AssignmentGridRow
      cols={gridCols ?? ""}
      className={cn(
        "tw-adh",
        OPERATIONAL_TABLE_HEADER_ROW,
        "thinkway-campaign-asgn-child-hdr"
      )}
    >
      {(parentTrackIds ?? leadingParentColumnIds).map(renderHeaderTrack)}
    </AssignmentGridRow>
  );
}
