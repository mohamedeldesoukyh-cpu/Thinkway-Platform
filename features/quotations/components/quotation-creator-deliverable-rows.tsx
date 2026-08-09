"use client";

import { useCallback, useEffect, useMemo, useRef, useTransition } from "react";
import {
  CopyIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { useConfirmDelete } from "@/components/shared/confirm-action-provider";
import { TooltipIconButton } from "@/components/shared/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
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
  resolveCommercialRateToEgp,
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
  syncServiceDescriptionWithTypeLines,
  typeLinesIncludeAllPlatforms,
} from "@/lib/quotations/quotation-deliverable-types";
import { formatDeliverableGpPct } from "@/lib/quotations/quotation-deliverable-commercial";
import {
  deliverablesMatchLineDraft,
  projectLineDraftOntoDeliverables,
  resolveCreatorLinePriceDualLabel,
} from "@/lib/quotations/quotation-line-creator-commercial-sync";
import type { AutosaveStatus } from "@/lib/hooks/use-debounced-autosave";
import { cn } from "@/lib/utils";
import { isManualQuotationCreator } from "@/lib/quotations/quotation-creator-platform-options";

function SaveIndicator({ status }: { status: AutosaveStatus }) {
  if (status === "idle") {
    return (
      <span className="spill spill-row-status" style={{ height: 22 }}>
        Draft
      </span>
    );
  }
  if (status === "pending")
    return (
      <span className="spill spill-row-status">
        <span className="led" aria-hidden />
        Unsaved
      </span>
    );
  if (status === "saving")
    return (
      <span className="spill spill-row-status">
        <span className="led" aria-hidden />
        Saving…
      </span>
    );
  if (status === "saved")
    return (
      <span className="spill spill-row-status spill-row-status--ok">
        <span className="led" aria-hidden />
        Saved
      </span>
    );
  if (status === "error")
    return (
      <span className="spill spill-row-status spill-row-status--err">
        <span className="led" aria-hidden />
        Failed
      </span>
    );
  return null;
}

