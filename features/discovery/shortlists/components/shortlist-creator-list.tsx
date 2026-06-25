"use client";

import {
  FileTextIcon,
  MoreHorizontalIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CreatorResultGridHeader,
  CreatorResultRow,
} from "@/features/discovery/components/creator-result-row";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { ShortlistItemStatus } from "@/types/database";

import { ShortlistItemStatusBadge } from "./shortlist-badges";

type ShortlistRowItem = {
  item_id: string;
  item_status: ShortlistItemStatus;
  creator: UnifiedCreatorResult | null;
};

type Props = {
  items: ShortlistRowItem[];
  selectedIds: Set<string>;
  selectable: boolean;
  editable: boolean;
  busy?: boolean;
  onToggleSelect: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onAddToQuotation: (itemId: string) => void;
};

function UnknownCreatorRow({
  item,
  rank,
  selected,
  selectable,
  editable,
  busy,
  onToggleSelect,
  onRemove,
  onAddToQuotation,
}: {
  item: ShortlistRowItem;
  rank: number;
  selected: boolean;
  selectable: boolean;
  editable: boolean;
  busy?: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  onAddToQuotation: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-3 border-b border-border px-5 py-2.5 ${
        selected ? "bg-primary/[0.06]" : ""
      }`}
    >
      {selectable ? (
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect()}
          aria-label="Select creator"
        />
      ) : (
        <span className="text-[11px] tabular-nums text-muted-foreground">{rank}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">Unknown creator</p>
          <ShortlistItemStatusBadge status={item.item_status} />
        </div>
        <p className="text-xs text-muted-foreground">Profile not resolved</p>
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onAddToQuotation} disabled={busy}>
          Add to quotation
        </Button>
        {editable ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-destructive"
            onClick={onRemove}
            disabled={busy}
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function RowActions({
  editable,
  busy,
  onAddToQuotation,
  onRemove,
}: {
  editable: boolean;
  busy?: boolean;
  onAddToQuotation: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="flex items-center justify-end gap-1"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="sm"
        className="hidden h-8 gap-1.5 text-xs text-muted-foreground hover:text-primary lg:inline-flex"
        onClick={onAddToQuotation}
        disabled={busy}
      >
        <FileTextIcon className="size-3.5" />
        Quote
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={busy}>
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="text-xs">
          <DropdownMenuItem onClick={onAddToQuotation}>Add to quotation</DropdownMenuItem>
          {editable ? (
            <DropdownMenuItem onClick={onRemove} className="text-destructive">
              Remove from shortlist
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ShortlistCreatorList({
  items,
  selectedIds,
  selectable,
  editable,
  busy,
  onToggleSelect,
  onRemove,
  onAddToQuotation,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <CreatorResultGridHeader variant="shortlist" />
      {items.map((item, index) => {
        const isSelected = selectedIds.has(item.item_id);
        if (!item.creator) {
          return (
            <UnknownCreatorRow
              key={item.item_id}
              item={item}
              rank={index + 1}
              selected={isSelected}
              selectable={selectable}
              editable={editable}
              busy={busy}
              onToggleSelect={() => onToggleSelect(item.item_id)}
              onRemove={() => onRemove(item.item_id)}
              onAddToQuotation={() => onAddToQuotation(item.item_id)}
            />
          );
        }

        return (
          <CreatorResultRow
            key={item.item_id}
            creator={item.creator}
            rank={index + 1}
            selected={isSelected}
            variant="shortlist"
            onToggleSelect={() => onToggleSelect(item.item_id)}
            statusBadge={<ShortlistItemStatusBadge status={item.item_status} />}
            actions={
              <RowActions
                editable={editable}
                busy={busy}
                onAddToQuotation={() => onAddToQuotation(item.item_id)}
                onRemove={() => onRemove(item.item_id)}
              />
            }
          />
        );
      })}
    </div>
  );
}
