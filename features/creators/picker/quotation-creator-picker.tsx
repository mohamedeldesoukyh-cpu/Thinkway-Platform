"use client";

import { CreatorSelectionToolbar } from "./creator-selection-toolbar";
import { CreatorStaticSelectionList } from "./creator-selection-table";
import { selectAllIds, toggleIdSelection } from "./creator-selection-hooks";

type QuotationImportItem = {
  id: string;
  label: string;
};

type Props = {
  items: QuotationImportItem[];
  loading?: boolean;
  emptyMessage?: string;
  selectedIds: Set<string>;
  onSelectedIdsChange: (ids: Set<string>) => void;
};

export function QuotationCreatorPicker({
  items,
  loading,
  emptyMessage,
  selectedIds,
  onSelectedIdsChange,
}: Props) {
  function toggle(id: string) {
    onSelectedIdsChange(toggleIdSelection(selectedIds, id));
  }

  function handleSelectAll() {
    onSelectedIdsChange(selectAllIds(items.map((i) => i.id)));
  }

  function handleDeselectAll() {
    onSelectedIdsChange(new Set());
  }

  return (
    <div className="space-y-2">
      {items.length > 0 ? (
        <CreatorSelectionToolbar
          selectedCount={selectedIds.size}
          totalVisible={items.length}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onClear={handleDeselectAll}
          showClear={false}
          className={selectedIds.size > 0 ? "rounded-lg" : "px-0 py-0"}
        />
      ) : null}
      <CreatorStaticSelectionList
        items={items}
        selectedIds={selectedIds}
        onToggle={toggle}
        loading={loading}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}