function FlexColEmpty({ className }: { className: string }) {
  return <span className={cn(className, "co-empty")} aria-hidden />;
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
  /** Report platforms used on this option so the creator header can stack them. */
  onUsedPlatformsChange?: (itemId: string, platforms: string[]) => void;
  /** All option line ids for this creator (enables remove-option vs remove-creator). */
  creatorOptionItemIds?: string[];
  /** Quotation header display currency (Price labels match metrics band). */
  displayCurrency?: string;
  displayFxRateToEgp?: number;
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
  onUsedPlatformsChange,
  creatorOptionItemIds,
  displayCurrency,
  displayFxRateToEgp,
}: Props) {
  const [pending, startTransition] = useTransition();
  const manualSave = useQuotationManualSave();
  const confirmDelete = useConfirmDelete();
  const costCurrency = draft?.costCurrency ?? item.cost_currency;
  const optionItemIds = useMemo(() => {
    const ids = creatorOptionItemIds?.length ? creatorOptionItemIds : [item.id];
    return [...new Set(ids.filter(Boolean))];
  }, [creatorOptionItemIds, item.id]);
  const hasMultipleCreatorOptions = optionItemIds.length > 1;

  const optionSelectValues = useMemo(() => {
    const upper = Math.max(creatorDuplicateCount, displayOptionNumber, 1) + 1;
    return Array.from({ length: upper }, (_, i) => i + 1);
  }, [creatorDuplicateCount, displayOptionNumber]);

  const syncEntryCurrency = useCallback(
    (currency: string) => {
      const next = (currency || "EGP").toUpperCase();
      const current = (draft?.costCurrency || item.cost_currency || "EGP").toUpperCase();
      const liveFx = draft?.fxRateToEgp ?? item.fx_rate_to_egp ?? 0;
      // Identity (1) on a non-EGP line means the rate never resolved — refresh it.
      const hasRealFx = next === "EGP" || liveFx > 1;
      if (next === current && hasRealFx) {
        return;
      }
      if (next === "EGP") {
        onDraftChange(item.id, { costCurrency: "EGP", fxRateToEgp: 1 });
        return;
      }
      void resolveCommercialRateToEgp(next).then((res) => {
        if (!res.ok || !res.data) return;
        onDraftChange(item.id, {
          costCurrency: next,
          fxRateToEgp: res.data.rate,
        });
      });
    },
    [
      draft?.costCurrency,
      draft?.fxRateToEgp,
      item.cost_currency,
      item.fx_rate_to_egp,
      item.id,
      onDraftChange,
    ]
  );

  const handleDeliverableCommercialsDerived = useCallback(
    (commercials: {
      cost: number;
      revenue: number;
      gpValue: number;
      gpPct: number;
      afPct: number;
      costCurrency: string;
    }) => {
      onDraftChange(item.id, {
        mode: "cost_revenue",
        cost: commercials.cost,
        revenue: commercials.revenue,
        gpPct: commercials.gpPct,
        gpValue: commercials.gpValue,
        afPct: commercials.afPct,
        costCurrency: commercials.costCurrency,
      });
      syncEntryCurrency(commercials.costCurrency);
    },
    [item.id, onDraftChange, syncEntryCurrency]
  );

  const lineFields = useQuotationLineFields(
    item,
    handleDeliverableCommercialsDerived,
    (payload) => manualSave.registerLinePending(item.id, payload),
    manualSave.isLinePending(item.id) ? "pending" : "idle",
    manualSave.isLinePending(item.id),
    manualSave.registerSaveFlush,
    {
      costCurrency: draft?.costCurrency ?? item.cost_currency,
      fxRateToEgp: draft?.fxRateToEgp ?? item.fx_rate_to_egp,
    }
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

  const lastMasterSyncKeyRef = useRef<string | null>(null);

  // Commercial Workspace → creator Cost Detail / Price: keep deliverables aligned
  // with line Master whenever Master diverges from the current rollup.
  useEffect(() => {
    if (!draft) return;
    const current = fromDeliverableDrafts(lineFields.deliverableDrafts);
    if (deliverablesMatchLineDraft(current, draft)) {
      lastMasterSyncKeyRef.current = [
        draft.cost,
        draft.revenue,
        draft.gpPct,
        draft.afPct,
        draft.mode,
        draft.costCurrency,
      ].join("|");
      return;
    }
    const syncKey = [
      draft.cost,
      draft.revenue,
      draft.gpPct,
      draft.afPct,
      draft.mode,
      draft.costCurrency,
    ].join("|");
    if (lastMasterSyncKeyRef.current === syncKey) return;
    lastMasterSyncKeyRef.current = syncKey;

    const projected = projectLineDraftOntoDeliverables(current, draft);
    const keys = lineFields.deliverableDrafts.map((d) => d.key);
    lineFields.saveDeliverables(
      projected.map((deliverable, index) => ({
        ...deliverable,
        key: keys[index] ?? `sync-${item.id}-${index}`,
        type_lines: deliverableTypeLines(deliverable),
      }))
    );
  }, [
    draft,
    item.id,
    lineFields.deliverableDrafts,
    lineFields.saveDeliverables,
  ]);

  const usedPlatforms = useMemo(() => {
    const found = new Set<string>();
    for (const deliverable of displayRows) {
      for (const platform of resolveDeliverableDisplayPlatforms(
        deliverable,
        allowedCreatorPlatforms,
        item.platform
      )) {
        found.add(platform);
      }
    }
    return [...found];
  }, [displayRows, allowedCreatorPlatforms, item.platform]);

  const usedPlatformsKey = usedPlatforms.join(",");
  useEffect(() => {
    if (!onUsedPlatformsChange) return;
    onUsedPlatformsChange(
      item.id,
      usedPlatformsKey ? usedPlatformsKey.split(",") : []
    );
  }, [item.id, usedPlatformsKey, onUsedPlatformsChange]);

  function handleOptionChange(value: string) {
    const nextOption = Number(value);
    if (!Number.isFinite(nextOption) || nextOption < 1) return;
    manualSave.registerLinePending(item.id, { option_number: nextOption });
  }

  function applyDeliverable(key: string, next: QuotationDeliverable) {
    if (next.cost_currency) {
      syncEntryCurrency(next.cost_currency);
    }
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
    const current = lineFields.deliverableDrafts.find((d) => d.key === key);
    const previousLines = current ? deliverableTypeLines(current) : [];
    const synced = syncDeliverableFromTypeLines(
      typeLines,
      allowedCreatorPlatforms,
      item.platform ?? allowedCreatorPlatforms[0] ?? "instagram"
    );
    const patch = {
      ...synced,
      service_description: syncServiceDescriptionWithTypeLines(
        current?.service_description,
        previousLines,
        synced.type_lines
      ),
    };
    if (options?.persist === false) {
      lineFields.updateDeliverableDraftLocal(key, patch);
      return;
    }
    updateDraft(key, patch);
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

  async function handleRemoveType(key: string) {
    const ok = await confirmDelete(
      "Remove this pricing line from the quotation? This cannot be undone.",
      "Remove pricing line?"
    );
    if (!ok) return;
    lineFields.removeDeliverable(key);
  }

  async function handleRemoveOption() {
    const label = `Option ${displayOptionNumber}`;
    const ok = await confirmDelete(
      `Remove ${label} for this creator from the quotation? This cannot be undone.`,
      "Remove option?"
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await removeQuotationItem({ item_id: item.id, quotation_id: quotationId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(`${label} removed.`);
      if (hasMultipleCreatorOptions) {
        onLineChanged();
      } else {
        onRemoved();
      }
    });
  }

  async function handleRemoveCreator() {
    const name = item.creator_name ?? item.handle ?? "this creator";
    const optionCount = optionItemIds.length;
    const ok = await confirmDelete(
      optionCount > 1
        ? `Remove ${name} and all ${optionCount} options from this quotation? This cannot be undone.`
        : `Remove ${name} from this quotation? This cannot be undone.`,
      "Remove creator?"
    );
    if (!ok) return;
    startTransition(async () => {
      for (const itemId of optionItemIds) {
        const res = await removeQuotationItem({
          item_id: itemId,
          quotation_id: quotationId,
        });
        if (!res.ok) {
          toast.error(res.message);
          onLineChanged();
          return;
        }
      }
      toast.success("Creator removed.");
      onRemoved();
    });
  }

  const rowClass = cn(
    "oline align-middle",
    optionShadeClass,
    selected && "ring-1 ring-inset ring-primary/25"
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
          <div
            key={`${item.id}-${deliverable.key}`}
            className={rowClass}
            data-quotation-item-id={isFirst ? item.id : undefined}
          >
            {isFirst ? (
              <span className="co-chk">
                <Checkbox
                  checked={selected}
                  onCheckedChange={onToggleSelect}
                  aria-label={`Select ${item.creator_name ?? item.handle ?? "creator"}`}
                  className="size-4"
                />
              </span>
            ) : (
              <FlexColEmpty className="co-chk" />
            )}

            {isFirst ? (
              <span className="co-opt">
                {showOptionLabel ? (
                  <QuotationCreatorOptionSelect
                    displayOptionNumber={displayOptionNumber}
                    optionSelectValues={optionSelectValues}
                    onChange={handleOptionChange}
                  />
                ) : (
                  <span className="co-opt-label text-[12.5px] text-[var(--text-4)]">
                    — ·{" "}
                    <b className="font-semibold text-[var(--text-2)]">
                      {item.followers != null ? formatCreatorCount(item.followers) : "—"}
                    </b>
                  </span>
                )}
              </span>
            ) : (
              <FlexColEmpty className="co-opt" />
            )}

            {!groupMode && isFirst ? (
              <span className="co-id min-w-[160px] shrink-0">
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
              </span>
            ) : null}

            {isFirst ? (
              <span className="co-tier">
                {creatorTier === "Unknown" ? (
                  <span className="text-[11px] text-[var(--text-4)]">—</span>
                ) : (
                  <CreatorTierBadge tier={creatorTier} className="tierbadge" />
                )}
              </span>
            ) : (
              <FlexColEmpty className="co-tier" />
            )}

            <span className="co-svc">
              <Textarea
                rows={1}
                className="svc-input svc-input--wrap min-h-[34px] resize-none text-[12.5px] leading-snug"
                placeholder="Service description…"
                value={deliverable.service_description ?? ""}
                onChange={(e) => {
                  updateDraft(deliverable.key, { service_description: e.target.value });
                }}
              />
            </span>

            <span className="co-plat">
              <div className="flex justify-center">
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
                    compact
                  />
                )}
              </div>
            </span>

            <span className="co-type">
              <div className="flex min-w-0 items-center gap-1">
                <QuotationDeliverableTypeLinesEditor
                  lines={deliverableTypeLines(deliverable)}
                  allowedPlatforms={allowedCreatorPlatforms}
                  onChange={(lines, options) =>
                    handleTypeLinesChange(deliverable.key, lines, options)
                  }
                  defaultOpen={autoOpenEditors && isFirst}
                  compact
                />
                {canRemoveRow ? (
                  <TooltipIconButton
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="q-remove-type ibtn mini size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => void handleRemoveType(deliverable.key)}
                    tooltip="Remove pricing line"
                  >
                    <Trash2Icon className="size-3.5" />
                  </TooltipIconButton>
                ) : null}
              </div>
            </span>

            <span className="co-price">
              {(() => {
                const entryCurrency = (
                  deliverable.cost_currency ||
                  draft?.costCurrency ||
                  costCurrency ||
                  "EGP"
                ).toUpperCase();
                const quotationCurrency = (displayCurrency || "EGP").toUpperCase();
                // Entry currency on top; quotation CCY equivalent underneath.
                const price = resolveCreatorLinePriceDualLabel(deliverable, draft, {
                  currency: entryCurrency,
                  fxRateToEgp: draft?.fxRateToEgp ?? item.fx_rate_to_egp ?? 1,
                  fallbackAfPct: draft?.afPct ?? item.af_pct,
                  allowLineMasterFallback: isFirst,
                  preferLineMaster: isFirst && displayRows.length === 1,
                  displayCurrency: quotationCurrency,
                  displayFxRateToEgp: displayFxRateToEgp ?? 1,
                });
                return (
                  <QuotationDeliverableCostDetails
                    deliverable={deliverable}
                    item={item}
                    draft={draft}
                    priceLabel={price.primary}
                    priceSecondaryLabel={price.secondary}
                    gpPctLabel={formatDeliverableGpPct(
                      deliverable,
                      draft?.fxRateToEgp ?? item.fx_rate_to_egp ?? 1
                    )}
                    onApply={(next) => applyDeliverable(deliverable.key, next)}
                    onLiveChange={(next) => applyDeliverable(deliverable.key, next)}
                    defaultOpen={autoOpenEditors && isFirst}
                    priceLayout="stacked"
                  />
                );
              })()}
            </span>

            {isFirst ? (
              <span className="co-status">
                <SaveIndicator status={lineFields.lineSaveStatus} />
              </span>
            ) : (
              <FlexColEmpty className="co-status" />
            )}

            {isFirst ? (
              <span className="co-act">
                <div className="oline-act">
                  <TooltipIconButton
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ibtn mini size-7"
                    onClick={handleAddType}
                    tooltip="Add pricing line"
                  >
                    <PlusIcon className="size-3.5" />
                  </TooltipIconButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <TooltipIconButton
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ibtn mini size-7"
                        disabled={pending}
                        tooltip="Line actions"
                      >
                        <MoreHorizontalIcon className="size-3.5" />
                      </TooltipIconButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={handleAddOption}>
                        <PlusIcon className="size-3.5" />
                        Add option
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDuplicateLine}>
                        <CopyIcon className="size-3.5" />
                        Duplicate option (same creator)
                      </DropdownMenuItem>
                      {hasMultipleCreatorOptions ? (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => void handleRemoveOption()}
                        >
                          <Trash2Icon className="size-3.5" />
                          Remove this option
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => void handleRemoveCreator()}
                      >
                        <Trash2Icon className="size-3.5" />
                        Remove creator from quotation
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
                  <TooltipIconButton
                    variant="ghost"
                    size="icon"
                    className="ibtn mini size-7 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      void (hasMultipleCreatorOptions
                        ? handleRemoveOption()
                        : handleRemoveCreator())
                    }
                    disabled={pending}
                    tooltip={
                      hasMultipleCreatorOptions
                        ? `Remove Option ${displayOptionNumber}`
                        : "Remove creator from quotation"
                    }
                  >
                    <Trash2Icon className="size-3.5" />
                  </TooltipIconButton>
                </div>
              </span>
            ) : canRemoveRow ? (
              <span className="co-act">
                <div className="oline-act">
                  <TooltipIconButton
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ibtn mini size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => void handleRemoveType(deliverable.key)}
                    tooltip="Remove pricing line"
                  >
                    <Trash2Icon className="size-3.5" />
                  </TooltipIconButton>
                </div>
              </span>
            ) : (
              <FlexColEmpty className="co-act" />
            )}
          </div>
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
