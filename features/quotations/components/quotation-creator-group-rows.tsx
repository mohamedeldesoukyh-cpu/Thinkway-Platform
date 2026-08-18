"use client";

import { useCallback, useMemo, useState } from "react";

import { QuotationCreatorDeliverableRows } from "@/features/quotations/components/quotation-creator-deliverable-rows";
import { QuotationCreatorGroupHeaderRow } from "@/features/quotations/components/quotation-creator-group-header-row";
import type { QuotationItemRow } from "@/features/quotations/types";
import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";
import type { QuotationItemOptionContext } from "@/lib/quotations/quotation-creator-options";
import { quotationOptionRowShadeClass } from "@/lib/quotations/quotation-creator-options";
import type { ClientCreatorSelectionState } from "@/features/client-workspace/constants";

type Props = {
  quotationId: string;
  shortlistId: string | null;
  items: QuotationItemRow[];
  drafts: Record<string, QuotationRowDraft | undefined>;
  groupIndex: number;
  optionContextByItemId: Map<string, QuotationItemOptionContext>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onDraftChange: (id: string, patch: Partial<QuotationRowDraft>) => void;
  onRemoved: () => void;
  onLineChanged: () => void;
  onOpenCreator?: (item: QuotationItemRow) => void;
  focusItemId?: string | null;
  /** Collap bundles: identity headers only — package row holds pricing. */
  collapsePackageMode?: boolean;
  displayCurrency?: string;
  displayFxRateToEgp?: number;
  clientSelection?: ClientCreatorSelectionState;
};

/** One influencer block: header row (avatar + name), then Option 1 / 2 / 3… lines. */
export function QuotationCreatorGroupRows({
  quotationId,
  shortlistId,
  items,
  drafts,
  groupIndex,
  optionContextByItemId,
  selectedIds,
  onToggleSelect,
  onDraftChange,
  onRemoved,
  onLineChanged,
  onOpenCreator,
  focusItemId,
  collapsePackageMode = false,
  displayCurrency,
  displayFxRateToEgp,
  clientSelection,
}: Props) {
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.sort_order - b.sort_order),
    [items]
  );

  const hasMultipleOptions = sortedItems.length > 1;
  const headerItem = sortedItems[0]!;
  const creatorOptionItemIds = useMemo(
    () => sortedItems.map((row) => row.id),
    [sortedItems]
  );
  const [livePlatformsByItem, setLivePlatformsByItem] = useState<
    Record<string, string[]>
  >({});

  const handleUsedPlatformsChange = useCallback(
    (itemId: string, platforms: string[]) => {
      setLivePlatformsByItem((prev) => {
        const nextKey = platforms.join(",");
        if ((prev[itemId] ?? []).join(",") === nextKey) return prev;
        return { ...prev, [itemId]: platforms };
      });
    },
    []
  );

  const livePlatforms = useMemo(() => {
    const fromItems = Object.values(livePlatformsByItem).flat();
    return unionQuotationCreatorGroupPlatforms(sortedItems, fromItems);
  }, [sortedItems, livePlatformsByItem]);

  return (
    <>
      <QuotationCreatorGroupHeaderRow
        item={headerItem}
        groupItems={sortedItems}
        livePlatforms={livePlatforms}
        optionCount={sortedItems.length}
        isFirstGroup={groupIndex === 0}
        hideOptionCount={collapsePackageMode}
        onOpenCreator={onOpenCreator ? () => onOpenCreator(headerItem) : undefined}
        clientSelection={clientSelection}
      />
      {collapsePackageMode
        ? null
        : sortedItems.map((item, itemIndex) => {
            const optionCtx = optionContextByItemId.get(item.id);
            const displayOptionNumber =
              optionCtx?.optionNumber ?? item.option_number ?? itemIndex + 1;

            return (
              <QuotationCreatorDeliverableRows
                key={`${item.id}-opt-${displayOptionNumber}`}
                quotationId={quotationId}
                shortlistId={shortlistId}
                item={item}
                draft={drafts[item.id]}
                zebra={itemIndex % 2 === 1}
                displayOptionNumber={displayOptionNumber}
                optionShadeClass={
                  hasMultipleOptions
                    ? quotationOptionRowShadeClass(
                        (optionCtx?.shadeIndex ?? displayOptionNumber - 1)
                      )
                    : undefined
                }
                showOptionLabel={hasMultipleOptions}
                creatorDuplicateCount={sortedItems.length}
                groupMode
                selected={selectedIds.has(item.id)}
                onToggleSelect={() => onToggleSelect(item.id)}
                onDraftChange={onDraftChange}
                onRemoved={onRemoved}
                onLineChanged={onLineChanged}
                onOpenCreator={
                  onOpenCreator ? () => onOpenCreator(item) : undefined
                }
                autoOpenEditors={item.id === focusItemId}
                onUsedPlatformsChange={handleUsedPlatformsChange}
                creatorOptionItemIds={creatorOptionItemIds}
                displayCurrency={displayCurrency}
                displayFxRateToEgp={displayFxRateToEgp}
              />
            );
          })}
    </>
  );
}
