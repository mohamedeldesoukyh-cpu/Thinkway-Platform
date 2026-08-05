"use client";

import { useCallback, useEffect, useMemo, useRef, useTransition } from "react";
import { MoreHorizontalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { useConfirmDelete } from "@/components/shared/confirm-action-provider";
import { TooltipIconButton } from "@/components/shared/tooltip-icon-button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  duplicateQuotationItems,
  removeQuotationItem,
} from "@/features/quotations/actions";
import { useQuotationManualSave } from "@/features/quotations/components/quotation-manual-save";
import { QuotationDeliverableTypeLinesEditor } from "@/features/quotations/components/quotation-deliverable-type-lines";
import { QuotationDeliverableCostDetails } from "@/features/quotations/components/quotation-deliverable-cost-details";
import { QuotationDeliverablePlatformIcons } from "@/features/quotations/components/quotation-deliverable-platform-icons";
import {
  fromDeliverableDrafts,
  useQuotationLineFields,
  type DeliverableDraft,
} from "@/features/quotations/components/quotation-line-fields";
import type { QuotationDeliverable, QuotationItemRow } from "@/features/quotations/types";
import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";
import type { QuotationDeliverableTypeLine } from "@/lib/domains/commercial/quotation-types";
import {
  collapsePackageFollowerItems,
  collapsePackageLeaderItem,
  registerCollapsePackagePending,
  unionCollapsePackagePlatforms,
} from "@/lib/quotations/quotation-collapse-package";
import {
  deliverableTypeLines,
  deliverableTypeValues,
  isPostTypeAllowedForCreator,
  platformsFromSelectedPostTypes,
  syncDeliverableFromTypeLines,
  syncServiceDescriptionWithTypeLines,
  typeLinesIncludeAllPlatforms,
  optionNumberLabel,
} from "@/lib/quotations/quotation-deliverable-types";
import { formatDeliverableGpPct } from "@/lib/quotations/quotation-deliverable-commercial";
import {
  deliverablesMatchLineDraft,
  projectLineDraftOntoDeliverables,
  resolveCreatorLinePriceLabel,
} from "@/lib/quotations/quotation-line-creator-commercial-sync";
import type { AutosaveStatus } from "@/lib/hooks/use-debounced-autosave";
import { cn } from "@/lib/utils";
import type { QuotationLinePendingPayload } from "@/features/quotations/components/quotation-manual-save";

function SaveIndicator({ status }: { status: AutosaveStatus }) {
  if (status === "idle") {
    return (
      <span className="spill spill-row-status" style={{ height: 22 }}>
        Draft
      </span>
    );
  }
  if (status === "pending") return <span className="text-[10px] text-warning">Unsaved</span>;
  if (status === "saving")
    return <span className="text-[10px] text-muted-foreground">Saving…</span>;
  if (status === "saved") return <span className="text-[10px] text-primary">Saved</span>;
  if (status === "error") return <span className="text-[10px] text-destructive">Failed</span>;
  return null;
}

function FlexColEmpty({ className }: { className: string }) {
  return <span className={cn(className, "co-empty")} aria-hidden />;
}

type Props = {
  quotationId: string;
  groupItems: QuotationItemRow[];
  drafts: Record<string, QuotationRowDraft | undefined>;
  selectedIds: Set<string>;
  onToggleSelectGroup: (itemIds: string[]) => void;
  onDraftChange: (id: string, patch: Partial<QuotationRowDraft>) => void;
  onRemoved: () => void;
  onLineChanged: () => void;
  autoOpenEditors?: boolean;
  packageOptionNumber?: number;
  showPackageOptionLabel?: boolean;
  /** Sibling Collap packages for the same creator set (Option 1 / 2 / …). */
  packageSiblingCount?: number;
  /** All member ids across sibling packages — used to remove every option. */
  siblingPackageMemberIds?: string[];
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
  return allowedCreatorPlatforms;
}

