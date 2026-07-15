"use client";

import { useCallback, useMemo, useTransition } from "react";
import {
  CopyIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { CreatorLinkedPlatformIcons } from "@/components/creator/creator-linked-platform-icons";
import { CreatorIdentityCell } from "@/components/creator/creator-profile-link";
import { CreatorTierBadge } from "@/components/creator/creator-tier-badge";
import { resolveQuotationCreatorProfileSource } from "@/lib/quotations/quotation-creator-source";
import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";
import { formatCreatorCount } from "@/features/discovery/components/creator-search/creator-search-utils";
import {
  addQuotationItemOption,
  duplicateQuotationItems,
  removeQuotationItem,
  returnQuotationItemToShortlist,
} from "@/features/quotations/actions";
import { useQuotationManualSave } from "@/features/quotations/components/quotation-manual-save";
import { QuotationCreatorOptionSelect } from "@/features/quotations/components/quotation-creator-option-select";
import { QuotationDeliverableTypeLinesEditor } from "@/features/quotations/components/quotation-deliverable-type-lines";
import { QuotationDeliverableCostDetails } from "@/features/quotations/components/quotation-deliverable-cost-details";
import { QuotationDeliverablePlatformIcons } from "@/features/quotations/components/quotation-deliverable-platform-icons";
import { QuotationLinePlatformCell } from "@/features/quotations/components/quotation-line-scope-cell";
import {
  fromDeliverableDrafts,
  useQuotationLineFields,
  type DeliverableDraft,
} from "@/features/quotations/components/quotation-line-fields";
import type { QuotationDeliverable, QuotationItemRow } from "@/features/quotations/types";
import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";
import type { QuotationDeliverableTypeLine } from "@/lib/domains/commercial/quotation-types";
import {
  deliverableTypeLines,
  deliverableTypeValues,
  platformsFromSelectedPostTypes,
  syncDeliverableFromTypeLines,
  typeLinesIncludeAllPlatforms,
} from "@/lib/quotations/quotation-deliverable-types";
import {
  formatDeliverableGpPct,
  formatDeliverablePrice,
} from "@/lib/quotations/quotation-deliverable-commercial";
import type { AutosaveStatus } from "@/lib/hooks/use-debounced-autosave";
import { cn } from "@/lib/utils";
import { isManualQuotationCreator } from "@/lib/quotations/quotation-creator-platform-options";

function SaveIndicator({ status }: { status: AutosaveStatus }) {
  if (status === "pending") return <span className="text-[10px] text-warning">Unsaved</span>;
  if (status === "saving")
    return <span className="text-[10px] text-muted-foreground">Saving…</span>;
  if (status === "saved") return <span className="text-[10px] text-primary">Saved</span>;
  if (status === "error") return <span className="text-[10px] text-destructive">Failed</span>;
  return null;
}

type Props = {
  quotationId: string;
  shortlistId: string | null;
  item: QuotationItemRow;
  draft: QuotationRowDraft | undefined;
  zebra: boolean;
  displayOptionNumber: number;
  optionShadeClass?: string;
  showOptionLabel?: boolean;
  creatorDuplicateCount?: number;
  /** When true, creator is shown in the group header row above. */
  groupMode?: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onDraftChange: (id: string, patch: Partial<QuotationRowDraft>) => void;
  onRemoved: () => void;
  onLineChanged: () => void;
  onOpenCreator?: () => void;
  /** When true, open platform/type/cost selectors for immediate configuration. */
  autoOpenEditors?: boolean;
};

function resolveDeliverableDisplayPlatforms(
  deliverable: DeliverableDraft,
  allowedCreatorPlatforms: string[],
  itemPlatform: string | null
): string[] {
  if (typeLinesIncludeAllPlatforms(deliverable)) return [];
  const fromTypes = platformsFromSelectedPostTypes(
    deliverableTypeValues(deliverable),
    allowedCreatorPlatforms
  );
  if (fromTypes.length > 0) return fromTypes;
  const fromField = (deliverable.platform ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (fromField.length > 0) return fromField;
  if (allowedCreatorPlatforms.length === 1) return [allowedCreatorPlatforms[0]!];
  if (itemPlatform) return [itemPlatform];
  return [];
}

export function QuotationCreatorDeliverableRows({
  quotationId,
  shortlistId,
  item,
  draft,
  zebra,
  displayOptionNumber,
  optionShadeClass,
  showOptionLabel = false,
  creatorDuplicateCount = 1,
  groupMode = false,
  selected,
  onToggleSelect,
  onDraftChange,
  onRemoved,
  onLineChanged,
  onOpenCreator,
  autoOpenEditors = false,
}: Props) {
  const [pending, startTransition] = useTransition();
  const manualSave = useQuotationManualSave();
  const costCurrency = draft?.costCurrency ?? item.cost_currency;

  const optionSelectValues = useMemo(() => {
    const upper = Math.max(creatorDuplicateCount, displayOptionNumber, 1) + 1;
    return Array.from({ length: upper }, (_, i) => i + 1);
  }, [creatorDuplicateCount, displayOptionNumber]);

  const handleDeliverableCommercialsDerived = useCallback(
    (commercials: {
      cost: number;
      revenue: number;
      gpValue: number;
      gpPct: number;
    }) => {
      onDraftChange(item.id, {
        mode: "cost_revenue",
        cost: commercials.cost,
        revenue: commercials.revenue,
        gpPct: commercials.gpPct,
        gpValue: commercials.gpValue,
      });
    },
    [item.id, onDraftChange]
  );

  const lineFields = useQuotationLineFields(
    item,
    handleDeliverableCommercialsDerived,
    (payload) => manualSave.registerLinePending(item.id, payload),
    manualSave.isLinePending(item.id) ? "pending" : "idle",
    manualSave.isLinePending(item.id),
    manualSave.registerSaveFlush
  );

  const allowedCreatorPlatforms = useMemo(
    () => lineFields.platformSelectOptions.map((p) => p.platform),
    [lineFields.platformSelectOptions]
  );

  const creatorTier = useMemo(
    () => resolveCreatorTierLabel({ followers: item.followers }),
    [item.followers]
  );

  const creatorProfileSource = useMemo(() => {
    const base = item.creator_profile_source;
    const linked =
      base?.linkedPlatforms && base.linkedPlatforms.length > 0
        ? base.linkedPlatforms
        : allowedCreatorPlatforms;
    return resolveQuotationCreatorProfileSource(item, linked);
  }, [item, allowedCreatorPlatforms]);

  const isManualCreator = useMemo(() => isManualQuotationCreator(item), [item]);

  const displayRows = useMemo((): DeliverableDraft[] => {
    return lineFields.deliverableDrafts.map((d) => {
      const type_lines = deliverableTypeLines(d);
      const synced = syncDeliverableFromTypeLines(
        type_lines,
        allowedCreatorPlatforms,
        d.platform || item.platform || allowedCreatorPlatforms[0] || "instagram"
      );
      return { ...d, ...synced };
    });
  }, [lineFields.deliverableDrafts, item.platform, allowedCreatorPlatforms]);

  const rowSpan = displayRows.length;

  function handleOptionChange(value: string) {
    const nextOption = Number(value);
    if (!Number.isFinite(nextOption) || nextOption < 1) return;
    manualSave.registerLinePending(item.id, { option_number: nextOption });
  }

  function applyDeliverable(key: string, next: QuotationDeliverable) {
    lineFields.saveDeliverables(
      lineFields.deliverableDrafts.map((d) => (d.key === key ? { ...d, ...next } : d))
    );
  }

  function updateDraft(key: string, patch: Partial<DeliverableDraft>) {
    lineFields.updateDeliverableDraftLocal(key, patch);
    lineFields.scheduleDeliverableCommit();
  }

  function handleTypeLinesChange(
    key: string,
    typeLines: QuotationDeliverableTypeLine[],
    options?: { persist?: boolean }
  ) {
    const synced = syncDeliverableFromTypeLines(
      typeLines,
      allowedCreatorPlatforms,
      item.platform ?? allowedCreatorPlatforms[0] ?? "instagram"
    );
    if (options?.persist === false) {
      lineFields.updateDeliverableDraftLocal(key, synced);
      return;
    }
    updateDraft(key, synced);
  }

  function handleAddOption() {
    startTransition(async () => {
      const res = await addQuotationItemOption({
        quotation_id: quotationId,
        item_id: item.id,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Option added.");
      onLineChanged();
    });
  }

  function handleDuplicateLine() {
    startTransition(async () => {
      const res = await duplicateQuotationItems({
        quotation_id: quotationId,
        item_ids: [item.id],
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Line duplicated.");
      onLineChanged();
    });
  }

  function handleReturnToShortlist() {
    if (!shortlistId) {
      toast.error("This quotation is not linked to a shortlist.");
      return;
    }
    startTransition(async () => {
      const res = await returnQuotationItemToShortlist({
        quotation_id: quotationId,
        item_id: item.id,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Creator returned to shortlist.");
      onLineChanged();
    });
  }

  function handleAddType() {
    lineFields.handleAddDeliverable();
  }

  function handleRemoveType(key: string) {
    lineFields.removeDeliverable(key);
  }

  function handleRemoveCreator() {
    startTransition(async () => {
      const res = await removeQuotationItem({ item_id: item.id, quotation_id: quotationId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Creator removed.");
      onRemoved();
    });
  }

  const rowClass = cn(
    "align-top [&_td]:py-1.5",
    optionShadeClass,
    selected && "ring-1 ring-inset ring-primary/25",
    !optionShadeClass && zebra && "bg-muted/30",
    !optionShadeClass && "hover:bg-muted/50"
  );

  return (
    <>
      {displayRows.map((deliverable, index) => {
        const isFirst = index === 0;
        const canRemoveRow = displayRows.length > 1;
        const displayPlatforms = resolveDeliverableDisplayPlatforms(
          deliverable,
          allowedCreatorPlatforms,
          item.platform
        );

        return (
          <TableRow
            key={`${item.id}-${deliverable.key}`}
            className={rowClass}
            data-quotation-item-id={isFirst ? item.id : undefined}
          >
            {isFirst ? (
              <TableCell rowSpan={rowSpan} className="px-2 align-middle">
                <Checkbox
                  checked={selected}
                  onCheckedChange={onToggleSelect}
                  aria-label={`Select ${item.creator_name ?? item.handle ?? "creator"}`}
                />
              </TableCell>
            ) : null}

            {isFirst ? (
              <TableCell rowSpan={rowSpan} className="min-w-[92px] align-middle px-2">
                {showOptionLabel ? (
                  <QuotationCreatorOptionSelect
                    displayOptionNumber={displayOptionNumber}
                    optionSelectValues={optionSelectValues}
                    onChange={handleOptionChange}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            ) : null}

            {!groupMode && isFirst ? (
              <TableCell rowSpan={rowSpan} className="min-w-[160px] align-middle px-2">
                <CreatorIdentityCell
                  source={creatorProfileSource}
                  avatarBadge="country"
                  showPlatformBadge={false}
                  showExternalIcon
                  linkName={false}
                  onNameClick={onOpenCreator}
                  stopPropagation
                  className="min-w-0 max-w-full"
                  nameClassName="truncate"
                  trailing={
                    (creatorProfileSource.linkedPlatforms?.length ?? 0) > 0 ? (
                      <CreatorLinkedPlatformIcons
                        platforms={creatorProfileSource.linkedPlatforms ?? []}
                      />
                    ) : null
                  }
                />
              </TableCell>
            ) : null}

            {isFirst ? (
              <TableCell
                rowSpan={rowSpan}
                className="align-middle text-right tabular-nums text-xs text-muted-foreground"
              >
                {formatCreatorCount(item.followers)}
              </TableCell>
            ) : null}

            {isFirst ? (
              <TableCell rowSpan={rowSpan} className="min-w-[72px] align-middle">
                {creatorTier === "Unknown" ? (
                  <span className="text-[11px] text-muted-foreground">—</span>
                ) : (
                  <CreatorTierBadge tier={creatorTier} />
                )}
              </TableCell>
            ) : null}

            <TableCell className="min-w-[140px] align-top">
              <Input
                className="h-8 text-[11px]"
                placeholder="Service description…"
                value={deliverable.service_description ?? ""}
                onChange={(e) => {
                  updateDraft(deliverable.key, { service_description: e.target.value });
                }}
              />
            </TableCell>

            <TableCell className="w-[4.5rem] align-top text-center">
              <div className="flex justify-center pt-0.5">
                {isManualCreator && lineFields.platformSelectOptions.length > 0 ? (
                  <QuotationLinePlatformCell
                    loadingPlatforms={lineFields.loadingPlatforms}
                    platformSelectOptions={lineFields.platformSelectOptions}
                    platform={deliverable.platform ?? item.platform}
                    onPlatformChange={lineFields.handlePlatformChange}
                    defaultOpen={autoOpenEditors && isFirst}
                    forceSelect
                  />
                ) : (
                  <QuotationDeliverablePlatformIcons
                    allPlatforms={typeLinesIncludeAllPlatforms(deliverable)}
                    platforms={displayPlatforms}
                    loading={lineFields.loadingPlatforms && displayPlatforms.length === 0}
                  />
                )}
              </div>
            </TableCell>

            <TableCell className="min-w-[200px] align-top">
              <div className="space-y-1">
                <QuotationDeliverableTypeLinesEditor
                  lines={deliverableTypeLines(deliverable)}
                  allowedPlatforms={allowedCreatorPlatforms}
                  onChange={(lines, options) =>
                    handleTypeLinesChange(deliverable.key, lines, options)
                  }
                  defaultOpen={autoOpenEditors && isFirst}
                />
                {canRemoveRow ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px] text-muted-foreground"
                    onClick={() => handleRemoveType(deliverable.key)}
                  >
                    <Trash2Icon className="mr-1 size-3" />
                    Remove pricing line
                  </Button>
                ) : null}
              </div>
            </TableCell>

            <TableCell className="min-w-[11rem] w-auto max-w-none align-top px-3 py-2 text-right whitespace-nowrap">
              <QuotationDeliverableCostDetails
                deliverable={deliverable}
                item={item}
                draft={draft}
                priceLabel={formatDeliverablePrice(
                  deliverable.revenue,
                  deliverable.cost_currency ?? costCurrency
                )}
                gpPctLabel={formatDeliverableGpPct(
                  deliverable,
                  draft?.fxRateToEgp ?? item.fx_rate_to_egp ?? 1
                )}
                onApply={(next) => applyDeliverable(deliverable.key, next)}
                defaultOpen={autoOpenEditors && isFirst}
              />
            </TableCell>

            {isFirst ? (
              <TableCell rowSpan={rowSpan} className="align-middle">
                <SaveIndicator status={lineFields.lineSaveStatus} />
              </TableCell>
            ) : null}

            {isFirst ? (
              <TableCell rowSpan={rowSpan} className="align-middle">
                <div className="flex flex-col items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={handleAddType}
                    aria-label="Add pricing line"
                  >
                    <PlusIcon className="size-3.5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={pending}
                        aria-label="Line actions"
                      >
                        <MoreHorizontalIcon className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={handleAddOption}>
                        <PlusIcon className="size-3.5" />
                        Add option
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDuplicateLine}>
                        <CopyIcon className="size-3.5" />
                        Duplicate option (same creator)
                      </DropdownMenuItem>
                      {shortlistId ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={handleReturnToShortlist}>
                            <RotateCcwIcon className="size-3.5" />
                            Return to shortlist
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={handleRemoveCreator}
                    disabled={pending}
                    aria-label="Remove creator"
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
              </TableCell>
            ) : null}
          </TableRow>
        );
      })}
    </>
  );
}

/** Sum of per-type total prices for footer / display. */
export function itemDeliverablePriceTotal(item: QuotationItemRow): number {
  return fromDeliverableDrafts(
    item.deliverables.map((d, i) => ({ ...d, key: `d-${i}` }))
  ).reduce((sum, d) => sum + (Number(d.revenue) || 0), 0);
}
