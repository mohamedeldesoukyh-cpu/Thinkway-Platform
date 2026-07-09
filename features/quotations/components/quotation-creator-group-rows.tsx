"use client";

import { useMemo } from "react";

import { QuotationCreatorDeliverableRows } from "@/features/quotations/components/quotation-creator-deliverable-rows";
import { QuotationCreatorGroupHeaderRow } from "@/features/quotations/components/quotation-creator-group-header-row";
import type { QuotationItemRow } from "@/features/quotations/types";
import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";
import type { QuotationItemOptionContext } from "@/lib/quotations/quotation-creator-options";
import { quotationOptionRowShadeClass } from "@/lib/quotations/quotation-creator-options";

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
}: Props) {
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.sort_order - b.sort_order),
    [items]
  );

  const hasMultipleOptions = sortedItems.length > 1;
  const headerItem = sortedItems[0]!;

  return (
    <>
      <QuotationCreatorGroupHeaderRow
        item={headerItem}
        optionCount={sortedItems.length}
        isFirstGroup={groupIndex === 0}
        onOpenCreator={onOpenCreator ? () => onOpenCreator(headerItem) : undefined}
      />
      {sortedItems.map((item, itemIndex) => {
        const optionCtx = optionContextByItemId.get(item.id);
        const displayOptionNumber = optionCtx?.optionNumber ?? item.option_number ?? itemIndex + 1;

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
          />
        );
      })}
    </>
  );
}