/** One service description, type, and cost for an entire Collap package. */
export function QuotationCollapsePackagePricingRow({
  quotationId,
  groupItems,
  drafts,
  selectedIds,
  onToggleSelectGroup,
  onDraftChange,
  onRemoved,
  onLineChanged,
  autoOpenEditors = false,
  packageOptionNumber = 1,
  showPackageOptionLabel = false,
  packageSiblingCount = 1,
  siblingPackageMemberIds,
  displayCurrency,
  displayFxRateToEgp,
}: Props) {
  const [pending, startTransition] = useTransition();
  const manualSave = useQuotationManualSave();
  const confirmDelete = useConfirmDelete();
  const leader = useMemo(() => collapsePackageLeaderItem(groupItems), [groupItems]);
  const followers = useMemo(() => collapsePackageFollowerItems(groupItems), [groupItems]);
  const memberIds = useMemo(() => groupItems.map((item) => item.id), [groupItems]);
  const hasMultiplePackageOptions = packageSiblingCount > 1;
  const allPackageMemberIds = useMemo(() => {
    const ids = siblingPackageMemberIds?.length ? siblingPackageMemberIds : memberIds;
    return [...new Set(ids.filter(Boolean))];
  }, [siblingPackageMemberIds, memberIds]);
  const draft = drafts[leader.id];
  const costCurrency = draft?.costCurrency ?? leader.cost_currency;

  const packagePlatforms = useMemo(
    () => unionCollapsePackagePlatforms(groupItems),
    [groupItems]
  );

  const groupChecked = useMemo(() => {
    const selectedCount = memberIds.filter((id) => selectedIds.has(id)).length;
    if (selectedCount === 0) return false;
    if (selectedCount === memberIds.length) return true;
    return "indeterminate" as const;
  }, [memberIds, selectedIds]);

  const registerPackagePending = useCallback(
    (payload: QuotationLinePendingPayload) => {
      registerCollapsePackagePending({
        leaderId: leader.id,
        leaderPayload: payload,
        followerItems: followers,
        registerLinePending: manualSave.registerLinePending,
      });
      for (const follower of followers) {
        onDraftChange(follower.id, {
          mode: "cost_revenue",
          cost: 0,
          revenue: 0,
          gpPct: 0,
          gpValue: 0,
        });
      }
    },
    [followers, leader.id, manualSave.registerLinePending, onDraftChange]
  );

  const handleDeliverableCommercialsDerived = useCallback(
    (commercials: {
      cost: number;
      revenue: number;
      gpValue: number;
      gpPct: number;
      afPct: number;
    }) => {
      onDraftChange(leader.id, {
        mode: "cost_revenue",
        cost: commercials.cost,
        revenue: commercials.revenue,
        gpPct: commercials.gpPct,
        gpValue: commercials.gpValue,
        afPct: commercials.afPct,
      });
    },
    [leader.id, onDraftChange]
  );

  const lineFields = useQuotationLineFields(
    leader,
    handleDeliverableCommercialsDerived,
    registerPackagePending,
    manualSave.isLinePending(leader.id) ? "pending" : "idle",
    manualSave.isLinePending(leader.id),
    manualSave.registerSaveFlush
  );

  const allowedCreatorPlatforms = useMemo(() => {
    const fromLine = lineFields.platformSelectOptions.map((p) => p.platform);
    const merged = [...new Set([...packagePlatforms, ...fromLine])];
    return merged.length > 0 ? merged : packagePlatforms;
  }, [lineFields.platformSelectOptions, packagePlatforms]);

  const displayRows = useMemo((): DeliverableDraft[] => {
    return lineFields.deliverableDrafts.map((d) => {
      const type_lines = deliverableTypeLines(d);
      const synced = syncDeliverableFromTypeLines(
        type_lines,
        allowedCreatorPlatforms,
        d.platform || leader.platform || allowedCreatorPlatforms[0] || "instagram"
      );
      return { ...d, ...synced };
    });
  }, [lineFields.deliverableDrafts, leader.platform, allowedCreatorPlatforms]);

  const lastMasterSyncKeyRef = useRef<string | null>(null);

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
        key: keys[index] ?? `sync-${leader.id}-${index}`,
        type_lines: deliverableTypeLines(deliverable),
      }))
    );
  }, [draft, leader.id, lineFields.deliverableDrafts, lineFields.saveDeliverables]);

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
    const current = lineFields.deliverableDrafts.find((d) => d.key === key);
    const previousLines = current ? deliverableTypeLines(current) : [];
    const filtered = typeLines.map((line) => ({
      ...line,
      type:
        line.type.trim() &&
        !isPostTypeAllowedForCreator(line.type, allowedCreatorPlatforms)
          ? ""
          : line.type,
    }));
    const synced = syncDeliverableFromTypeLines(
      filtered,
      allowedCreatorPlatforms,
      leader.platform ?? allowedCreatorPlatforms[0] ?? "instagram"
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
    lineFields.saveDeliverables(
      lineFields.deliverableDrafts.map((d) => (d.key === key ? { ...d, ...patch } : d))
    );
  }

  async function handleRemoveOption() {
    const label = `Option ${packageOptionNumber}`;
    const ok = await confirmDelete(
      hasMultiplePackageOptions
        ? `Remove ${label} for this Collap from the quotation? Other options stay. This cannot be undone.`
        : `Remove this Collap package and all linked creators from the quotation? This cannot be undone.`,
      hasMultiplePackageOptions ? "Remove option?" : "Remove Collap package?"
    );
    if (!ok) return;

    startTransition(async () => {
      for (const item of groupItems) {
        const res = await removeQuotationItem({ item_id: item.id, quotation_id: quotationId });
        if (!res.ok) {
          toast.error(res.message);
          onLineChanged();
          return;
        }
      }
      toast.success(
        hasMultiplePackageOptions ? `${label} removed.` : "Collap package removed."
      );
      if (hasMultiplePackageOptions) {
        onLineChanged();
      } else {
        onRemoved();
      }
    });
  }

  async function handleRemoveAllPackages() {
    const optionCount = Math.max(1, packageSiblingCount);
    const ok = await confirmDelete(
      optionCount > 1
        ? `Remove this Collap and all ${optionCount} options from the quotation? This cannot be undone.`
        : `Remove this Collap package and all linked creators from the quotation? This cannot be undone.`,
      "Remove Collap from quotation?"
    );
    if (!ok) return;

    startTransition(async () => {
      for (const itemId of allPackageMemberIds) {
        const res = await removeQuotationItem({ item_id: itemId, quotation_id: quotationId });
        if (!res.ok) {
          toast.error(res.message);
          onLineChanged();
          return;
        }
      }
      toast.success("Collap removed.");
      onRemoved();
    });
  }

  async function handleRemovePricingLine(key: string) {
    const ok = await confirmDelete(
      "Remove this pricing line from the package? This cannot be undone.",
      "Remove pricing line?"
    );
    if (!ok) return;
    lineFields.removeDeliverable(key);
  }

  function handleDuplicatePackage() {
    startTransition(async () => {
      const res = await duplicateQuotationItems({
        quotation_id: quotationId,
        item_ids: memberIds,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Package duplicated.");
      onLineChanged();
    });
  }

  function handleAddPackageOption() {
    handleDuplicatePackage();
  }

  const rowClass = cn(
    "oline oline-package bg-primary/[0.04]",
    groupChecked === true && "ring-1 ring-inset ring-primary/25"
  );

  return (
    <>
      {displayRows.map((deliverable, index) => {
        const isFirst = index === 0;
        const canRemoveRow = displayRows.length > 1;
        const displayPlatforms = resolveDeliverableDisplayPlatforms(
          deliverable,
          allowedCreatorPlatforms,
          leader.platform
        );

        return (
          <div
            key={`collapse-package-${leader.id}-${deliverable.key}`}
            className={rowClass}
            data-collapse-package-pricing
          >
            {isFirst ? (
              <span className="co-chk">
                <Checkbox
                  checked={groupChecked}
                  onCheckedChange={() => onToggleSelectGroup(memberIds)}
                  aria-label="Select Collap package creators"
                />
              </span>
            ) : (
              <FlexColEmpty className="co-chk" />
            )}

            {isFirst ? (
              <span className="co-opt">
                <div className="flex flex-col gap-0.5">
                  {showPackageOptionLabel ? (
                    <span className="text-xs font-medium text-foreground">
                      {optionNumberLabel(packageOptionNumber)}
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-primary">Package</span>
                  )}
                </div>
              </span>
            ) : (
              <FlexColEmpty className="co-opt" />
            )}

            {isFirst ? (
              <span className="co-tier">
                <span className="text-[11px] text-[var(--text-4)]">Collap</span>
              </span>
            ) : (
              <FlexColEmpty className="co-tier" />
            )}

            <span className="co-svc">
              <Textarea
                rows={1}
                className="svc-input svc-input--wrap min-h-[34px] resize-none text-[12.5px] leading-snug"
                placeholder="Package service description…"
                value={deliverable.service_description ?? ""}
                onChange={(e) => {
                  updateDraft(deliverable.key, { service_description: e.target.value });
                }}
              />
            </span>

            <span className="co-plat">
              <div className="flex justify-center">
                <QuotationDeliverablePlatformIcons
                  allPlatforms={typeLinesIncludeAllPlatforms(deliverable)}
                  platforms={displayPlatforms}
                  loading={lineFields.loadingPlatforms && displayPlatforms.length === 0}
                  compact
                />
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
                    onClick={() => void handleRemovePricingLine(deliverable.key)}
                    tooltip="Remove pricing line"
                  >
                    <Trash2Icon className="size-3.5" />
                  </TooltipIconButton>
                ) : null}
              </div>
            </span>

            <span className="co-price">
              <QuotationDeliverableCostDetails
                deliverable={deliverable}
                item={leader}
                draft={draft}
                priceLabel={resolveCreatorLinePriceLabel(deliverable, draft, {
                  currency: deliverable.cost_currency ?? costCurrency,
                  fxRateToEgp: draft?.fxRateToEgp ?? leader.fx_rate_to_egp ?? 1,
                  fallbackAfPct: draft?.afPct ?? leader.af_pct,
                  allowLineMasterFallback: isFirst,
                  preferLineMaster: isFirst && displayRows.length === 1,
                  displayCurrency:
                    displayCurrency ?? deliverable.cost_currency ?? costCurrency,
                  displayFxRateToEgp:
                    displayFxRateToEgp ??
                    draft?.fxRateToEgp ??
                    leader.fx_rate_to_egp ??
                    1,
                })}
                gpPctLabel={formatDeliverableGpPct(
                  deliverable,
                  draft?.fxRateToEgp ?? leader.fx_rate_to_egp ?? 1
                )}
                onApply={(next) => applyDeliverable(deliverable.key, next)}
                onLiveChange={(next) => applyDeliverable(deliverable.key, next)}
                defaultOpen={autoOpenEditors && isFirst}
                priceLayout="stacked"
              />
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
                    onClick={() => lineFields.handleAddDeliverable()}
                    tooltip="Add package pricing line"
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
                        tooltip="Package actions"
                      >
                        <MoreHorizontalIcon className="size-3.5" />
                      </TooltipIconButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={handleAddPackageOption}>
                        <PlusIcon className="size-3.5" />
                        Add option
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDuplicatePackage}>
                        Duplicate package
                      </DropdownMenuItem>
                      {hasMultiplePackageOptions ? (
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
                        onClick={() => void handleRemoveAllPackages()}
                      >
                        <Trash2Icon className="size-3.5" />
                        Remove Collap from quotation
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <TooltipIconButton
                    variant="ghost"
                    size="icon"
                    className="ibtn mini size-7 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      void (hasMultiplePackageOptions
                        ? handleRemoveOption()
                        : handleRemoveAllPackages())
                    }
                    disabled={pending}
                    tooltip={
                      hasMultiplePackageOptions
                        ? `Remove Option ${packageOptionNumber}`
                        : "Remove Collap package from quotation"
                    }
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
